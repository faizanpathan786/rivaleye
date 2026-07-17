import type { LlmCallOptions, LlmClient } from "@rivaleye/shared";
import { synthOutputSchema } from "../prompts/shared";
import type { MergedClusters, PipelineCtx, SynthOutput } from "../prompts/shared";
import { buildRefine } from "../prompts/cross/refine";
import { log } from "../logger.js";

const MAX_TOKENS = 32000;

export interface StageEInput {
  llm: LlmClient;
  ctx: PipelineCtx;
  merged: MergedClusters;
  draft: SynthOutput;
}

export interface StageEOutput {
  refined: SynthOutput;
  fellBackToDraft: boolean;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

function extractJson(raw: string): unknown | undefined {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try recovering truncated JSON by finding the last complete closing brace
    const lastBrace = stripped.lastIndexOf("}");
    if (lastBrace > 0) {
      try {
        return JSON.parse(stripped.slice(0, lastBrace + 1));
      } catch {}
    }
    return undefined;
  }
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function runStageERefine(input: StageEInput, opts?: LlmCallOptions): Promise<StageEOutput> {
  const { system, user } = buildRefine({ ctx: input.ctx, merged: input.merged, draft: input.draft });
  try {
    // Don't pass schema — get raw string and parse ourselves so a single field
    // mismatch or truncated response doesn't suppress the whole refined output.
    const res = await input.llm.complete({ system, user, maxTokens: MAX_TOKENS }, opts);
    const json = extractJson(res.raw);
    if (json === undefined) {
      await log(input.ctx.reportId, "warn", "E", null, "stage E refine failed, falling back to draft", {
        error: `unparseable JSON (${res.raw.length} chars)`,
      });
      return { refined: input.draft, fellBackToDraft: true, usage: res.usage, model: res.model };
    }
    const result = synthOutputSchema.safeParse(json);
    if (!result.success) {
      await log(input.ctx.reportId, "warn", "E", null, "stage E refine failed, falling back to draft", {
        error: result.error.message,
      });
      return { refined: input.draft, fellBackToDraft: true, usage: res.usage, model: res.model };
    }
    return { refined: result.data, fellBackToDraft: false, usage: res.usage, model: res.model };
  } catch (err) {
    await log(input.ctx.reportId, "warn", "E", null, "stage E refine failed, falling back to draft", {
      error: asMessage(err),
    });
    return {
      refined: input.draft,
      fellBackToDraft: true,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "(stage-e-fallback)",
    };
  }
}
