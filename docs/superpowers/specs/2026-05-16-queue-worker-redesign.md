# Queue System + Worker Architecture Redesign

**Date:** 2026-05-16
**Status:** Approved, awaiting implementation plan
**Owner:** Ayman

## 1. Problem

Current pg-boss-based pipeline is unreliable across the board:

- Jobs sometimes silently fail; errors swallowed inside batched worker loop.
- Fan-in from per-platform scrape to `generate-report` drifts out of sync with `report_platform_jobs` state.
- No visibility into which stage a report is stuck on.
- Retries either don't fire or loop forever on permanent errors.
- One worker process runs everything; a crash kills scrape + LLM + synth together.
- Scrape and LLM share the same concurrency budget; rate-limited LLM calls starve fast network scrapes (and vice versa).

Result: reports stall, no signal to the UI, and debugging requires reading server logs.

## 2. Goals

1. **Durable per-stage execution** — every stage checkpoints. A crash mid-report resumes from the last completed step, not from scratch.
2. **Per-role concurrency** — scrape, LLM, and synth tuned independently. LLM rate limits do not block scrapes; scrapes do not flood the LLM provider.
3. **Crash isolation** — one worker process crashing must not take the others down.
4. **Quality before throughput** — partial reports allowed, but no silent skips; every failure is recorded and surfaceable in UI.
5. **Full observability** — every stage transition writes a row to `pipeline_events`. UI can render a live timeline driven by DB state.
6. **Manual retry** — user can retry an individual failed platform from the UI; synth re-runs after.
7. **Local-first** — runs on a single developer machine with `pnpm dev` plus one extra long-running CLI (`inngest dev`). No Redis, no Docker required.

## 3. Non-goals

- Cloud deployment story. This spec is local-only; production hosting is a later spec.
- Cross-report priorities or SLA tiers.
- Replacing the existing pipeline stage code (Stage A/B/C/D/E logic). Only the orchestration around it changes.
- Replacing the existing `report_platform_jobs` table. It is extended, not removed.

## 4. High-level architecture

Three Bun worker processes, one queue (Inngest dev server locally), Postgres as state store.

```
┌──────────┐   POST /reports    ┌──────────────┐
│   web    │ ─────────────────▶ │     api      │
└──────────┘                    └──────┬───────┘
                                       │ inngest.send(scrape.fetch ×8)
                                       ▼
                            ┌──────────────────────┐
                            │ Inngest (local dev)  │
                            │  - durable steps     │
                            │  - retries           │
                            │  - dev UI :8288      │
                            └──┬───────┬───────┬───┘
                               │       │       │
                  ┌────────────┘       │       └──────────────┐
                  ▼                    ▼                      ▼
          ┌──────────────┐     ┌──────────────┐      ┌──────────────┐
          │ worker-scrape│     │  worker-llm  │      │ worker-synth │
          │ concurrency:8│     │ concurrency:4│      │ concurrency:1│
          │ scrape.fetch │     │ llm.stage-a  │      │  synth.run   │
          │              │     │ llm.stage-b  │      │              │
          └──────┬───────┘     └──────┬───────┘      └──────┬───────┘
                 │                    │                     │
                 └────────────────────┴─────────────────────┘
                                  ▼
                          ┌──────────────┐
                          │  Postgres    │
                          │ - mentions   │
                          │ - report_*   │
                          │ - pipeline_  │
                          │   events     │
                          └──────────────┘
```

## 5. Job topology

```
createReport (API)
  └─ inngest.send: scrape.fetch ×8 (one per platform)
       │
       ▼ worker-scrape (concurrency 8 global; 1 per (reportId, platform))
       scrape.fetch:
         - step.run "emit-started"
         - step.run "fetch" — call scraper, return raw mentions
         - step.run "persist" — write mentions to DB
         - step.run "mark-stage" — report_platform_jobs.stage = 'stage_a'
         - step.sendEvent — llm.stage-a
       │
       ▼ worker-llm (concurrency 4 global)
       llm.stage-a:
         - extract per platform
         - mark stage = 'stage_b'
         - sendEvent llm.stage-b
       llm.stage-b:
         - summarize per platform
         - mark status = 'completed', stage = 'done'
         - call fanInCheck(reportId)
              ↳ advisory lock + read jobs + send synth.run if all terminal
       │
       ▼ worker-synth (concurrency 1 per reportId)
       synth.run:
         - step.run stage-c-merge
         - step.run stage-d-synth
         - step.run stage-e-refine
         - step.run persist
         - mark reports.status = 'completed' (set partial flag if any failed)
```

### 5.1 Job types and payloads

Defined in `packages/shared/src/inngest-events.ts`:

```ts
export type RivalEyeEvents = {
  "scrape.fetch":  { data: { reportId: string; platform: PlatformId; keywords: string[] } };
  "llm.stage-a":   { data: { reportId: string; platform: PlatformId } };
  "llm.stage-b":   { data: { reportId: string; platform: PlatformId } };
  "synth.run":     { data: { reportId: string } };
};
```

### 5.2 Idempotency

Each Inngest function declares an `idempotency` key built from the event payload:

- `scrape.fetch`: `reportId + ":" + platform`
- `llm.stage-a` / `llm.stage-b`: `reportId + ":" + platform + ":" + stage`
- `synth.run`: `reportId`

Inngest deduplicates events with the same key within a 24h window. Combined with `step.run` checkpointing, replays are safe: each step result is cached and skipped on retry.

Additionally, all DB writes use upsert / conditional update semantics:
- mentions: `ON CONFLICT (platform, external_id) DO NOTHING`
- `report_platform_jobs`: `UPDATE … WHERE status NOT IN ('completed','failed')` so terminal rows are not reopened by a stale retry.

## 6. Process model

Three independent Bun processes, each serving an Inngest endpoint:

| Process       | File                                      | Port  | Functions registered    | Concurrency |
|---------------|-------------------------------------------|-------|-------------------------|-------------|
| worker-scrape | `packages/worker/src/scrape/index.ts`     | 3100  | `scrape.fetch`          | 8 global    |
| worker-llm    | `packages/worker/src/llm/index.ts`        | 3101  | `llm.stage-a`, `llm.stage-b` | 4 global |
| worker-synth  | `packages/worker/src/synth/index.ts`      | 3102  | `synth.run`             | 1 per `reportId` |

Each entry point:

```ts
import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { scrapeFetch } from "./fetch";

Bun.serve({
  port: Number(process.env.WORKER_PORT ?? 3100),
  fetch: serve({ client: inngest, functions: [scrapeFetch] }).fetch,
});
```

`packages/worker/package.json`:

```json
"scripts": {
  "dev:scrape": "bun --watch src/scrape/index.ts",
  "dev:llm":    "bun --watch src/llm/index.ts",
  "dev:synth":  "bun --watch src/synth/index.ts",
  "dev":        "concurrently -n scrape,llm,synth -c blue,green,yellow \"pnpm dev:scrape\" \"pnpm dev:llm\" \"pnpm dev:synth\""
}
```

Local dev requires one extra terminal (or a Procfile entry): `npx inngest-cli@latest dev`. The CLI auto-discovers the three local endpoints and exposes a UI at `http://localhost:8288`.

## 7. DB schema changes

### 7.1 Extend `report_platform_jobs`

```sql
ALTER TABLE report_platform_jobs
  ADD COLUMN stage           text          NOT NULL DEFAULT 'scrape',
  ADD COLUMN attempt_count   int           NOT NULL DEFAULT 0,
  ADD COLUMN last_error      text,
  ADD COLUMN last_event_at   timestamptz;
```

Allowed `stage` values: `'scrape' | 'stage_a' | 'stage_b' | 'done' | 'failed'`.
Existing `status` enum unchanged: `'pending' | 'running' | 'completed' | 'failed'`.
Invariant: `status = 'completed'` only when `stage = 'done'`. `status = 'failed'` only when `stage = 'failed'`.

### 7.2 New `pipeline_events` table

```sql
CREATE TABLE pipeline_events (
  id           bigserial    PRIMARY KEY,
  report_id    uuid         NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  platform     text,
  stage        text         NOT NULL,
  event        text         NOT NULL,
  attempt      int          NOT NULL DEFAULT 1,
  duration_ms  int,
  error        text,
  metadata     jsonb,
  created_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX pipeline_events_report_id_idx
  ON pipeline_events(report_id, created_at DESC);
```

Allowed `event` values: `'started' | 'completed' | 'failed' | 'retrying'`.
Allowed `stage` values: `'scrape.fetch' | 'llm.stage_a' | 'llm.stage_b' | 'synth.run'`.
Append-only. Drives the live UI timeline and is the canonical source for "what happened, when, for how long, with what error".

### 7.3 Extend `reports`

```sql
ALTER TABLE reports
  ADD COLUMN partial          boolean   NOT NULL DEFAULT false,
  ADD COLUMN failed_platforms text[]    NOT NULL DEFAULT '{}';
```

Set by `synth.run` when one or more platforms ended in `stage = 'failed'`.

All schema changes go through Drizzle (`pnpm db:generate`, `pnpm db:migrate`) per project rule #1.

## 8. Failure + retry semantics

### 8.1 Error classes

`packages/worker/src/pipeline/errors.ts` (extends existing):

```ts
export class TransientError extends Error {}
export class PermanentError extends Error {}
export class RateLimitError extends TransientError {
  constructor(message: string, public retryAfterMs: number) { super(message); }
}
```

Each Inngest function wraps its handler:
- `PermanentError` → rethrow as Inngest `NonRetriableError`, mark platform `failed`, fan-in check.
- `RateLimitError` → honor `retryAfterMs` via `step.sleep`, then throw to let Inngest retry.
- Anything else → throw, Inngest applies the function's retry policy.

### 8.2 Per-stage retry policy

| Stage          | Retries | Backoff schedule         | After exhaustion                                      |
|----------------|---------|--------------------------|-------------------------------------------------------|
| `scrape.fetch` | 3       | exp 30s / 2m / 10m       | mark platform `failed`, fan-in check                  |
| `llm.stage-a`  | 4       | exp 10s / 30s / 2m / 5m  | mark platform `failed`, fan-in check                  |
| `llm.stage-b`  | 4       | exp 10s / 30s / 2m / 5m  | mark platform `failed`, fan-in check                  |
| `synth.run`    | 2       | exp 1m / 5m              | mark report `failed`, emit `failed` event             |

Rationale: scrapes fail for network/auth reasons that rarely resolve quickly. LLM failures are mostly rate-limit/transient. Synth is expensive; failing fast is better than burning tokens.

### 8.3 Fan-in (Postgres advisory lock)

Called at the end of `llm.stage-b` on success, and from the failure handler after marking a platform `failed`:

```ts
async function fanInCheck(reportId: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);
    const jobs = await tx.select().from(reportPlatformJobs).where(eq(reportPlatformJobs.reportId, reportId));
    const allTerminal = jobs.every((j) => j.status === "completed" || j.status === "failed");
    if (!allTerminal) return;

    const already = await tx.select({ id: pipelineEvents.id })
      .from(pipelineEvents)
      .where(and(
        eq(pipelineEvents.reportId, reportId),
        eq(pipelineEvents.stage, "synth.run"),
        eq(pipelineEvents.event, "started"),
      ))
      .limit(1);
    if (already.length > 0) return;

    await inngest.send({ name: "synth.run", data: { reportId } });
  });
}
```

The advisory lock guarantees only one concurrent fan-in caller wins. The "already started" guard prevents re-enqueue if a stale stage-b retry runs after synth has begun.

### 8.4 Partial reports

If at least one platform completed and at least one failed, `synth.run` proceeds with the successful platforms only. After synthesis:

```ts
await db.update(reports).set({
  status: "completed",
  partial: failedPlatforms.length > 0,
  failed_platforms: failedPlatforms,
}).where(eq(reports.id, reportId));
```

If all eight platforms failed, `synth.run` is not enqueued; the report is marked `failed` with `failed_platforms` populated.

### 8.5 Manual retry

`POST /reports/:id/retry-platform` body `{ platform }`:

1. Guard: report `status` is `completed` (partial) or `failed`.
2. Reset row: `report_platform_jobs.status = 'pending'`, `stage = 'scrape'`, `attempt_count = 0`, `last_error = null`.
3. `inngest.send({ name: "scrape.fetch", data: { reportId, platform, keywords } })`.
4. On stage-b completion, fan-in fires; because `synth.run` was previously recorded as `completed`, the guard in `fanInCheck` must be relaxed for retries: if the report is in a terminal state and a new platform just finished, send `synth.run` again to regenerate.

Retry policy guard: refuse if a `scrape.fetch` for this `(reportId, platform)` is currently `running` per `report_platform_jobs.status`.

### 8.6 Cancellation

`POST /reports/:id/cancel`:
- Set `reports.status = 'cancelled'`.
- All running Inngest functions check `reports.status` at each `step.run` boundary; on `cancelled`, throw `NonRetriableError("cancelled")`.

## 9. Observability

### 9.1 `pipeline_events` is the single source of truth

Every function emits at minimum:
- one `started` row at the top of the function (before the first business step),
- one `completed` row at the end with `duration_ms` and `metadata` (mention counts, token counts),
- on caught error, one `failed` row with `error`,
- between retries, one `retrying` row with `attempt` incremented.

Emission is itself a `step.run` so it survives retries without duplication.

### 9.2 Logs

Structured pino logger:

```ts
log.info({ reportId, platform, stage, attempt, duration_ms }, "stage completed");
```

One log line per `pipeline_events` row. Logs are for live tailing; the DB table is for replay.

### 9.3 Inngest dev UI

`http://localhost:8288` shows every run, every step result, every retry, with a replay button. Primary debugging surface during local development.

## 10. API + UI changes

### 10.1 `packages/api/src/services/reports.service.ts`

In `createReport`:
- Remove the `boss.send` loop.
- Insert 8 `report_platform_jobs` rows in `pending` state as today.
- `await inngest.send([...8 scrape.fetch events])`.

Extend `getProgress` response:

```ts
{
  report: {
    id: string;
    status: 'pending'|'running'|'completed'|'failed'|'cancelled';
    partial: boolean;
    failed_platforms: PlatformId[];
  };
  platforms: Array<{
    platform: PlatformId;
    status: 'pending'|'running'|'completed'|'failed';
    stage:  'scrape'|'stage_a'|'stage_b'|'done'|'failed';
    attempt_count: number;
    last_error: string | null;
    last_event_at: string | null;
  }>;
  events: Array<{
    stage: string;
    event: 'started'|'completed'|'failed'|'retrying';
    platform: PlatformId | null;
    attempt: number;
    duration_ms: number | null;
    created_at: string;
  }>; // last 20 events, newest first
  metrics: { mentions: number; complaints: number; quotes: number; comments: number };
}
```

### 10.2 New endpoints

- `POST /reports/:id/retry-platform` body `{ platform: PlatformId }`
- `POST /reports/:id/cancel`

Both gated by existing permission system: require `REPORTS_CREATE`.

### 10.3 New shared client

`packages/api/src/libs/inngest.ts`:

```ts
import { Inngest } from "inngest";
import type { RivalEyeEvents } from "@rivaleye/shared";
export const inngest = new Inngest<RivalEyeEvents>({
  id: "rivaleye-api",
  eventKey: process.env.INNGEST_EVENT_KEY, // dev: unused
});
```

Same client (different `id`) instantiated once per worker process.

### 10.4 Web

`packages/web/src/components/report/report-in-progress.tsx` (the existing 481-line ScanRunning):
- Live log section renders `events[]` from `/progress`. Newest event at the bottom; one line per event.
- Per-platform "Retry" button when `platform.status === 'failed'`; calls `POST /reports/:id/retry-platform`.
- Partial-report banner on the completed report view when `report.partial === true`, listing `failed_platforms` with per-platform retry buttons.

## 11. Removals

- `packages/worker/src/queue.ts` (pg-boss client).
- `packages/worker/src/index.ts` (single-process entry).
- `packages/worker/src/jobs/` (replaced by `scrape/`, `llm/`, `synth/`).
- `pg-boss` dependency from `packages/worker/package.json` and `packages/api/package.json`.
- `packages/api/CLAUDE.md` and `packages/worker/CLAUDE.md` references to pg-boss → updated to Inngest.

## 12. Final package layout (worker)

```
packages/worker/
  package.json
  src/
    inngest/
      client.ts          ← shared Inngest client + serve helpers
    scrape/
      index.ts           ← Bun.serve, registers [scrapeFetch]
      fetch.ts           ← scrape.fetch function
    llm/
      index.ts           ← Bun.serve, registers [stageA, stageB]
      stage-a.ts
      stage-b.ts
      fan-in.ts          ← advisory-lock fan-in helper
    synth/
      index.ts           ← Bun.serve, registers [synthRun]
      run.ts
    pipeline/            ← unchanged stage code (stage-a-extract.ts, ...)
    events/
      emit.ts            ← writes pipeline_events row + pino log
    db/
      pipeline-events.ts
      report-jobs.ts
```

```
packages/shared/src/
  inngest-events.ts      ← RivalEyeEvents type, payload schemas
```

## 13. Acceptance criteria

1. New report creation enqueues 8 `scrape.fetch` events; all 8 visible in Inngest dev UI within 1s.
2. Killing `worker-scrape` mid-run does not lose any in-flight scrape: on restart, Inngest replays the function and `step.run` checkpoints skip already-completed steps.
3. Forcing one platform scraper to throw `PermanentError` results in: that platform marked `failed`, the other 7 succeed, `synth.run` fires with 7 platforms, `reports.partial = true`, `failed_platforms = ['<that one>']`.
4. UI live timeline shows ≥1 event per stage transition (`started`/`completed`/`failed`).
5. UI per-platform retry button on a failed platform re-runs scrape → stage-a → stage-b → synth; final report updates with the previously failed platform now included and `partial = false`.
6. Killing `worker-llm` while a stage-a is running: function shows `retrying` in dev UI, succeeds after worker restart, no duplicate Stage A output written.
7. Two concurrent reports do not block each other; scrape concurrency is 8 across all reports, synth is 1 per `reportId`.
8. `pg-boss` removed from both package manifests; `pnpm install` clean; type-check clean.

## 14. Open questions

None. All design decisions resolved during brainstorming session 2026-05-16.

## 15. Out of scope for this spec

- Production hosting of Inngest (Inngest Cloud, self-hosted, or migration to a different durable-functions provider).
- Auto-resume of in-flight reports across schema migrations.
- Per-user concurrency caps.
- Cost tracking per report (token spend rollup) — `pipeline_events.metadata` will carry token counts so this can be added later without schema change.
