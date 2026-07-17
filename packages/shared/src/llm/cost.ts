import { AsyncLocalStorage } from "node:async_hooks";
import type { ZodSchema } from "zod";
import type { LlmCallOptions, LlmClient, LlmRequest, LlmResponse } from "./types";

/**
 * Per-report LLM cost tracking + budget enforcement.
 *
 * Every LLM call is attributed to the report being processed (via an
 * AsyncLocalStorage context set at the job boundary — no per-call-site change)
 * and recorded through a pluggable sink (the worker/api registers one that writes
 * to the llm_usage table; shared stays DB-free). A per-report token budget caps
 * runaway scans: once the in-flight flow's accumulated tokens exceed the budget,
 * further calls throw LlmBudgetError so the job fails fast instead of burning
 * unbounded spend on retries.
 */

export interface LlmUsageRecord {
  reportId: string | null;
  tag: string | null;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  estCostUsd: number;
}

export interface LlmContext {
  reportId: string | null;
  budgetTokens: number | null;
  used: { total: number };
}

export class LlmBudgetError extends Error {
  constructor(reportId: string | null, used: number, budget: number) {
    super(`LLM token budget exceeded for report ${reportId ?? "?"}: used ${used} >= budget ${budget}`);
    this.name = "LlmBudgetError";
  }
}

const storage = new AsyncLocalStorage<LlmContext>();

export function withLlmContext<T>(
  init: { reportId: string | null; budgetTokens?: number | null },
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(
    { reportId: init.reportId, budgetTokens: init.budgetTokens ?? null, used: { total: 0 } },
    fn,
  );
}

export function getLlmContext(): LlmContext | undefined {
  return storage.getStore();
}

type UsageSink = (record: LlmUsageRecord) => void | Promise<void>;
let usageSink: UsageSink | null = null;

/** Register the persistence sink (e.g. an insert into llm_usage). Best-effort:
 *  sink errors are swallowed so cost logging never breaks a scan. */
export function setLlmUsageSink(sink: UsageSink): void {
  usageSink = sink;
}

// USD per 1M tokens, [prompt, completion]. Matched by substring; a scan that
// uses an unlisted model still logs tokens with a conservative default price.
const PRICE_TABLE: Array<{ match: RegExp; prompt: number; completion: number }> = [
  { match: /deepseek/i, prompt: 0.27, completion: 1.1 },
  { match: /sonar/i, prompt: 1.0, completion: 1.0 },
  { match: /gpt-4o-mini|4o-mini/i, prompt: 0.15, completion: 0.6 },
  { match: /gpt-4o/i, prompt: 2.5, completion: 10 },
  { match: /claude.*haiku/i, prompt: 0.8, completion: 4 },
  { match: /claude.*sonnet/i, prompt: 3, completion: 15 },
  { match: /mock/i, prompt: 0, completion: 0 },
];
const DEFAULT_PRICE = { prompt: 1, completion: 3 };

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICE_TABLE.find((e) => e.match.test(model)) ?? DEFAULT_PRICE;
  const cost = (promptTokens / 1_000_000) * p.prompt + (completionTokens / 1_000_000) * p.completion;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Wraps any LlmClient to enforce the per-report budget and record usage. Uses a
 * monotonic clock passed in (Date.now) — safe here (not a workflow sandbox).
 */
export class CostTrackingLlmClient implements LlmClient {
  constructor(
    private readonly inner: LlmClient,
    private readonly provider: string,
  ) {}

  async complete<T>(req: LlmRequest<ZodSchema<T>>, opts?: LlmCallOptions): Promise<LlmResponse<T>>;
  async complete(req: LlmRequest, opts?: LlmCallOptions): Promise<LlmResponse<string>>;
  async complete<T>(
    req: LlmRequest<ZodSchema<T> | undefined>,
    opts?: LlmCallOptions,
  ): Promise<LlmResponse<T | string>> {
    const ctx = getLlmContext();
    if (ctx?.budgetTokens && ctx.used.total >= ctx.budgetTokens) {
      throw new LlmBudgetError(ctx.reportId, ctx.used.total, ctx.budgetTokens);
    }

    const start = Date.now();
    const res = await this.inner.complete(req as LlmRequest<ZodSchema<T>>, opts);
    const latencyMs = Date.now() - start;
    const { promptTokens, completionTokens } = res.usage;

    if (ctx) ctx.used.total += promptTokens + completionTokens;

    if (usageSink) {
      try {
        await usageSink({
          reportId: ctx?.reportId ?? null,
          tag: req.tag ?? null,
          model: res.model,
          provider: this.provider,
          promptTokens,
          completionTokens,
          latencyMs,
          estCostUsd: estimateCostUsd(res.model, promptTokens, completionTokens),
        });
      } catch {
        // never let cost logging break a scan
      }
    }
    return res;
  }
}
