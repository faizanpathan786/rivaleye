# Observability, Reliability & Queue Efficiency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured DB-persisted logging (for UI terminal), LLM retry+timeout, parallel worker batch processing, and checkpoint-resume for the generate-report pipeline.

**Architecture:** New `report_logs` and `report_pipeline_checkpoints` tables via Drizzle migration. A thin `log()` utility in worker writes to both DB and console. `OpenRouterClient.complete()` gains configurable retry with exponential backoff and `AbortSignal` timeout. Worker batch handler flips from serial to parallel. `run.ts` reads/writes checkpoints before each pipeline stage.

**Tech Stack:** Bun, Elysia, Drizzle ORM, pg-boss, PostgreSQL, OpenRouter (HTTP), TypeScript strict mode.

**Spec:** `docs/superpowers/specs/2026-05-16-observability-reliability-design.md`

---

## Task 1: DB schema — report_logs

**Files:**
- Create: `packages/api/src/db/schema/logs.ts`
- Modify: `packages/api/src/db/schema/index.ts`

- [ ] **Step 1: Create the logs schema file**

```ts
// packages/api/src/db/schema/logs.ts
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const log_level_enum = pgEnum("log_level", ["info", "warn", "error"]);

export const report_logs = pgTable(
  "report_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    level: log_level_enum("level").notNull(),
    stage: text("stage"),
    platform: text("platform"),
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("report_logs_report_id_created_at_idx").on(t.report_id, t.created_at)],
);

export type ReportLog = typeof report_logs.$inferSelect;
export type NewReportLog = typeof report_logs.$inferInsert;
```

- [ ] **Step 2: Export from schema index**

Edit `packages/api/src/db/schema/index.ts` — add one line:

```ts
export * from "./users";
export * from "./reports";
export * from "./competitors";
export * from "./mentions";
export * from "./radar";
export * from "./pipeline";
export * from "./logs";
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/db/schema/logs.ts packages/api/src/db/schema/index.ts
git commit -m "feat(schema): add report_logs table"
```

---

## Task 2: DB schema — report_pipeline_checkpoints

**Files:**
- Modify: `packages/api/src/db/schema/pipeline.ts`

- [ ] **Step 1: Add report_pipeline_checkpoints to pipeline.ts**

Open `packages/api/src/db/schema/pipeline.ts` and append after the existing `report_platform_briefs` table definition (keep all existing code, add below):

```ts
export const report_pipeline_checkpoints = pgTable(
  "report_pipeline_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    output: jsonb("output").$type<Record<string, unknown>>().notNull(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_pipeline_checkpoints_report_stage_uniq").on(t.report_id, t.stage),
    index("report_pipeline_checkpoints_report_id_idx").on(t.report_id),
  ],
);

export type ReportPipelineCheckpoint = typeof report_pipeline_checkpoints.$inferSelect;
export type NewReportPipelineCheckpoint = typeof report_pipeline_checkpoints.$inferInsert;
```

Make sure `unique` is imported at the top of the file (it's already imported for `report_platform_jobs` — check and add if missing).

- [ ] **Step 2: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: two new SQL files in `packages/api/drizzle/`. Migration applies cleanly.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/db/schema/pipeline.ts packages/api/drizzle/
git commit -m "feat(schema): add report_pipeline_checkpoints table and migration"
```

---

## Task 3: Worker logger utility

**Files:**
- Create: `packages/worker/src/logger.ts`

- [ ] **Step 1: Create logger.ts**

```ts
// packages/worker/src/logger.ts
import { db } from "./db";
import { report_logs } from "../../api/src/db/schema/logs.js";

export type LogLevel = "info" | "warn" | "error";

export async function log(
  reportId: string,
  level: LogLevel,
  stage: string | null,
  platform: string | null,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const line = [
    `[${level.toUpperCase()}]`,
    stage ? `stage=${stage}` : null,
    platform ? `platform=${platform}` : null,
    `reportId=${reportId}`,
    message,
    meta ? JSON.stringify(meta) : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  try {
    await db.insert(report_logs).values({
      report_id: reportId,
      level,
      stage: stage ?? undefined,
      platform: platform ?? undefined,
      message,
      meta: meta ?? undefined,
    });
  } catch (err) {
    console.error("[logger] failed to persist log entry:", err);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @rivaleye/worker type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/logger.ts
git commit -m "feat(worker): add structured DB-persisted log() utility"
```

---

## Task 4: LLM retry + timeout in OpenRouterClient

**Files:**
- Modify: `packages/shared/src/llm/openrouter.ts`

The existing `callWithRetry` only retries JSON parse (once). This task adds: configurable max attempts, exponential backoff, per-call `AbortSignal` timeout, and retry on transient HTTP errors (429, 5xx).

- [ ] **Step 1: Add LlmCallOptions type and update complete() signature**

Replace the entire `packages/shared/src/llm/openrouter.ts` with:

```ts
import type { ZodSchema } from "zod";
import { LlmHttpError, LlmJsonParseError, LlmSchemaError } from "./errors";

export interface LlmRequest<TSchema extends ZodSchema | undefined = undefined> {
  system: string;
  user: string;
  schema?: TSchema;
  maxTokens?: number;
}

export interface LlmCallOptions {
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface LlmResponse<T> {
  parsed: T;
  raw: string;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export interface OpenRouterClientOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  fetcher?: typeof fetch;
  baseUrl?: string;
}

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_BASE = "https://openrouter.ai/api/v1";
const RETRY_SUFFIX =
  "\n\nReturn ONLY a single valid JSON object that matches the schema. No prose, no markdown fence.";

function isTransient(err: unknown): boolean {
  if (err instanceof LlmHttpError) {
    return err.status === 429 || err.status >= 500;
  }
  if (err instanceof Error) {
    return (
      err.name === "AbortError" ||
      err.name === "TimeoutError" ||
      err.message.includes("ECONNRESET") ||
      err.message.includes("fetch failed")
    );
  }
  return false;
}

function backoffMs(attempt: number): number {
  return Math.min(2 ** attempt * 1000, 30_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: OpenRouterClientOptions) {
    if (!opts.apiKey) throw new Error("OpenRouterClient: apiKey required");
    if (!opts.model) throw new Error("OpenRouterClient: model required");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.temperature = opts.temperature ?? 1.0;
    this.fetcher = opts.fetcher ?? fetch;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  }

  async complete<T>(
    req: LlmRequest<ZodSchema<T>>,
    opts?: LlmCallOptions,
  ): Promise<LlmResponse<T>>;
  async complete(req: LlmRequest, opts?: LlmCallOptions): Promise<LlmResponse<string>>;
  async complete<T>(
    req: LlmRequest<ZodSchema<T> | undefined>,
    opts?: LlmCallOptions,
  ): Promise<LlmResponse<T | string>> {
    const raw = await this.callWithRetry(req.system, req.user, req.maxTokens, opts);
    if (!req.schema) {
      return { parsed: raw.content, raw: raw.content, usage: raw.usage, model: this.model };
    }
    const json = this.parseJson(raw.content);
    const result = req.schema.safeParse(json);
    if (!result.success) {
      throw new LlmSchemaError(result.error.issues.map((i) => i.message), json);
    }
    return { parsed: result.data, raw: raw.content, usage: raw.usage, model: this.model };
  }

  private async callWithRetry(
    system: string,
    user: string,
    maxTokens?: number,
    opts?: LlmCallOptions,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    const maxAttempts = opts?.maxAttempts ?? 3;
    const timeoutMs = opts?.timeoutMs;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const first = await this.callOnce(system, user, maxTokens, timeoutMs);
        if (this.looksLikeJson(first.content)) return first;
        const second = await this.callOnce(system, user + RETRY_SUFFIX, maxTokens, timeoutMs);
        if (this.looksLikeJson(second.content)) return second;
        throw new LlmJsonParseError(second.content);
      } catch (err) {
        lastErr = err;
        if (!isTransient(err)) throw err;
        if (attempt < maxAttempts) await sleep(backoffMs(attempt));
      }
    }
    throw lastErr;
  }

  private async callOnce(
    system: string,
    user: string,
    maxTokens?: number,
    timeoutMs?: number,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined;
    const res = await this.fetcher(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal,
    });
    if (!res.ok) {
      throw new LlmHttpError(res.status, await res.text());
    }
    const data = (await res.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new LlmHttpError(200, "empty content");
    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  private looksLikeJson(s: string): boolean {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  private parseJson(s: string): unknown {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new LlmJsonParseError(s, err);
    }
  }
}
```

- [ ] **Step 2: Verify types across workspace**

```bash
pnpm type-check
```

Expected: no errors. The `opts?: LlmCallOptions` parameter is optional so all existing callers still compile.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/llm/openrouter.ts
git commit -m "feat(shared): add retry + AbortSignal timeout to OpenRouterClient"
```

---

## Task 5: Parallel batch processing + pg-boss job options

**Files:**
- Modify: `packages/worker/src/index.ts`
- Modify: `packages/api/src/libs/queue.ts`

- [ ] **Step 1: Flip serial to parallel in worker index.ts**

Replace the contents of `packages/worker/src/index.ts`:

```ts
import { boss, QUEUES } from "./queue";
import type { ScrapePlatformJob, GenerateReportJob } from "./queue";
import { handleScrapePlatform } from "./jobs/scrape-platform";
import { handleGenerateReport } from "./jobs/generate-report";

async function main() {
  await boss.start();

  await boss.work<ScrapePlatformJob>(
    QUEUES.scrapePlatform,
    { batchSize: 5 },
    async (jobs) => {
      await Promise.allSettled(jobs.map((job) => handleScrapePlatform(job.data)));
    },
  );

  await boss.work<GenerateReportJob>(
    QUEUES.generateReport,
    { batchSize: 1 },
    async (jobs) => {
      for (const job of jobs) await handleGenerateReport(job.data);
    },
  );

  console.log("RivalEye worker started");
}

main().catch((err) => {
  console.error("worker crashed", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add pg-boss job options to queue.ts (api side)**

In `packages/api/src/libs/queue.ts`, update `enqueueScrapePlatform` and `enqueueGenerateReport`:

```ts
export async function enqueueScrapePlatform(job: ScrapePlatformJob) {
  await ensureStarted();
  const id = await boss.send(QUEUES.scrapePlatform, job, {
    retryLimit: 3,
    retryDelay: 30,
    expireInSeconds: 600,
  });
  console.log(`[queue] sent scrape-platform job id=${id}`);
  return id;
}

export async function enqueueGenerateReport(reportId: string) {
  await ensureStarted();
  const id = await boss.send(QUEUES.generateReport, { reportId }, {
    retryLimit: 2,
    retryDelay: 60,
    expireInSeconds: 1800,
  });
  console.log(`[queue] sent generate-report job id=${id}`);
  return id;
}
```

- [ ] **Step 3: Verify types**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/index.ts packages/api/src/libs/queue.ts
git commit -m "feat(worker): parallel scrape-platform batch + pg-boss retry/expiry options"
```

---

## Task 6: Wire logger into scrape-platform and generate-report

**Files:**
- Modify: `packages/worker/src/jobs/scrape-platform.ts`
- Modify: `packages/worker/src/jobs/generate-report.ts`

Replace `console.log`/`console.error` with structured `log()` calls and pass per-stage LLM options.

- [ ] **Step 1: Rewrite scrape-platform.ts**

Replace the full contents of `packages/worker/src/jobs/scrape-platform.ts`:

```ts
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { getScraper } from "@rivaleye/scrapers";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_briefs,
  report_platform_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { boss, QUEUES } from "../queue.js";
import type { ScrapePlatformJob } from "../queue.js";
import { db } from "../db.js";
import { log } from "../logger.js";
import { runStageAExtract } from "../pipeline/stage-a-extract.js";
import { runStageBSummarize } from "../pipeline/stage-b-summarize.js";
import { and, eq } from "drizzle-orm";

const CHUNK_SIZE = 500;

const LLM_OPTS_AB = { timeoutMs: 45_000, maxAttempts: 3 };

let _llm: OpenRouterClient | null = null;

function getLlm(): OpenRouterClient {
  if (!_llm) {
    _llm = new OpenRouterClient({
      apiKey: readOpenRouterApiKey(),
      model: LLM_MODEL,
    });
  }
  return _llm;
}

export async function handleScrapePlatform(data: ScrapePlatformJob): Promise<void> {
  const { reportId, platform, competitor } = data;

  await log(reportId, "info", "scrape", platform, `start competitor="${competitor}"`);
  await markRunning(reportId, platform);

  try {
    const report = await loadReport(reportId);

    const scraper = getScraper(platform);
    const posts = await scraper.fetch({
      competitor,
      category: data.category,
      keywords: data.keywords,
    });

    await log(reportId, "info", "scrape", platform, `fetched posts`, { postCount: posts.length });

    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      const chunk = posts.slice(i, i + CHUNK_SIZE);
      await db
        .insert(mentions)
        .values(
          chunk.map((p) => ({
            report_id: reportId,
            platform: p.platform,
            external_id: p.externalId,
            url: p.url,
            author: p.author,
            title: p.title,
            body: p.body,
            score: p.score,
            num_comments: p.numComments,
            posted_at: p.createdAt,
            raw: p.raw as Record<string, unknown>,
          })),
        )
        .onConflictDoNothing();
    }

    await db
      .update(reports)
      .set({ status: "running", updated_at: new Date() })
      .where(eq(reports.id, reportId));

    if (posts.length > 0) {
      const llm = getLlm();
      const ctx = {
        reportId,
        competitor,
        category: data.category ?? "",
        audience: report.audience ?? null,
        goal: report.goal,
      };

      const stageA = await runStageAExtract({ llm, ctx, platform, posts }, LLM_OPTS_AB);
      await log(reportId, "info", "A", platform, `stage A done`, {
        promptTokens: stageA.usage.promptTokens,
        completionTokens: stageA.usage.completionTokens,
      });

      const stageB = await runStageBSummarize(
        { llm, ctx, platform, extract: stageA.extract },
        LLM_OPTS_AB,
      );
      await log(reportId, "info", "B", platform, `stage B done`, {
        promptTokens: stageB.usage.promptTokens,
        completionTokens: stageB.usage.completionTokens,
      });

      const totalPrompt = stageA.usage.promptTokens + stageB.usage.promptTokens;
      const totalCompletion = stageA.usage.completionTokens + stageB.usage.completionTokens;

      await db
        .insert(report_platform_briefs)
        .values({
          report_id: reportId,
          platform,
          extract: stageA.extract as Record<string, unknown>,
          summary: stageB.brief as Record<string, unknown>,
          model_used: stageB.model,
          prompt_tokens: totalPrompt,
          completion_tokens: totalCompletion,
        })
        .onConflictDoNothing();
    }

    await markCompleted(reportId, platform);
    await fanIn(reportId);
  } catch (err) {
    await log(reportId, "error", "scrape", platform, `failed: ${asMessage(err)}`);
    await markFailed(reportId, platform, asMessage(err));
    await fanIn(reportId);
    throw err;
  }
}

async function loadReport(reportId: string) {
  const rows = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) throw new Error(`Report ${reportId} not found`);
  return report;
}

async function markRunning(reportId: string, platform: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "running", started_at: new Date() })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

async function markCompleted(reportId: string, platform: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "completed", completed_at: new Date() })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

async function markFailed(reportId: string, platform: string, error: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "failed", error, completed_at: new Date() })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

async function fanIn(reportId: string): Promise<void> {
  const rows = await db
    .select({ status: report_platform_jobs.status })
    .from(report_platform_jobs)
    .where(eq(report_platform_jobs.report_id, reportId));

  const stillActive = rows.filter((r) => r.status === "queued" || r.status === "running");

  if (stillActive.length === 0) {
    await boss.send(QUEUES.generateReport, { reportId });
    await log(reportId, "info", "scrape", null, `fan-in: enqueued generate-report`);
  } else {
    await log(reportId, "info", "scrape", null, `fan-in: waiting`, {
      stillActive: stillActive.length,
    });
  }
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
```

- [ ] **Step 2: Rewrite generate-report.ts**

Replace the full contents of `packages/worker/src/jobs/generate-report.ts`:

```ts
import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { log } from "../logger.js";
import { runPipeline } from "../pipeline/run";

export async function handleGenerateReport(data: GenerateReportJob): Promise<void> {
  const { reportId } = data;
  await log(reportId, "info", null, null, `generate-report start`);

  try {
    await runPipeline(reportId);

    await db
      .update(reports)
      .set({ stage: "done", status: "completed", updated_at: new Date() })
      .where(eq(reports.id, reportId));

    await log(reportId, "info", null, null, `generate-report done: status=completed`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "unknown_error";
    await log(reportId, "error", null, null, `generate-report failed`, { error: errorMsg });

    await db
      .update(reports)
      .set({ stage: "failed", status: "failed", error: errorMsg, updated_at: new Date() })
      .where(eq(reports.id, reportId));

    throw err;
  }
}
```

- [ ] **Step 3: Verify types**

```bash
pnpm --filter @rivaleye/worker type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/jobs/scrape-platform.ts packages/worker/src/jobs/generate-report.ts
git commit -m "feat(worker): wire structured logger into scrape-platform and generate-report jobs"
```

---

## Task 7: Pass LlmCallOptions through stage-a and stage-b

The stage A and B runner functions need to accept and forward `LlmCallOptions` to `llm.complete()`.

**Files:**
- Modify: `packages/worker/src/pipeline/stage-a-extract.ts`
- Modify: `packages/worker/src/pipeline/stage-b-summarize.ts`

- [ ] **Step 1: Read stage-a-extract.ts**

Read the current file to understand its `llm.complete()` call signature.

- [ ] **Step 2: Add opts parameter to runStageAExtract**

In `packages/worker/src/pipeline/stage-a-extract.ts`, import `LlmCallOptions` and add `opts?` to the function signature and forward to `llm.complete()`:

```ts
import type { LlmCallOptions } from "@rivaleye/shared";

// Change the function signature:
export async function runStageAExtract(input: StageAInput, opts?: LlmCallOptions): Promise<StageAOutput> {
  // ... existing code ...
  const res = await input.llm.complete({ system: built.system, user: built.user, schema: built.schema }, opts);
  // ...
}
```

- [ ] **Step 3: Add opts parameter to runStageBSummarize**

Same pattern in `packages/worker/src/pipeline/stage-b-summarize.ts`:

```ts
import type { LlmCallOptions } from "@rivaleye/shared";

export async function runStageBSummarize(input: StageBInput, opts?: LlmCallOptions): Promise<StageBOutput> {
  // ... existing code ...
  const res = await input.llm.complete({ system: built.system, user: built.user, schema: built.schema }, opts);
  // ...
}
```

- [ ] **Step 4: Verify types**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/pipeline/stage-a-extract.ts packages/worker/src/pipeline/stage-b-summarize.ts
git commit -m "feat(worker): thread LlmCallOptions through stage-a and stage-b"
```

---

## Task 8: Checkpoint-resume in run.ts

**Files:**
- Modify: `packages/worker/src/pipeline/run.ts`
- Modify: `packages/worker/src/pipeline/stage-c-merge.ts`
- Modify: `packages/worker/src/pipeline/stage-d-synth.ts`

Add `LlmCallOptions` forwarding to stages C/D, and add checkpoint-resume logic in `run.ts`.

- [ ] **Step 1: Add opts to stage-c-merge.ts**

Read `packages/worker/src/pipeline/stage-c-merge.ts`. Add `LlmCallOptions` to the `runStageCMerge` signature and forward to `llm.complete()`:

```ts
import type { LlmCallOptions } from "@rivaleye/shared";

export async function runStageCMerge(input: StageCInput, opts?: LlmCallOptions): Promise<StageCOutput> {
  const built = buildMerge({ ctx: input.ctx, briefs: input.briefs, extracts: input.extracts });
  try {
    const res = await input.llm.complete(
      { system: built.system, user: built.user, schema: built.schema },
      opts,
    );
    return { merged: res.parsed as MergedClusters, usage: res.usage, model: res.model };
  } catch (err) {
    throw new PipelineError("C", "merge failed", err);
  }
}
```

- [ ] **Step 2: Add opts to stage-d-synth.ts**

Read `packages/worker/src/pipeline/stage-d-synth.ts`. Apply same pattern:

```ts
import type { LlmCallOptions } from "@rivaleye/shared";

export async function runStageDSynth(input: StageDInput, opts?: LlmCallOptions): Promise<StageDOutput> {
  // forward opts to llm.complete(...)
}
```

- [ ] **Step 3: Rewrite run.ts with checkpoint-resume and logger**

Replace the full contents of `packages/worker/src/pipeline/run.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import {
  report_platform_briefs,
  report_pipeline_checkpoints,
} from "../../../api/src/db/schema/pipeline.js";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { log } from "../logger.js";
import { runStageCMerge } from "./stage-c-merge";
import { runStageDSynth } from "./stage-d-synth";
import { runStageERefine } from "./stage-e-refine";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";
import { persistReport } from "./persist";
import { PipelineError } from "./errors";
import type { PipelineCtx, PlatformBrief, PlatformExtract, MergedClusters, SynthOutput } from "../prompts/shared";

const LLM_OPTS_C = { timeoutMs: 60_000, maxAttempts: 3 };
const LLM_OPTS_D = { timeoutMs: 90_000, maxAttempts: 3 };
const LLM_OPTS_E = { timeoutMs: 90_000, maxAttempts: 2 };

let _llm: OpenRouterClient | null = null;

function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

async function loadCheckpoints(reportId: string): Promise<Map<string, Record<string, unknown>>> {
  const rows = await db
    .select()
    .from(report_pipeline_checkpoints)
    .where(eq(report_pipeline_checkpoints.report_id, reportId));
  return new Map(rows.map((r) => [r.stage, r.output]));
}

async function saveCheckpoint(
  reportId: string,
  stage: string,
  output: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(report_pipeline_checkpoints)
    .values({ report_id: reportId, stage, output })
    .onConflictDoUpdate({
      target: [report_pipeline_checkpoints.report_id, report_pipeline_checkpoints.stage],
      set: { output, created_at: new Date() },
    });
}

export async function runPipeline(reportId: string): Promise<void> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) throw new PipelineError("C", `report ${reportId} not found`);

  const briefRows = await db
    .select()
    .from(report_platform_briefs)
    .where(eq(report_platform_briefs.report_id, reportId));

  if (briefRows.length === 0) {
    throw new PipelineError("C", `no platform briefs found for report ${reportId}`);
  }

  const briefs: PlatformBrief[] = briefRows.map((row) => row.summary as unknown as PlatformBrief);
  const extracts: PlatformExtract[] = briefRows.map(
    (row) => row.extract as unknown as PlatformExtract,
  );

  const ctx: PipelineCtx = {
    reportId: report.id,
    competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
    category: report.category,
    audience: report.audience ?? null,
    goal: report.goal,
  };

  await db
    .update(reports)
    .set({ stage: "clustering", updated_at: new Date() })
    .where(eq(reports.id, reportId));

  const llm = getLlm();
  const checkpoints = await loadCheckpoints(reportId);

  // Stage C
  let merged: MergedClusters;
  if (checkpoints.has("C")) {
    await log(reportId, "info", "C", null, "skipping stage C (checkpoint found)");
    merged = checkpoints.get("C") as unknown as MergedClusters;
  } else {
    await log(reportId, "info", "C", null, "running stage C: merge");
    const resultC = await runStageCMerge({ llm, ctx, briefs, extracts }, LLM_OPTS_C);
    await log(reportId, "info", "C", null, "stage C done", {
      promptTokens: resultC.usage.promptTokens,
      completionTokens: resultC.usage.completionTokens,
    });
    merged = resultC.merged;
    await saveCheckpoint(reportId, "C", merged as unknown as Record<string, unknown>);
  }

  // Stage D
  let synth: SynthOutput;
  if (checkpoints.has("D")) {
    await log(reportId, "info", "D", null, "skipping stage D (checkpoint found)");
    synth = checkpoints.get("D") as unknown as SynthOutput;
  } else {
    await log(reportId, "info", "D", null, "running stage D: synth");
    const resultD = await runStageDSynth({ llm, ctx, merged }, LLM_OPTS_D);
    await log(reportId, "info", "D", null, "stage D done", {
      promptTokens: resultD.usage.promptTokens,
      completionTokens: resultD.usage.completionTokens,
    });
    synth = resultD.synth;
    await saveCheckpoint(reportId, "D", synth as unknown as Record<string, unknown>);
  }

  // Stage E
  let refined: SynthOutput;
  if (checkpoints.has("E")) {
    await log(reportId, "info", "E", null, "skipping stage E (checkpoint found)");
    refined = checkpoints.get("E") as unknown as SynthOutput;
  } else {
    await log(reportId, "info", "E", null, "running stage E: refine");
    const resultE = await runStageERefine({ llm, ctx, merged, draft: synth }, LLM_OPTS_E);
    if (resultE.fellBackToDraft) {
      await log(reportId, "warn", "E", null, "stage E fell back to draft output");
    } else {
      await log(reportId, "info", "E", null, "stage E done", {
        promptTokens: resultE.usage.promptTokens,
        completionTokens: resultE.usage.completionTokens,
      });
    }
    refined = resultE.refined;
    await saveCheckpoint(reportId, "E", refined as unknown as Record<string, unknown>);
  }

  const mentionRows = await db
    .select({ platform: mentions.platform, raw: mentions.raw })
    .from(mentions)
    .where(eq(mentions.report_id, reportId));

  const platformStats = computePlatformStats(mentionRows);
  const subreddits = computeSubredditStats(mentionRows);

  await log(reportId, "info", "persist", null, "persisting report to sub-tables");
  await persistReport({ reportId, synth: refined, platformStats, subreddits });
  await log(reportId, "info", "persist", null, "persist done");
}
```

- [ ] **Step 4: Update stage-e-refine to accept LlmCallOptions**

In `packages/worker/src/pipeline/stage-e-refine.ts`, add `LlmCallOptions` parameter:

```ts
import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { MergedClusters, PipelineCtx, SynthOutput } from "../prompts/shared";
import { buildRefine } from "../prompts/cross/refine";

const MAX_TOKENS = 16000;

export interface StageEInput {
  llm: OpenRouterClient;
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

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function runStageERefine(
  input: StageEInput,
  opts?: LlmCallOptions,
): Promise<StageEOutput> {
  const built = buildRefine({ ctx: input.ctx, merged: input.merged, draft: input.draft });
  try {
    const res = await input.llm.complete(
      { system: built.system, user: built.user, schema: built.schema, maxTokens: MAX_TOKENS },
      opts,
    );
    return {
      refined: res.parsed as SynthOutput,
      fellBackToDraft: false,
      usage: res.usage,
      model: res.model,
    };
  } catch (err) {
    console.warn(`Stage E refine failed, falling back to draft: ${asMessage(err)}`);
    return {
      refined: input.draft,
      fellBackToDraft: true,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "(stage-e-fallback)",
    };
  }
}
```

- [ ] **Step 5: Verify types**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/pipeline/run.ts \
        packages/worker/src/pipeline/stage-c-merge.ts \
        packages/worker/src/pipeline/stage-d-synth.ts \
        packages/worker/src/pipeline/stage-e-refine.ts
git commit -m "feat(worker): checkpoint-resume for pipeline stages C/D/E + per-stage LLM options"
```

---

## Task 9: GET /reports/:id/logs API endpoint

**Files:**
- Modify: `packages/api/src/services/reports.service.ts`
- Create: `packages/api/src/controllers/reports/handlers/getLogs.ts`
- Modify: `packages/api/src/controllers/reports/index.ts`

- [ ] **Step 1: Add getLogs to reports.service.ts**

Open `packages/api/src/services/reports.service.ts` and add this function (import `report_logs` from `@/db/schema/logs`):

```ts
import { report_logs } from "@/db/schema/logs";
import { gt } from "drizzle-orm";

export async function getLogs(reportId: string, ownerId: string, since?: string) {
  const report = await assertReportOwned(reportId, ownerId);
  if (!report) return null;

  const conditions = [eq(report_logs.report_id, reportId)];
  if (since) {
    conditions.push(gt(report_logs.created_at, new Date(since)));
  }

  return db
    .select({
      id: report_logs.id,
      level: report_logs.level,
      stage: report_logs.stage,
      platform: report_logs.platform,
      message: report_logs.message,
      meta: report_logs.meta,
      created_at: report_logs.created_at,
    })
    .from(report_logs)
    .where(and(...conditions))
    .orderBy(asc(report_logs.created_at));
}
```

- [ ] **Step 2: Create the handler**

Create `packages/api/src/controllers/reports/handlers/getLogs.ts`:

```ts
import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getLogs } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getLogsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/logs",
    async ({ log, params, query, user, status }) => {
      try {
        const result = await getLogs(params.id, user!.id, query.since);
        if (result === null)
          return status(404, { message: "Report not found", error: "REPORT_NOT_FOUND" });
        return ok(result);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch report logs",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      query: t.Object({ since: t.Optional(t.String()) }),
      detail: { tags: [Tags.REPORTS], summary: "Get report pipeline logs" },
    },
  );
```

- [ ] **Step 3: Mount in reports controller**

In `packages/api/src/controllers/reports/index.ts`, add the import and `.use()` call:

```ts
import { getLogsHandler } from "./handlers/getLogs";

// add inside the Elysia chain:
.use(getLogsHandler)
```

- [ ] **Step 4: Verify types**

```bash
pnpm --filter @rivaleye/api type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/reports.service.ts \
        packages/api/src/controllers/reports/handlers/getLogs.ts \
        packages/api/src/controllers/reports/index.ts
git commit -m "feat(api): add GET /reports/:id/logs endpoint for UI terminal polling"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `report_logs` table — Task 1
- ✅ `report_pipeline_checkpoints` table — Task 2
- ✅ Worker logger utility — Task 3
- ✅ LLM retry + exponential backoff + AbortSignal timeout — Task 4
- ✅ Per-stage LLM options (timeouts/attempts) — Tasks 7 + 8
- ✅ Stage E fallback wired + logged — Task 8
- ✅ Parallel scrape-platform batch — Task 5
- ✅ pg-boss retryLimit + expireInSeconds — Task 5
- ✅ Checkpoint-resume in run.ts — Task 8
- ✅ GET /logs API endpoint — Task 9
- ✅ Logger wired into jobs — Task 6

**Type consistency check:**
- `LlmCallOptions` defined in Task 4, used consistently in Tasks 7, 8 ✅
- `log()` signature defined in Task 3, called with same arg order in Tasks 6, 8 ✅
- `report_pipeline_checkpoints` defined in Task 2, imported in `run.ts` in Task 8 ✅
- `report_logs` defined in Task 1, imported in logger (Task 3) and service (Task 9) ✅
- `saveCheckpoint` uses `onConflictDoUpdate` targeting `[report_id, stage]` — matches unique constraint in Task 2 ✅

**No placeholders:** All steps contain complete code. ✅
