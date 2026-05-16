# Observability, Reliability & Queue Efficiency

**Status:** approved  
**Date:** 2026-05-16  
**Spec scope:** Structured logging persisted to DB for UI terminal, LLM timeout + retry, parallel worker batch processing, and checkpoint-resume for the generate-report pipeline.

---

## 1. Goals

1. **Verbose logging to DB** — every meaningful pipeline event (scrape start/finish, LLM call, token counts, errors) is written to `report_logs` so the UI can show a live terminal while the report runs.
2. **LLM reliability** — retries with exponential backoff + per-call AbortSignal timeout on every OpenRouter call; Stage E falls back to Stage D output rather than failing the report.
3. **Queue throughput** — scrape-platform batch jobs run in parallel (not serially); pg-boss job options add retry + expiry limits.
4. **Checkpoint-resume** — `generate-report` persists Stage C/D/E output so a retry picks up from the last completed stage instead of restarting from scratch.

---

## 2. Non-goals

- No SSE / WebSocket streaming (polling matches existing progress-endpoint pattern; SSE is a future upgrade).
- No new queue types for stages C/D/E.
- No changes to scraper logic, prompt content, or report schema sections.
- No frontend changes beyond wiring the new `/logs` endpoint.

---

## 3. New DB tables

### 3.1 `report_logs`

```sql
report_logs (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  level       text not null,   -- 'info' | 'warn' | 'error'
  stage       text,            -- 'scrape' | 'A' | 'B' | 'C' | 'D' | 'E' | 'persist' | null
  platform    text,            -- null for cross-platform stages
  message     text not null,
  meta        jsonb,           -- token counts, post_count, attempt, ms, error details
  created_at  timestamp not null default now()
)
-- index: (report_id, created_at)
```

Drizzle schema file: `packages/api/src/db/schema/logs.ts`.  
Re-exported from `packages/api/src/db/schema/index.ts`.

### 3.2 `report_pipeline_checkpoints`

```sql
report_pipeline_checkpoints (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references reports(id) on delete cascade,
  stage       text not null,   -- 'C' | 'D' | 'E'
  output      jsonb not null,
  created_at  timestamp not null default now(),
  unique(report_id, stage)
)
```

Drizzle schema file: `packages/api/src/db/schema/pipeline.ts` (add alongside existing `report_platform_jobs` / `report_platform_briefs`).

Both tables added via Drizzle migration (`pnpm db:generate` → commit migration alongside schema change).

---

## 4. Worker logger

**File:** `packages/worker/src/logger.ts`

```ts
export type LogLevel = 'info' | 'warn' | 'error';

export async function log(
  reportId: string,
  level: LogLevel,
  stage: string | null,
  platform: string | null,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void>
```

- Writes one row to `report_logs` via Drizzle.
- Mirrors the same line to `console` (same format as current logs) so dev output is unchanged.
- Fire-and-forget: the DB insert is awaited but any insert error is caught and printed to stderr — it never throws back to the caller.
- All existing `console.log` / `console.error` calls in `scrape-platform.ts`, `generate-report.ts`, and `pipeline/run.ts` are replaced with `log(...)`.

---

## 5. LLM retry + timeout

### 5.1 Retry wrapper

Added to `OpenRouterClient.complete()` in `packages/shared/src/llm/openrouter.ts`.

Algorithm: exponential backoff, base 2, delays `1s → 4s → 16s` (capped at 30s).

```
attempt 1 → fail → wait 1s
attempt 2 → fail → wait 4s
attempt 3 → fail → throw
```

Only retries on transient errors (HTTP 429, 5xx, network timeout, JSON parse failure). Does not retry on 4xx auth errors.

### 5.2 Per-call timeout

Uses `AbortSignal.timeout(ms)` threaded into the underlying `fetch` call. Timeout is passed as an optional parameter with per-stage defaults:

| Stage | Max attempts | Timeout |
|-------|-------------|---------|
| A (extract) | 3 | 45 s |
| B (summarize) | 3 | 45 s |
| C (merge) | 3 | 60 s |
| D (synth) | 3 | 90 s |
| E (refine) | 2 | 90 s |

### 5.3 Stage E fallback

`runStageERefine` catches all-attempts-exhausted errors and returns the Stage D draft as-is with `fellBackToDraft: true`. `run.ts` logs a `warn` when this happens. The report still completes — Stage E failure is not fatal.

---

## 6. Parallel batch processing

**File:** `packages/worker/src/index.ts`

```ts
// Before (serial):
for (const job of jobs) await handleScrapePlatform(job.data);

// After (parallel):
await Promise.allSettled(jobs.map(job => handleScrapePlatform(job.data)));
```

`Promise.allSettled` is used (not `Promise.all`) so one scraper failure does not cancel sibling jobs mid-flight. Each handler already catches its own errors and marks the platform job failed.

### 6.1 pg-boss job options

Added at enqueue time (in `packages/api/src/libs/queue.ts` and `packages/worker/src/jobs/scrape-platform.ts`):

| Queue | retryLimit | retryDelay (s) | expireInSeconds |
|-------|-----------|----------------|-----------------|
| `scrape-platform` | 3 | 30 | 600 (10 min) |
| `generate-report` | 2 | 60 | 1800 (30 min) |

`retryDelay` is a fixed delay before pg-boss re-queues the job.

---

## 7. Checkpoint-resume in generate-report

**File:** `packages/worker/src/pipeline/run.ts`

Flow on every invocation:

```
1. Load existing checkpoints for reportId from report_pipeline_checkpoints
2. Stage C:
     if checkpoint['C'] exists → use its output, log "skipping C (checkpoint found)"
     else → run runStageCMerge → on success, upsert checkpoint (stage='C', output=merged)
3. Stage D:
     if checkpoint['D'] exists → use its output
     else → run runStageDSynth → on success, upsert checkpoint (stage='D', output=synth)
4. Stage E:
     if checkpoint['E'] exists → use its output
     else → run runStageERefine → on success (or fallback), upsert checkpoint (stage='E', output=refined)
5. derive platform_stats + subreddits (always re-run — idempotent)
6. persist to 16 sub-tables (always re-run — uses upsert / delete+insert in transaction)
7. UPDATE reports SET status='completed', stage='done'
```

Checkpoint upsert uses Drizzle's `.onConflictDoUpdate()` on `(report_id, stage)`.

Checkpoints are **not** cleared after completion — they serve as a permanent audit trail and are cleaned up by cascade when the report is deleted.

---

## 8. API endpoint — GET /v1/reports/:id/logs

**Controller:** `packages/api/src/controllers/reports/handlers/getLogs.ts`  
**Service:** `packages/api/src/services/reports.service.ts` (add `getLogs` function)

```
GET /v1/reports/:id/logs?since=<ISO 8601 timestamp>
```

- `since` is optional. When omitted returns all logs. When provided returns logs where `created_at > since`.
- Sorted `created_at ASC`.
- Auth-guarded (auth: {}) — any authenticated user who owns the report.
- Response:

```ts
{
  data: Array<{
    id: string;
    level: 'info' | 'warn' | 'error';
    stage: string | null;
    platform: string | null;
    message: string;
    meta: Record<string, unknown> | null;
    created_at: string; // ISO 8601
  }>
}
```

Frontend polls every 2–3 s while `report.status` is `queued` or `running`, using the last returned `created_at` as `since` for the next call.

---

## 9. Files changed / created

| File | Action |
|------|--------|
| `packages/api/src/db/schema/logs.ts` | **new** — `report_logs` Drizzle table |
| `packages/api/src/db/schema/pipeline.ts` | **edit** — add `report_pipeline_checkpoints` |
| `packages/api/src/db/schema/index.ts` | **edit** — re-export new table |
| `packages/api/drizzle/` | **new migration** via `pnpm db:generate` |
| `packages/worker/src/logger.ts` | **new** — `log()` utility |
| `packages/shared/src/llm/openrouter.ts` | **edit** — add retry + AbortSignal timeout |
| `packages/worker/src/index.ts` | **edit** — `Promise.allSettled` parallel batch |
| `packages/api/src/libs/queue.ts` | **edit** — pg-boss job options on send |
| `packages/worker/src/jobs/scrape-platform.ts` | **edit** — replace console.log with log(); pg-boss options |
| `packages/worker/src/jobs/generate-report.ts` | **edit** — replace console.log with log() |
| `packages/worker/src/pipeline/run.ts` | **edit** — checkpoint-resume logic |
| `packages/worker/src/pipeline/stage-e-refine.ts` | **edit** — catch all-fail, return fallback |
| `packages/api/src/controllers/reports/handlers/getLogs.ts` | **new** — GET /logs handler |
| `packages/api/src/services/reports.service.ts` | **edit** — add getLogs() |
| `packages/api/src/controllers/reports/index.ts` | **edit** — mount getLogs handler |

---

## 10. Error handling matrix

| Failure point | Behaviour |
|---------------|-----------|
| DB insert in `log()` | Catch, print to stderr, never rethrow |
| LLM timeout (single attempt) | Retry with backoff |
| LLM all attempts exhausted (Stage A/B) | Mark platform job failed, fan-in continues |
| LLM all attempts exhausted (Stage C/D) | Mark report failed, error stored |
| LLM all attempts exhausted (Stage E) | Fall back to Stage D output, log warn, report completes |
| pg-boss retries generate-report | Checkpoint skips completed stages, resumes from last |
| Checkpoint upsert fails | Throw — stage re-runs on next retry (safe, idempotent) |
| All scrapers fail (0 briefs) | Existing behaviour: mark report failed |

---

## 11. Open questions

None. All design decisions resolved:
- Polling (not SSE) — matches existing progress-polling pattern. ✅
- Checkpoint-resume (not queue-split) — simpler, no new queue types. ✅
- `Promise.allSettled` (not `Promise.all`) — isolates scraper failures. ✅
- Stage E fallback to Stage D — report always completes if C+D succeed. ✅
