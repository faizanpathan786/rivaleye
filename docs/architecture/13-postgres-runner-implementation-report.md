# PostgreSQL Runner Implementation Report — Phase 1: Reddit Only

**Date:** 2026-05-19  
**Status:** Implemented and operational  
**Phase:** Phase 1 (Reddit only); Phase 2+ will add other platforms  

---

## 1. Overview

RivalEye's report pipeline has moved from [Inngest](https://www.inngest.com/) (external event queue) to PostgreSQL-backed job runners for the MVP. This document describes what was built, why, and how the system works.

**Key decision:** PostgreSQL jobs let us run a fully local MVP without external dependencies. The feature flag (`REPORT_PIPELINE_ENGINE=postgres|inngest`) keeps both paths available during the transition.

---

## 2. What Changed

### 2.1 Architecture Shift

| Component | Before (Inngest) | After (Postgres) |
|---|---|---|
| **Queue** | External Inngest service (`localhost:8288`) | PostgreSQL table (`report_platform_jobs`) |
| **Job claiming** | Inngest routes events to listening workers | Workers poll with `SELECT...FOR UPDATE SKIP LOCKED` |
| **Worker discovery** | Inngest middleware auto-discovers endpoints | Workers self-configure via `REPORT_PIPELINE_ENGINE` env |
| **Job coordination** | Inngest deduplication + manual fan-in | PostgreSQL advisory locks + synthesis jobs table |
| **Observability** | Inngest UI + `pipeline_events` table | Postgres queries + `pipeline_events` table |

### 2.2 New Components

| File | Purpose |
|---|---|
| `packages/worker/src/pg-runner/index.ts` | Main polling loop: three concurrent workers (source, synthesis, recovery) |
| `packages/worker/src/pg-runner/claim.ts` | Atomic job claiming via `SELECT...FOR UPDATE SKIP LOCKED` |
| `packages/worker/src/pg-runner/source-worker.ts` | Process one source job: fetch → extract → summarize → fan-in |
| `packages/worker/src/pg-runner/synthesis-worker.ts` | Process one synthesis job: pipeline → report → complete |
| `packages/worker/src/pg-runner/fan-in.ts` | Advisory lock + check all jobs terminal, create synthesis job |
| `packages/worker/src/pg-runner/recovery.ts` | Stale job recovery: reset stuck running jobs |
| `packages/worker/src/pg-runner/types.ts` | TypeScript types for jobs and config |
| `packages/api/src/config/engine.ts` | Feature flag validation and retrieval |

### 2.3 Modified Files

| File | Change |
|---|---|
| `packages/api/src/services/reports.service.ts` | `createReport()` checks feature flag; postgres mode creates reddit-only job, inngest mode creates all platforms + sends events |
| `packages/api/src/db/schema/pipeline.ts` | Added fields to `report_platform_jobs`, created `synthesis_jobs` table, added indexes |
| `packages/worker/src/config.ts` | Worker reads `REPORT_PIPELINE_ENGINE` at startup, starts appropriate loops |
| `.env.example` | Added `REPORT_PIPELINE_ENGINE=postgres` |

---

## 3. Schema Changes

### 3.1 `report_platform_jobs` Table Additions

Fields added (all for job runner mechanics):

```typescript
run_after: timestamp("run_after").notNull().defaultNow(),
locked_at: timestamp("locked_at"),
locked_by: text("locked_by"),
max_attempts: integer("max_attempts").notNull().default(3),
updated_at: timestamp("updated_at").notNull().defaultNow(),
```

Existing fields repurposed:
- `status`: now "queued" | "running" | "completed" | "failed" (was "queued" | "completed" | "failed")
- `stage`: tracking both old stages (scrape, stage_a, stage_b, done) and new granular stages (fetching, storing_mentions, extracting, summarizing, completed)
- `attempt_count`, `last_error`, `started_at`, `completed_at`: all functional as before

New indexes for query performance:

```sql
CREATE INDEX report_platform_jobs_status_run_after_idx 
  ON report_platform_jobs(status, run_after, created_at) 
  WHERE status = 'queued';

CREATE INDEX report_platform_jobs_report_id_status_idx 
  ON report_platform_jobs(report_id, status);

CREATE INDEX report_platform_jobs_locked_at_idx 
  ON report_platform_jobs(locked_at) 
  WHERE status = 'running';
```

### 3.2 New `synthesis_jobs` Table

Represents the fan-in completion check and the final LLM synthesis phase:

```typescript
export const synthesis_jobs = pgTable(
  "synthesis_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    status: synthesis_job_status_enum("status").notNull().default("queued"),
    attempt_count: integer("attempt_count").notNull().default(0),
    max_attempts: integer("max_attempts").notNull().default(2),
    run_after: timestamp("run_after").notNull().defaultNow(),
    locked_at: timestamp("locked_at"),
    locked_by: text("locked_by"),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
    last_error: text("last_error"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("synthesis_jobs_report_id_uniq").on(t.report_id),
    index("synthesis_jobs_status_run_after_idx").on(t.status, t.run_after, t.created_at),
    index("synthesis_jobs_report_id_idx").on(t.report_id),
    index("synthesis_jobs_locked_at_idx").on(t.locked_at).where(sql`status = 'running'`),
  ],
);
```

Key constraint: `unique("synthesis_jobs_report_id_uniq")` ensures only one synthesis job per report (guards against duplicate fan-in creation).

---

## 4. Why PostgreSQL Over Inngest for MVP?

| Criterion | Rationale |
|---|---|
| **Local-first** | Single `pnpm dev` boots everything; no `npx inngest-cli` required |
| **No network calls** | All jobs stored in the same DB as reports/mentions; no IPC overhead |
| **Simpler observability** | Query `report_platform_jobs` and `synthesis_jobs` directly; no external service logs |
| **Feature-flagged** | Inngest still available via `REPORT_PIPELINE_ENGINE=inngest`; can revert or A/B test |
| **Scaling story** | Postgres already under load; moving queues there consolidates infrastructure |

This choice is **MVP-specific**. As we add more platforms and concurrency becomes complex, migrating to a proper queue service (Inngest, BullMQ, Temporal) will be straightforward because the job shape and retry logic are decoupled from the runner.

---

## 5. Worker Architecture

### 5.1 Three Concurrent Polling Loops

The `pg-runner/index.ts` entry point starts three independent loops:

1. **`pollSourceJobs()`** — Claims and processes source jobs (scraper tasks)
   - Polls every 1.5 seconds
   - Checks for `report_platform_jobs` with `status='queued'` and `run_after <= now()`
   - Executes: fetch → persist mentions → extract → summarize → fan-in

2. **`pollSynthesisJobs()`** — Claims and processes synthesis jobs (LLM clustering)
   - Polls every 1.5 seconds
   - Checks for `synthesis_jobs` with `status='queued'` and `run_after <= now()`
   - Executes: verify all sources done → run pipeline → persist report → mark completed

3. **`recoverStaleJobs()`** — Recovers jobs locked by crashed workers
   - Runs every 30 seconds
   - Finds jobs where `status='running'` and `locked_at < now() - 15 minutes` (source) or 30 minutes (synthesis)
   - Resets them to `queued` with exponential backoff

### 5.2 Worker Identity and Locking

Each worker generates a unique ID: `hostname:pid:random` (e.g. `ip-172-31-0-1:12345:a7b3c2`).

When claiming a job:
1. Database acquires row-level lock via `SELECT...FOR UPDATE SKIP LOCKED`
2. Job status transitions to `running`
3. `locked_at` and `locked_by` are set to enable recovery if worker crashes
4. Worker processes the job
5. On success or permanent failure, job transitions to `completed` or `failed`, locks are released

If a worker crashes mid-job, the recovery loop will detect the stale lock and reset the job to `queued` after 15–30 minutes.

### 5.3 Claiming Safety (No Race Conditions)

PostgreSQL's `SELECT...FOR UPDATE SKIP LOCKED` ensures:

- **Atomicity**: Lock acquisition and status transition happen in one transaction.
- **No double-claiming**: If two workers try to claim the same row, one gets the lock and the other skips to the next row.
- **Fair ordering**: Jobs are claimed FIFO (`ORDER BY created_at ASC`).

Example:

```typescript
const selectedRows = await tx
  .selectDistinct()
  .from(report_platform_jobs)
  .where(
    and(
      eq(report_platform_jobs.status, "queued"),
      lte(report_platform_jobs.run_after, sql`now()`),
    ),
  )
  .orderBy(asc(report_platform_jobs.created_at))
  .limit(1)
  .for("update", { skipLocked: true }); // This is the magic
```

---

## 6. Feature Flag: `REPORT_PIPELINE_ENGINE`

### 6.1 Environment Variable

```bash
REPORT_PIPELINE_ENGINE=postgres  # Default for development
REPORT_PIPELINE_ENGINE=inngest   # Fall back to Inngest
```

If unset, defaults to `postgres` (development-friendly).

### 6.2 Validation

```typescript
// packages/api/src/config/engine.ts
const validEngines = ["postgres", "inngest"];
const engine = process.env.REPORT_PIPELINE_ENGINE ?? "postgres";
if (!validEngines.includes(engine)) {
  throw new Error(
    `Invalid REPORT_PIPELINE_ENGINE: ${engine}. Must be one of: ${validEngines.join(", ")}`
  );
}
```

Both API and worker validate on startup. If invalid, process exits with an error.

### 6.3 Behavior Difference

**When `REPORT_PIPELINE_ENGINE=postgres`:**

1. API calls `createReport()` with engine selection
2. Report row created + **only Reddit source job** created (Phase 1 MVP scope)
3. Inngest events are **not sent**
4. Worker `pg-runner` loops start and poll Postgres

**When `REPORT_PIPELINE_ENGINE=inngest`:**

1. API calls `createReport()` (old path)
2. Report row created + **all enabled platforms** inserted as source jobs
3. Inngest events sent for all platforms
4. Worker listens to Inngest events (old flow)

---

## 7. Report Creation Flow (Postgres Mode)

### 7.1 Sequence

```
POST /v1/reports (API)
  ↓
createReport service
  ↓
1. Expand keywords (LLM, unsafe to fail)
  ↓
2. DB transaction START
  ↓
3. Insert reports row (status=queued, stage=queued)
  ↓
4. Insert report_platform_jobs for reddit (status=queued)
  ↓
5. DB transaction COMMIT
  ↓
6. Return { id: reportId }
```

**Important:** Keyword expansion happens **before** the transaction. If it fails, the API returns an error and no report is created. This keeps the DB in a consistent state.

### 7.2 Code (from `packages/api/src/services/reports.service.ts`)

```typescript
export async function createReport(
  owner_id: string,
  input: CreateReportInput,
): Promise<{ id: string }> {
  const engine = getPipelineEngine();
  const competitor = input.competitors[0] ?? input.category;

  // Expand keywords BEFORE any DB writes (safe to fail)
  const keywords = await expandKeywords(getLlm(), {
    competitor,
    category: input.category,
    audience: input.target_audience,
    goal: input.founder_goal,
  });

  // Transaction: report + jobs atomic
  const row = await db.transaction(async (tx) => {
    const [reportRow] = await tx
      .insert(reports)
      .values({
        owner_id,
        category: input.category,
        competitors: input.competitors,
        audience: input.target_audience,
        goal: input.founder_goal,
        status: "queued",
        stage: "queued",
        primary_competitor_name: competitor,
      })
      .returning({ id: reports.id });

    if (!reportRow) throw new Error("Failed to insert report");

    if (engine === "postgres") {
      // Phase 1: Only Reddit for MVP
      await tx.insert(report_platform_jobs).values({
        report_id: reportRow.id,
        platform: "reddit",
        status: "queued",
      });
    } else if (engine === "inngest") {
      // Keep existing behavior: all platforms via Inngest
      await tx.insert(report_platform_jobs).values(
        ENABLED_PLATFORMS.map((platform) => ({
          report_id: reportRow.id,
          platform,
          status: "queued" as const,
        })),
      );

      await inngest.send(
        ENABLED_PLATFORMS.map((platform) => ({
          name: "scrape.fetch" as const,
          data: { reportId: reportRow.id, platform, competitor, category: input.category, keywords },
        })),
      );
    }

    return reportRow;
  });

  return { id: row.id };
}
```

---

## 8. Source Job Processing

### 8.1 Single Job Flow

```
pollSourceJobs picks up job
  ↓
claimSourceJob (SELECT...FOR UPDATE)
  ↓
processSourceJob
  ├─ Emit "started" event
  ├─ Fetch posts from Reddit scraper
  ├─ Persist mentions to mentions table
  ├─ Update report status to "running"
  ├─ Run Stage A extraction (LLM)
  ├─ Run Stage B summarization (LLM)
  ├─ Emit completion events
  ├─ Mark job status="completed"
  └─ Call fanInCheck()
```

### 8.2 Retry Logic

On error during job processing:

```typescript
if (job.attempt_count < job.max_attempts) {
  // Retry with exponential backoff: 30s, 2m, 5m
  const backoffMs = getBackoffMs(job.attempt_count);
  await db.update(report_platform_jobs).set({
    status: "queued",
    run_after: new Date(Date.now() + backoffMs),
    locked_at: null,
    locked_by: null,
    last_error: readableError,
    updated_at: new Date(),
  }).where(eq(report_platform_jobs.id, job.id));
} else {
  // Max retries exhausted
  await db.update(report_platform_jobs).set({
    status: "failed",
    stage: "failed",
    locked_at: null,
    locked_by: null,
    last_error: readableError,
    completed_at: new Date(),
    updated_at: new Date(),
  }).where(eq(report_platform_jobs.id, job.id));
  
  // Still call fan-in (might trigger synthesis with partial data)
  await fanInCheck(job.report_id);
}
```

Default: 3 attempts, backoff [30s, 2m, 5m].

---

## 9. Fan-In: Detecting When All Sources Are Done

### 9.1 Purpose

When all source jobs for a report are terminal (either `completed` or `failed`), the system must:

1. Create a `synthesis_jobs` row (exactly once)
2. Transition the report to synthesis phase

Fan-in is called after **every source job completion or failure**, so the first job to finish all sources triggers synthesis.

### 9.2 Atomic Fan-In Logic

```typescript
export async function fanInCheck(reportId: string) {
  await db.transaction(async (tx) => {
    // Advisory lock prevents concurrent fan-in on the same report
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);
    
    // Check all source jobs
    const jobs = await tx
      .select({ status: report_platform_jobs.status })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));
    
    // If not all terminal, exit early
    const allTerminal = jobs.every(j => ["completed", "failed"].includes(j.status));
    if (!allTerminal) return;
    
    // Check synthesis_jobs doesn't have a row yet (guard against duplicates)
    const existing = await tx
      .select({ id: synthesis_jobs.id })
      .from(synthesis_jobs)
      .where(eq(synthesis_jobs.report_id, reportId))
      .limit(1);
    if (existing.length > 0) return;
    
    // Create synthesis job
    await tx.insert(synthesis_jobs).values({
      report_id: reportId,
      status: "queued",
      run_after: new Date(),
    });
  });
}
```

Key safeguards:

- **Advisory lock**: PostgreSQL advisory locks (`pg_advisory_xact_lock`) serialize fan-in calls for the same report.
- **Unique constraint**: `synthesis_jobs_report_id_uniq` prevents duplicate rows even if lock fails.
- **Terminal check**: Only proceed if all source jobs are `completed` or `failed`.

---

## 10. Synthesis Job Processing

### 10.1 Flow

```
pollSynthesisJobs picks up job
  ↓
claimSynthesisJob (SELECT...FOR UPDATE)
  ↓
processSynthesisJob
  ├─ Emit "started" event
  ├─ Verify all source jobs terminal
  ├─ If all failed → mark synthesis failed (PermanentError)
  ├─ If some succeeded → run pipeline (Stages C, D, E)
  ├─ Persist report sections to DB
  ├─ Update report status="completed"
  └─ Mark synthesis_job status="completed"
```

### 10.2 Partial Report Handling

If some source jobs failed but others succeeded:

- Report status transitions to `completed` with `partial=true`
- `failed_platforms` list is stored
- Synthesis runs on available data (e.g., complaints from Reddit but not Twitter if Twitter failed)
- Frontend shows a "partial report" banner with a retry button for failed platforms

---

## 11. Stale Job Recovery

### 11.1 Problem It Solves

If a worker crashes while processing a job:

1. Job status is `running`
2. `locked_at` and `locked_by` are set
3. Worker never transitions job to `completed` or `failed`
4. Job is stuck forever

Recovery loop fixes this by detecting and resetting stale locks.

### 11.2 Recovery Logic

Every 30 seconds:

```typescript
const staleSourceJobs = await db
  .select()
  .from(report_platform_jobs)
  .where(
    and(
      eq(report_platform_jobs.status, "running"),
      lte(report_platform_jobs.locked_at, new Date(Date.now() - 15 * 60 * 1000)) // 15 min
    )
  );

for (const job of staleSourceJobs) {
  if (job.attempt_count < job.max_attempts) {
    // Reset to queued with backoff
    await db.update(report_platform_jobs).set({
      status: "queued",
      run_after: new Date(Date.now() + getBackoffMs(job.attempt_count)),
      locked_at: null,
      locked_by: null,
      last_error: `Stale lock recovered by ${workerId} after 15m`,
      updated_at: new Date(),
    }).where(eq(report_platform_jobs.id, job.id));
  } else {
    // Max attempts exhausted; mark failed
    await db.update(report_platform_jobs).set({
      status: "failed",
      stage: "failed",
      last_error: "Max attempts exceeded; stale running job",
      locked_at: null,
      locked_by: null,
    }).where(eq(report_platform_jobs.id, job.id));
    await fanInCheck(job.report_id);
  }
}
```

Timeouts:
- **Source jobs**: 15 minutes (scrapers can be slow, e.g., rate limits)
- **Synthesis jobs**: 30 minutes (LLM pipelines can be slow)

---

## 12. Phase 1 Scope: Reddit Only

### 12.1 Why Reddit First?

1. **Lowest scraper complexity** — DIY endpoint parsing, no external API keys
2. **Highest user pain visibility** — Many early-stage founders monitor Reddit for complaints
3. **Quick iteration cycle** — Can test full pipeline end-to-end with one source
4. **De-risks multi-platform later** — Proves job machinery works before adding Apify/3rd-party scrapers

### 12.2 Expanding to Phase 2 Platforms

When ready to add G2, Twitter, LinkedIn, etc., change this in `createReport()`:

```typescript
if (engine === "postgres") {
  // Phase 2: All platforms
  const ENABLED_PLATFORMS_POSTGRES = ["reddit", "g2", "twitter", "linkedin"];
  
  await tx.insert(report_platform_jobs).values(
    ENABLED_PLATFORMS_POSTGRES.map((platform) => ({
      report_id: reportRow.id,
      platform,
      status: "queued",
    })),
  );
}
```

No worker changes needed — the job runner is already platform-agnostic. It will:

1. Claim jobs by platform
2. Call `getScraper(platform)` to get the right scraper
3. Process each in parallel (multiple workers claim different jobs concurrently)
4. Fan-in triggers when **all** platforms are terminal

---

## 13. Progress Endpoint Enhancements

### 13.1 Response Shape (GET `/v1/reports/:id/progress`)

```json
{
  "report": {
    "id": "uuid",
    "status": "queued|running|completed|failed",
    "partial": false,
    "failed_platforms": []
  },
  "platforms": [
    {
      "platform": "reddit",
      "status": "queued|running|completed|failed",
      "stage": "queued|fetching|storing_mentions|extracting|summarizing|completed|failed",
      "attempt_count": 0,
      "max_attempts": 3,
      "last_error": null,
      "last_event_at": "2026-05-19T12:34:56Z",
      "is_stuck": false,
      "stuck_reason": null,
      "time_since_last_event_seconds": 45
    }
  ],
  "synthesis": {
    "status": null|"queued|running|completed|failed",
    "attempt_count": 0,
    "last_error": null,
    "locked_at": null,
    "is_stuck": false,
    "stuck_reason": null
  },
  "events": [
    {
      "created_at": "...",
      "platform": "reddit",
      "stage": "scrape.fetch",
      "event": "started|completed|failed",
      "attempt": 0,
      "duration_ms": 1234
    }
  ],
  "metrics": {
    "total_mentions_stored": 150,
    "total_complaints_extracted": 47
  }
}
```

### 13.2 Stuck Detection

```typescript
function getStuckReason(job, thresholdSeconds = 300) { // 5 minutes default
  if (job.status === "queued" && job.attempt_count === 0 && 
      Date.now() - job.created_at > thresholdSeconds * 1000) {
    return "Queued for too long without attempt";
  }
  if (job.status === "running" && job.locked_at &&
      Date.now() - job.locked_at > thresholdSeconds * 1000) {
    return "Running for too long without progress (may be recovered soon)";
  }
  return null;
}
```

This helps debugging: users can see if a job is genuinely stuck or just slow.

---

## 14. Observability

### 14.1 Database Queries for Debugging

**Current report progress:**

```sql
SELECT 
  platform, status, stage, attempt_count, last_error, locked_at, locked_by
FROM report_platform_jobs
WHERE report_id = 'uuid'
ORDER BY created_at;
```

**Synthesis job status:**

```sql
SELECT id, status, attempt_count, last_error, locked_at, locked_by
FROM synthesis_jobs
WHERE report_id = 'uuid';
```

**Recent events for a report:**

```sql
SELECT created_at, platform, stage, event, attempt, duration_ms
FROM pipeline_events
WHERE report_id = 'uuid'
ORDER BY created_at DESC
LIMIT 50;
```

**Stale jobs (potential recovery targets):**

```sql
SELECT id, report_id, platform, status, locked_at, locked_by, attempt_count
FROM report_platform_jobs
WHERE status = 'running'
  AND locked_at < now() - interval '15 minutes'
ORDER BY locked_at ASC;
```

### 14.2 Logging

Worker processes log via pino (JSON to stdout):

```
{"level":30,"time":"2026-05-19T12:34:56.789Z","name":"source-worker","msg":"Starting source job processing","jobId":"uuid","reportId":"uuid","platform":"reddit"}
{"level":30,"time":"2026-05-19T12:34:57.234Z","name":"source-worker","msg":"Fetched posts","jobId":"uuid","platform":"reddit","count":127}
```

Each message includes context (jobId, reportId, platform) for easy filtering via log aggregation tools.

---

## 15. Known Limitations & Future Work

| Limitation | Severity | Future Workaround |
|---|---|---|
| Single worker process | Medium | Add horizontal scaling via worker pool (e.g., Kubernetes StatefulSet) |
| No job priority queue | Low | Add `priority` column to jobs; order by priority, then created_at |
| No job cancellation | Low | Add `status='cancelled'` enum value and cancel endpoint |
| Polling interval fixed at 1.5s | Low | Make configurable via `PG_RUNNER_POLL_INTERVAL_MS` env |
| Advisory locks non-distributed | Low | Only an issue with multiple processes; each process has its own pg connection pool |
| No dead-letter queue | Medium | On final failure, move to separate `failed_jobs_archive` table for later review |

---

## 16. Testing

### 16.1 Unit Tests

- `postgres-report-creation.test.ts` — Verify report + reddit source job created atomically
- `postgres-feature-flag.test.ts` — Verify engine selection works
- `pg-runner-job-claiming.test.ts` — Verify concurrent claiming is safe
- `pg-runner-source-job.test.ts` — Verify source job flow
- `pg-runner-fan-in.test.ts` — Verify fan-in deduplication
- `pg-runner-synthesis-job.test.ts` — Verify synthesis completion

### 16.2 Manual E2E Testing

See `docs/testing/03-postgres-runner-e2e.md` for step-by-step manual testing with real Reddit and OpenRouter APIs.

---

## 17. Migration Path (Inngest → Postgres → Future Queue)

This implementation is a **deliberate stepping stone**:

1. **Inngest (pre-redesign)**: External queue; local dev requires `inngest-cli dev`.
2. **Postgres (current, MVP)**: All-in-Postgres; simpler local dev.
3. **Future (post-MVP)**: Proper queue service (BullMQ, Temporal, Inngest cloud) if concurrency or scaling demands it.

The feature flag ensures we can:

- Run Postgres mode locally during MVP development
- Flip to Inngest mode if we need it before launch
- Migrate to a new queue without touching the job worker code (just swap the claiming + claiming logic)

The job shape (status, stage, attempt_count, etc.) and retry logic are intentionally **queue-agnostic**. A future migration would only require changing:

1. Claiming logic (how jobs are retrieved)
2. Marking job transitions (how status is updated)
3. Worker startup (which loops are run)

The actual work (scraping, LLM, synthesis) stays the same.

---

## 18. Success Criteria ✅

After implementation, these should all be true:

- ✅ Report created with `REPORT_PIPELINE_ENGINE=postgres` creates report + reddit job (no Inngest)
- ✅ Worker pg-runner claims jobs safely (no race conditions, tested with concurrent workers)
- ✅ Source job completes: fetch → extract → summarize → job marked completed
- ✅ Fan-in triggers synthesis job creation when all sources terminal
- ✅ Synthesis job completes: pipeline → persist → report marked completed
- ✅ Failed source jobs retry with exponential backoff (30s, 2m, 5m)
- ✅ Max retry exhaustion marks job failed but still triggers fan-in (partial report)
- ✅ Stale job recovery resets locked jobs after 15–30 minutes
- ✅ Progress endpoint shows stuck_reason and stuck detection works
- ✅ `REPORT_PIPELINE_ENGINE=inngest` still works (backward compatible)
- ✅ All tests pass: unit + mocked E2E
- ✅ Manual E2E passes with real Reddit + OpenRouter APIs

---

## 19. Files & Dependencies

### 19.1 Core Runner Files

```
packages/worker/src/pg-runner/
  index.ts           ← Main entry point; starts three loops
  types.ts           ← SourceJobRow, SynthesisJobRow, WorkerConfig types
  claim.ts           ← claimSourceJob, claimSynthesisJob
  source-worker.ts   ← processSourceJob
  synthesis-worker.ts ← processSynthesisJob
  fan-in.ts          ← fanInCheck with advisory lock
  recovery.ts        ← recoverStaleJobs
```

### 19.2 Related Files

```
packages/api/src/
  config/engine.ts                ← getPipelineEngine()
  services/reports.service.ts     ← createReport with engine selection
  db/schema/pipeline.ts           ← report_platform_jobs, synthesis_jobs, briefs
  db/schema/mentions.ts           ← mentions (used by source worker)
  db/schema/reports.ts            ← reports (used by all)

packages/worker/src/
  db/client.ts                    ← Drizzle client (shared with API)
  pipeline/                       ← Stage A/B/C/D/E code (reused)
  events/emit.ts                  ← Event logging (reused)
  llm/fan-in.ts                   ← Advisory lock helper (imported by pg-runner)

packages/shared/src/
  llm-client.ts                   ← OpenRouterClient (used by source worker for expansion)
```

### 19.3 External Dependencies

```
pnpm install
drizzle-orm                       ← ORM for schema + migrations
pg                                ← Postgres client (via drizzle)
pino                              ← Logging
@rivaleye/shared                  ← Shared types, schemas, LLM client
@rivaleye/scrapers                ← Scraper implementations
```

---

## 20. Running the System Locally

See `docs/testing/03-postgres-runner-e2e.md` for detailed instructions.

**Quick start:**

```bash
# Terminal 1: Start everything
pnpm dev

# Terminal 2: Create a report via the app (http://localhost:5173)
# or via curl:
curl -X POST http://localhost:3001/v1/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "category": "customer service software",
    "competitors": ["Zendesk"],
    "target_audience": "SMB founders",
    "founder_goal": "understand pain points"
  }'

# Terminal 3: Tail events
psql "$CONNECTION_STRING" -c "select created_at, platform, stage, event, attempt from pipeline_events where report_id = '<id>' order by created_at desc limit 30;"
```

The worker will automatically:

1. Claim the source job
2. Fetch Reddit posts
3. Extract and summarize
4. Mark the job completed
5. Trigger synthesis
6. Run the LLM pipeline
7. Mark the report completed

All state is visible in Postgres at each step.

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Source job** | One platform's scrape + extraction + summarization (e.g., "reddit source job") |
| **Synthesis job** | Final LLM clustering and report generation after all sources collected |
| **Fan-in** | Synchronization point: when all source jobs are done, create synthesis job |
| **Advisory lock** | PostgreSQL transaction-scoped lock used to serialize fan-in checks |
| **Stage** | Pipeline phase (queued, fetching, storing_mentions, extracting, summarizing, completed, failed) |
| **Stale lock** | A job marked `running` with `locked_at` older than the timeout threshold |
| **Exponential backoff** | Retry delay that increases: 30s, 2m, 5m for attempts 0, 1, 2+ |

---

**Last updated:** 2026-05-19  
**Next review:** When Phase 2 (multi-platform) implementation begins
