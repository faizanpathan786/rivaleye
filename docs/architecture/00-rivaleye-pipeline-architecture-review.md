# RivalEye Pipeline Architecture Review

**Date:** 2026-05-19  
**Reviewed by:** Staff Engineer (Architecture)  
**Status:** Decision Required  

---

## Executive Summary

### How the Report Pipeline Works Today

1. User creates report via web UI
2. API (`packages/api/src/services/reports.service.ts:createReport()`) inserts report row + creates one source job per enabled platform
3. API calls `inngest.send()` to dispatch `scrape.fetch` events
4. Inngest (if running + configured) queues events to a local dev server or cloud
5. Worker processes listen to Inngest and consume events
6. Each worker (scrape → llm-a → llm-b) processes a source's data
7. After all sources complete, fan-in check triggers `synth.run` event
8. Synthesis worker merges all data, runs final LLM passes, writes report sections
9. Report status updates to "completed"
10. Frontend polls progress endpoint and renders report

### Architecture Strengths

- **Clean separation of concerns**: API enqueues, workers process, DB stores state
- **Parallel source processing**: All 6 sources fetch/extract simultaneously
- **Type-safe Inngest integration**: EventSchemas provide TS validation
- **Idempotency**: Scrape uses `(reportId, platform)` key; stage A/B use `reportId:platform:stage` keys
- **Advisory lock fan-in**: Prevents duplicate synthesis job triggering
- **Database schema is sound**: Foreign keys, constraints, and enums are correct

### Architecture Fragility

🔴 **Critical weakness**: Inngest event dispatch is a **single point of failure** with **no fallback**.

- If `INNGEST_EVENT_KEY` is not set → all events fail with 401
- If Inngest dev server isn't running → events queue but never dispatch
- If worker crashes mid-process → job stays in "running" state forever
- If Inngest dispatch succeeds but worker never receives event → jobs stuck in DB
- **Jobs can become invisible**: Stuck jobs have no retry mechanism, no alerting, no recovery

When events fail:
- API thinks it succeeded (no exception caught at route level)
- Report + source jobs exist in DB
- But they're never processed
- Frontend polls progress, sees no change, shows infinite loading

### Is Inngest Actually Needed for MVP?

**No.**

Inngest is an excellent tool for **complex orchestration at scale**, but RivalEye's MVP has:
- Single dependency graph (fetch → extract → synthesize, not DAG)
- Low throughput (likely <100 reports/day at MVP launch)
- Low latency requirement (reports run in background, don't need sub-second dispatch)
- Small concurrency (handful of workers)

Inngest adds:
- Operational complexity (another service to run locally)
- Another configuration secret (INNGEST_EVENT_KEY)
- Another failure point (Inngest server down = all jobs stuck)
- Mental complexity (events can disappear into Inngest black box)
- Debugging friction (need Inngest UI to see if events were queued)

### Is Postgres-Only Job Orchestration Realistic?

**Yes, absolutely.**

For MVP scale (10–100 reports/day, each with 6 sources):
- Polling every 1–2 seconds with `SELECT * FROM source_jobs WHERE status = 'queued' LIMIT 10` is ~100-200 queries/day
- Advisory lock on source_jobs can serialize worker claiming (prevents duplicate processing)
- Job claiming via `SELECT ... FOR UPDATE SKIP LOCKED` is battle-tested pattern
- Retry logic via `attempt_count` column + exponential backoff is simple to implement
- Failed jobs stay visible in DB (unlike Inngest events which disappear)

The Postgres-backed approach requires:
- Worker polling loop (simple, ~50 lines of code)
- Claiming mechanism (standard SQL pattern)
- Stuck job recovery (query jobs.updated_at > now() - interval '1 hour' AND status = 'running', mark failed)
- Retry logic (update attempt_count, reset status to queued)

This is proven, understood, and debuggable.

### Should We Add Redis/BullMQ Now?

**No, not for MVP.**

- Adds Redis dependency (local dev + production)
- Adds complexity (queue state + DB state in sync)
- Not needed until throughput exceeds what Postgres can handle
- For <1,000 reports/day, Postgres polling is fine
- If we hit scale limits later, BullMQ is a drop-in replacement

### Recommended Direction

**Recommendation: Move to Postgres-backed job orchestration for MVP. Remove Inngest dependency.**

Reason:
- Simpler architecture (one less external service)
- Better debuggability (all state in Postgres)
- Easier local dev (no Inngest CLI needed)
- More reliable (no events can get lost)
- Better progress visibility (jobs never hidden)
- Sufficient for MVP scale
- Clearer failure modes (stuck jobs are obvious)

Timeline:
1. **Phase 0 (now)**: Stabilize current Inngest setup + document it
2. **Phase 1 (1–2 sprints)**: Build Postgres job runner in parallel
3. **Phase 2 (1 sprint)**: Migrate one source (Reddit) to new runner, test thoroughly
4. **Phase 3 (1–2 sprints)**: Migrate remaining sources
5. **Phase 4 (1 sprint)**: Remove Inngest code, retire the dependency

This de-risks the system while keeping both options viable.

---

## Current End-to-End Lifecycle

### Step 1: User Adds Competitor

**Location**: `packages/web/src/routes/competitors.tsx`

**Flow**:
- User fills competitor form (name, website, category, etc.)
- Submits via react-hook-form
- Frontend calls `useCreateCompetitorMutation()` hook
- Hook makes `POST /v1/competitors`

**API**:
- **File**: `packages/api/src/controllers/competitors/handlers/createCompetitor.ts`
- **Function**: `createCompetitorHandler` (Elysia route)
- **Service**: `packages/api/src/services/competitors.service.ts:createCompetitor()`
- **Input validation**: Elysia schema `t.Object({ name: t.String(), slug: t.Optional(t.String()), ... })`

**Database writes**:
- **Table**: `competitors`
- **Columns written**: `owner_id`, `name`, `slug` (auto-generated if not provided), `website`, `category`, `color`, `priority`, `tags`, `socials`, `monitor_*`, `notes`, `created_at`, `updated_at`
- **Constraint**: Foreign key on `owner_id` → `users.id`

**Failure points**:
- User not authenticated (handled by `authPlugin`)
- Validation fails (400 response)
- Competitor already exists with same slug for owner (no unique constraint, so duplicate is allowed)
- DB connection lost

**Returns**: Competitor object with generated UUID

---

### Step 2: User Creates Report

**Location**: `packages/web/src/routes/report.tsx` or report creation form

**Flow**:
- User selects competitor, enters category, goal, target audience
- Frontend calls `useCreateReportMutation()`
- Hook makes `POST /v1/reports`

**API**:
- **File**: `packages/api/src/controllers/reports/handlers/createReport.ts`
- **Function**: `createReportHandler` (Elysia route)
- **Service**: `packages/api/src/services/reports.service.ts:createReport()`
- **Input validation**: Elysia schema with category, competitors array (1-5), target_audience, founder_goal enum

---

### Step 3: Report Row Insertion

**Database writes**:
- **Table**: `reports`
- **Columns written**: 
  - `id` (UUID, default)
  - `owner_id` (from auth)
  - `category`, `competitors` (JSON array), `audience`, `goal`
  - `status: "queued"`, `stage: "queued"` (initial state)
  - `primary_competitor_name` (first competitor)
  - `created_at`, `updated_at`
- **Constraint**: Foreign key on `owner_id` → `users.id`

**File**: `packages/api/src/db/schema/reports.ts`

**Failure points**:
- Validation fails before insert
- DB constraint violation (shouldn't happen)
- Connection lost

---

### Step 4: Keyword Expansion (LLM)

**Function**: `packages/api/src/services/keyword-expander.ts:expandKeywords(llm, { competitor, category, audience, goal })`

**Flow**:
- Calls `getLlm()` which returns OpenRouter client
- Sends prompt with competitor + context to LLM
- LLM generates search keywords (~10–20 terms)
- Returns array of keywords

**Environment dependency**: `OPENROUTER_API_KEY`

**Failure points**:
- LLM API key missing → throws error at line 19 of `packages/shared/src/llm/config.ts`
- LLM API rate limit → caught but reported
- Network timeout → LLM retry logic (4 attempts, up to 30s timeout)

**Impact if it fails**:
- Entire `createReport()` throws
- Report + source jobs may or may not be created (see next step)
- API returns 400 to client
- User sees "Failed to create report"

---

### Step 5: Platform/Source Jobs Creation

**Location**: `packages/api/src/services/reports.service.ts:createReport()`, line 95

**Database writes**:
- **Table**: `report_platform_jobs`
- **Values inserted**: One row per platform in `ENABLED_PLATFORMS`
- **Columns**: 
  - `report_id` (FK to reports)
  - `platform` (string: "reddit", "appstore", "playstore", "hackernews", "producthunt", "devto")
  - `status: "queued"`
  - `stage: "scrape"`
  - `attempt_count: 0`
  - `created_at`
- **Constraint**: Unique on `(report_id, platform)`
- **Index**: On `report_id` for fast lookups

**File**: `packages/api/src/db/schema/pipeline.ts`

**Failure points**:
- Unique constraint violation (job already exists for this report+platform) → causes insert to fail if run twice
- DB connection lost
- Partial insert (some platforms succeed, others fail) → not transactional by default

**Important**: Jobs are created BEFORE Inngest dispatch. If Inngest dispatch fails, jobs exist but will never be processed.

---

### Step 6: Inngest Event Dispatch

**Location**: `packages/api/src/services/reports.service.ts:createReport()`, lines 103–114

**Code**:
```typescript
await inngest.send(
  ENABLED_PLATFORMS.map((platform) => ({
    name: "scrape.fetch",
    data: {
      reportId: row.id,
      platform,
      competitor,
      category: input.category,
      keywords,
    },
  })),
);
```

**Events emitted**:
- 6 events of type `scrape.fetch` (one per platform)
- Each event payload includes reportId, platform, competitor name, category, keywords

**Configuration dependency**: `INNGEST_EVENT_KEY` from environment

**Inngest client**: `packages/api/src/libs/inngest.ts`

**Failure points**:
- 🔴 **INNGEST_EVENT_KEY not set** → Error: "401 Event key not found"
- 🔴 Inngest dev server not running → Connection timeout or refused
- Partial dispatch (some platforms succeed, others fail) → Events for failed platforms lost
- Network interruption → Events queued but may not complete
- **No retry mechanism in API layer** → If dispatch fails, error bubbles to handler

**Critical issue**: When `inngest.send()` fails:
- It throws an error
- API handler catches it (try-catch at line 41-52 of createReport handler)
- Handler returns HTTP 400 to client
- But report + source jobs already exist in DB
- They're orphaned (will never be processed)
- No cleanup happens

**This is why jobs get stuck**: Jobs exist with `status="queued"`, but the events that would trigger workers were never sent or received.

---

### Step 7: API Response to Client

**Handler returns** (line 16 of createReport handler):
```typescript
return ok({ id: report.id, stage: "queued" as const });
```

**Important**: API returns immediately, before workers process anything. Frontend doesn't wait—it assumes report is queued and starts polling.

---

### Step 8: Frontend Receives Report ID & Starts Polling

**Location**: `packages/web/src/routes/report.tsx:ReportPage`

**Hook**: `useReportProgressQuery(reportId)` (defined in `packages/web/src/hooks/queries/use-reports.ts`)

**Polling**:
- Calls `GET /v1/reports/{reportId}/progress` repeatedly
- Response includes: report status, per-platform job status, event timeline, metrics (mentions, comments, quotes, complaints)

**If Inngest events never dispatched**:
- Report status stays "queued"
- Source jobs stay "queued" and "scrape" stage
- No events appear in timeline
- No mentions fetched
- Frontend shows infinite loading spinner

---

### Step 9: Worker Receives `scrape.fetch` Event

**Only happens if Inngest dispatch succeeded AND Inngest delivered event to worker.**

**Worker process**: `packages/worker/src/scrape/index.ts` (Bun process running separate from API)

**Handler function**: `packages/worker/src/scrape/fetch.ts:scrapeFetch()`

**Inngest function config**:
```typescript
inngest.createFunction(
  {
    id: "scrape-fetch",
    concurrency: [
      { limit: 8 },  // global
      { limit: 1, key: "event.data.reportId + ':' + event.data.platform" },  // per report+platform
    ],
    retries: 3,
    idempotency: "event.data.reportId + ':' + event.data.platform",
  },
  { event: "scrape.fetch" },
  async ({ event, step, attempt }) => { ... }
)
```

**Input payload**:
```typescript
{
  reportId: string,
  platform: "reddit" | "appstore" | ...,
  competitor: string,
  category: string,
  keywords: string[]
}
```

---

### Step 9a: Worker Emits "started" Event

**Location**: `packages/worker/src/scrape/fetch.ts`, lines 36–57

**Database writes**:
- **Table**: `report_platform_jobs`
  - `status: "running"`
  - `started_at: now()`
  - `attempt_count: attempt + 1`
  - `last_event_at: now()`
- **Table**: `pipeline_events`
  - `report_id`, `stage: "scrape.fetch"`, `event: "started"`, `platform`, `attempt`, `created_at`

**Function**: `emit()` in `packages/worker/src/events/emit.ts`

---

### Step 9b: Worker Fetches from Platform

**Location**: `packages/worker/src/scrape/fetch.ts`, lines 61–64

**Code**:
```typescript
const posts = await step.run("fetch-posts", async () => {
  const scraper = getScraper(platform);
  return scraper.fetch({ competitor, category, keywords });
});
```

**Scraper location**: `packages/scrapers/src/index.ts`

**Supported scrapers**:
- Reddit (DIY): `packages/scrapers/src/reddit/` → uses Reddit API
- AppStore (DIY): `packages/scrapers/src/appstore/`
- PlayStore (DIY): `packages/scrapers/src/playstore/`
- HackerNews (DIY): `packages/scrapers/src/hackernews/`
- ProductHunt (DIY): `packages/scrapers/src/producthunt/`
- DevTo (DIY): `packages/scrapers/src/devto/`

**Return type**: `NormalizedPost[]`

```typescript
{
  platform: string,
  externalId: string,
  url: string,
  author: string,
  title: string,
  body: string,
  score: number,
  numComments: number,
  createdAt: Date,
  raw: Record<string, unknown>
}
```

**Failure points**:
- API rate limit (some handled with exponential backoff)
- Network timeout
- API authentication failed (missing/invalid API key)
- Service down
- Scraper logic error

**Environment dependencies**:
- Reddit: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`
- ProductHunt: `PRODUCTHUNT_TOKEN`
- AppStore/PlayStore: None (DIY fetching)
- HackerNews: None (DIY fetching)

---

### Step 9c: Worker Persists Mentions

**Location**: `packages/worker/src/scrape/fetch.ts`, lines 66–93

**Database writes**:
- **Table**: `mentions`
- **Columns**: `report_id`, `platform`, `external_id`, `url`, `author`, `title`, `body`, `score`, `num_comments`, `posted_at`, `raw`
- **Constraint**: Unique on `(report_id, platform, external_id)`
- **Insertion method**: Bulk insert in chunks of 500, with `onConflictDoNothing()` (idempotent)

Also updates:
- **Table**: `reports`
  - `status: "running"` (first time any platform inserts mentions)

**File**: `packages/api/src/db/schema/mentions.ts`

---

### Step 9d: Mark Stage A & Emit Next Event

**Location**: `packages/worker/src/scrape/fetch.ts`, lines 95–112

**Database writes**:
- **Table**: `report_platform_jobs`
  - `stage: "stage_a"`
  - `last_event_at: now()`

**Event emitted**:
```typescript
inngest.send({
  name: "llm.stage-a",
  data: { reportId, platform }
})
```

---

### Step 10: Worker Receives `llm.stage-a` Event

**Worker process**: `packages/worker/src/llm/index.ts`

**Handler function**: `packages/worker/src/llm/stage-a.ts:stageA()`

**Inngest config**:
```typescript
inngest.createFunction(
  {
    id: "llm-stage-a",
    concurrency: [{ limit: 4 }],  // global
    retries: 4,
    idempotency: "event.data.reportId + ':' + event.data.platform + ':a'",
  },
  { event: "llm.stage-a" },
  ...
)
```

---

### Step 10a: Extract Structured Data (LLM)

**Location**: `packages/worker/src/llm/stage-a.ts`, lines 65–76

**Code**:
```typescript
const result = await step.run("extract", async () => {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  const posts = await db.select().from(mentions).where(
    and(eq(mentions.report_id, reportId), eq(mentions.platform, platform))
  );

  const stageARes = await runStageAExtract({
    llm: getLlm(),
    ctx: { reportId, competitor, category, audience, goal },
    platform,
    posts: posts.map(m => ({
      platform: m.platform as any,
      externalId: m.external_id,
      ...
    }))
  });
});
```

**Function**: `packages/worker/src/pipeline/stage-a-extract.ts:runStageAExtract()`

**LLM call**:
- Sends ~50–500 posts to LLM
- Extracts: pain points, feature gaps, pricing sentiment, switching signals, mentions
- Returns structured `PlatformExtract` object

**Environment dependency**: `OPENROUTER_API_KEY`

**Failure points**:
- No mentions for this platform (returns early)
- LLM API error (retries 4x with timeout)
- LLM timeout (60s per attempt)

---

### Step 10b: Save Platform Brief

**Location**: `packages/worker/src/llm/stage-a.ts`, lines 111–123

**Database writes**:
- **Table**: `report_platform_briefs`
- **Columns**: `report_id`, `platform`, `extract` (JSON), `summary` (empty for now), `model_used`, `prompt_tokens`, `completion_tokens`, `created_at`
- **Constraint**: Unique on `(report_id, platform)`

**Database reads**:
- `reports` (for context: competitor, category, audience, goal)
- `mentions` (all posts for this report+platform)

---

### Step 10c: Mark Stage B & Emit Next Event

**Location**: `packages/worker/src/llm/stage-a.ts`, line 149+

**Database writes**:
- **Table**: `report_platform_jobs`
  - `stage: "stage_b"`

**Event emitted**:
```typescript
inngest.send({
  name: "llm.stage-b",
  data: { reportId, platform }
})
```

---

### Step 11: Worker Receives `llm.stage-b` Event

**Handler function**: `packages/worker/src/llm/stage-b.ts:stageB()`

**Inngest config**:
```typescript
inngest.createFunction(
  {
    id: "llm-stage-b",
    concurrency: [{ limit: 4 }],
    retries: 4,
    idempotency: "event.data.reportId + ':' + event.data.platform + ':b'",
  },
  { event: "llm.stage-b" },
  ...
)
```

---

### Step 11a: Summarize Extract (LLM)

**Location**: `packages/worker/src/llm/stage-b.ts`, lines 79+

**Code**:
```typescript
const summary = await step.run("summarize", async () => {
  const brief = await db.select().from(report_platform_briefs)
    .where(and(eq(report_platform_briefs.report_id, reportId), eq(report_platform_briefs.platform, platform)))
    .limit(1);

  return runStageBSummarize({
    llm: getLlm(),
    ctx: { reportId, competitor, category, audience, goal },
    platform,
    extract: brief[0].extract
  });
});
```

**Function**: `packages/worker/src/pipeline/stage-b-summarize.ts:runStageBSummarize()`

**LLM call**:
- Sends extracted data to LLM
- Generates prose summary of the extract
- Returns `PlatformBrief` (human-readable)

---

### Step 11b: Update Brief with Summary

**Location**: `packages/worker/src/llm/stage-b.ts`, line ~120+

**Database writes**:
- **Table**: `report_platform_briefs`
  - `summary: { ... }` (update)

---

### Step 11c: Mark Job Complete & Trigger Fan-In

**Location**: `packages/worker/src/llm/stage-b.ts`, line ~140+

**Database writes**:
- **Table**: `report_platform_jobs`
  - `status: "completed"`
  - `stage: "done"`
  - `completed_at: now()`

**Function call**: `fanInCheck(reportId)` in `packages/worker/src/llm/fan-in.ts`

---

### Step 12: Fan-In Check (Critical Synchronization Point)

**Location**: `packages/worker/src/llm/fan-in.ts:fanInCheck(reportId)`

**Pattern**: PostgreSQL advisory lock to prevent race conditions

**Code**:
```typescript
export async function fanInCheck(reportId: string, reason: "fan-in" | "retry" = "fan-in"): Promise<void> {
  await db.transaction(async (tx) => {
    // Acquire lock on this reportId
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);

    // Check if all source jobs are terminal
    const jobs = await tx
      .select({ status: report_platform_jobs.status })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    const allTerminal = jobs.length > 0 && 
      jobs.every((j) => j.status === "completed" || j.status === "failed");
    
    if (!allTerminal) return;  // Not ready yet

    // Check if synth.run already triggered
    const already = await tx
      .select({ id: pipeline_events.id })
      .from(pipeline_events)
      .where(
        and(
          eq(pipeline_events.report_id, reportId),
          eq(pipeline_events.stage, "synth.run"),
          eq(pipeline_events.event, "started")
        )
      )
      .limit(1);

    if (already.length > 0 && reason !== "retry") return;

    // Emit synthesis job
    await inngest.send({
      name: "synth.run",
      data: { reportId, reason }
    });
  });
}
```

**How it prevents duplicate synthesis**:
1. Advisory lock ensures only one thread executes this at a time
2. Checks if synth.run event already sent (via pipeline_events)
3. Only sends once

**Database reads**:
- `report_platform_jobs` (all jobs for report)
- `pipeline_events` (check if synth.run already sent)

**Database writes**: None (only reads to check state)

**Event emitted**:
```typescript
{
  name: "synth.run",
  data: { reportId, reason }
}
```

**Called by**: 
- `llm.stage-b` handler after each platform completes
- Inngest onFailure handlers (if platform job fails)

**Failure modes**:
- Advisory lock blocks indefinitely (shouldn't happen, lock is transaction-scoped)
- Inngest dispatch fails → synthesis never starts → report stuck

---

### Step 13: Worker Receives `synth.run` Event

**Worker process**: `packages/worker/src/synth/index.ts`

**Handler function**: `packages/worker/src/synth/run.ts:synthRun()`

**Inngest config**:
```typescript
inngest.createFunction(
  {
    id: "synth-run",
    concurrency: [{ limit: 1, key: "event.data.reportId" }],  // serialize per report
    retries: 2,
    idempotency: "event.data.reportId + ':' + (event.data.reason ?? 'fan-in')",
  },
  { event: "synth.run" },
  ...
)
```

---

### Step 13a: Load & Verify Data

**Location**: `packages/worker/src/synth/run.ts`, lines 40–50

**Database reads**:
- `report_platform_jobs` (check which platforms failed)
- If all failed → throw PermanentError("all platforms failed")

---

### Step 13b: Run Pipeline (Stages C, D, E)

**Location**: `packages/worker/src/pipeline/run.ts:runPipeline(reportId)`

**Stage C: Merge/Cluster Complaints Across Platforms**
- **Function**: `packages/worker/src/pipeline/stage-c-merge.ts:runStageCMerge()`
- **Input**: All platform briefs + extracts
- **LLM task**: Deduplicate complaints across platforms, cluster by theme
- **Output**: 
  - `report_complaints` (top complaints)
  - `report_feature_gaps` (missing features)
  - `report_pricing_tiers` & `report_pricing_quotes` (pricing signals)
  - `report_switching` (switching patterns, inbound/outbound)
- **Timeout**: 60s
- **Max attempts**: 3

**Stage D: Synthesize Insights**
- **Function**: `packages/worker/src/pipeline/stage-d-synth.ts:runStageDSynth()`
- **Input**: Merged data from Stage C
- **LLM task**: Generate high-level insights (voice, positioning, actions, opportunities, leads)
- **Output**:
  - `report_voice_summary` & `report_voice_words` (customer voice)
  - `report_positioning` (messaging angles)
  - `report_actions` (strategic recommendations)
  - `report_leads` (lead gen opportunities)
  - `report_opportunities` (product opportunities)
  - `report_quotes` (top quotes)
- **Timeout**: 90s
- **Max attempts**: 3

**Stage E: Refine & Polish**
- **Function**: `packages/worker/src/pipeline/stage-e-refine.ts:runStageERefine()`
- **Input**: Outputs from Stage D
- **LLM task**: Polish language, ensure consistency, calculate sentiment metrics
- **Output**: Finalized report data with sentiment metrics
- **Timeout**: 90s
- **Max attempts**: 2

**Checkpoint system** (in `packages/worker/src/pipeline/run.ts`, lines 39–59):
```typescript
async function loadCheckpoints(reportId: string): Promise<Map<string, Record<string, unknown>>> {
  const rows = await db.select().from(report_pipeline_checkpoints)
    .where(eq(report_pipeline_checkpoints.report_id, reportId));
  return new Map(rows.map((r) => [r.stage, r.output]));
}
```

- Saves checkpoint after each stage completes
- If synth worker crashes, next retry loads checkpoint and skips completed stages
- Prevents redundant LLM calls

---

### Step 13c: Persist Final Report Data

**Location**: `packages/worker/src/pipeline/persist.ts:persistReport(reportId, output)`

**Database writes** (bulk inserts):
- `report_complaints` (with sort_order)
- `report_feature_gaps`
- `report_pricing_tiers`
- `report_pricing_quotes`
- `report_switching` (inbound + outbound)
- `report_voice_words` (positive + negative)
- `report_voice_summary`
- `report_positioning`
- `report_actions`
- `report_leads`
- `report_opportunities`
- `report_quotes`
- `report_platform_stats` (per-platform summary)
- `report_subreddits` (if Reddit data exists)
- `report_threads` & `report_thread_messages` (source evidence)
- `reports` (update with sentiment, voice, pricing, switching, stage, status)

**All writes in single transaction** (ensures atomicity)

---

### Step 13d: Mark Report Complete

**Location**: `packages/worker/src/synth/run.ts`, lines 55–65

**Database writes**:
- **Table**: `reports`
  - `status: "completed"`
  - `stage: "done"`
  - `partial: false|true` (true if any platform failed)
  - `failed_platforms: ["reddit", "appstore"]` (JSON array)
  - `scanned_at: now()`
  - `sentiment_overall`, `sentiment_positive`, `sentiment_negative`, `sentiment_neutral`
  - `sentiment_trend` (improving/stable/declining)
  - `sentiment_series` (array of sentiment scores)
  - `voice_summary`, `voice_phrases`
  - `pricing_blended`, `pricing_pain_score`
  - `switching_net_signal`, `switching_reasons_out`

---

### Step 14: Frontend Polls Progress & Detects Completion

**Hook**: `useReportProgressQuery(reportId)` in `packages/web/src/hooks/queries/use-reports.ts`

**Endpoint**: `GET /v1/reports/{reportId}/progress`

**Handler**: `packages/api/src/controllers/reports/handlers/getProgress.ts`

**When frontend detects** `report.status === "completed"`:
- Stops polling progress
- Switches to rendering full report
- Fetches all report sections asynchronously:
  - `useReportComplaintsQuery`
  - `useReportFeatureGapsQuery`
  - `useReportPricingQuery`
  - `useReportVoiceQuery`
  - `useReportSwitchingQuery`
  - `useReportPositioningQuery`
  - `useReportActionsQuery`
  - `useReportLeadsQuery`
  - `useReportOpportunitiesQuery`
  - `useReportQuotesQuery`
  - `useReportThreadsQuery` (source evidence)

---

### Step 15: Frontend Renders Final Report

**Component**: `packages/web/src/routes/report.tsx:PainReport`

**Sections rendered**:
- Report header (competitor, category, date, partial indicator)
- Top complaints (pain clusters)
- Feature gaps
- Pricing pain section
- Switching signals (inbound/outbound)
- Voice of Customer (quotes + sentiment)
- Positioning angles
- Product opportunities
- Strategic actions
- Lead generation opportunities
- Source evidence (threads with direct quotes)

---

## Summary: Full Lifecycle State Transitions

| Component | Initial | Processing | Terminal | Failure |
|-----------|---------|------------|----------|---------|
| `reports.status` | queued | running | completed | failed |
| `reports.stage` | queued | scraping → clustering → done | done | failed |
| `report_platform_jobs.status` | queued | running | completed | failed |
| `report_platform_jobs.stage` | scrape | stage_a → stage_b → done | done | failed |
| **Duration** | ~1s (insert) | **5–15 min** | - | - |

---

## Current Domain Model

### Core Business Entities

1. **Competitor** (what the user wants to track)
   - Attributes: name, website, category, socials, monitoring settings
   - File: `packages/api/src/db/schema/competitors.ts`
   - Purpose: Reference entity for reports, can be reused across many reports

2. **Report** (what the user is buying)
   - Attributes: category, goal, audience, competitors list
   - Output: comprehensive pain/signal report
   - File: `packages/api/src/db/schema/reports.ts`
   - Purpose: Main product entity

3. **Source Job** (a task to fetch from one platform for one report)
   - Attributes: report_id, platform, status, stage, retry count
   - File: `packages/api/src/db/schema/pipeline.ts:report_platform_jobs`
   - Purpose: Tracks individual scrape + extract tasks

4. **Mention/Evidence** (raw data point from a source)
   - Attributes: external_id, url, author, title, body, score, created_at
   - File: `packages/api/src/db/schema/mentions.ts`
   - Purpose: Source data, used for extraction + evidence

5. **Platform Brief/Extract** (intermediate representation)
   - Attributes: extract (structured JSON), summary (prose), model, tokens
   - File: `packages/api/src/db/schema/pipeline.ts:report_platform_briefs`
   - Purpose: Per-platform analysis, input to final synthesis

6. **Final Report Sections** (sliced views of the synthesis output)
   - Tables:
     - `report_complaints`
     - `report_feature_gaps`
     - `report_pricing_*`
     - `report_switching`
     - `report_voice_*`
     - `report_positioning`
     - `report_actions`
     - `report_leads`
     - `report_opportunities`
     - `report_quotes`
   - Purpose: User-facing output, renders in UI

7. **Pipeline Event** (audit trail)
   - Attributes: report_id, stage, event (started/completed/failed), platform, attempt, duration, metadata
   - File: `packages/api/src/db/schema/pipeline-events.ts`
   - Purpose: Progress tracking, debugging

---

### Domain Model Critique

**Is "Competitor" the right primary product object?**

No, not really.

- Users don't care about managing competitors; they care about **research scans/reports**
- A competitor can be used in multiple reports
- The value is in the **report**, not the competitor record
- Competitors are just input parameters to a report

**Better model for long-term**:

Rename internal concepts:
- "Competitor" → "Tracked Entity" (could be product, company, category)
- "Report" → "Research Scan" (makes purpose clearer)
- "Source Job" → "Data Collection Task"
- "Platform Brief" → "Source Summary"

But for MVP: current names are fine. Changing entity names is not worth the churn.

**Which names are confusing?**

1. `report_platform_jobs` — "jobs" is vague. Better: `source_tasks` or `collection_tasks`
2. `report_platform_briefs` — "brief" is jargon. Better: `source_extracts` or `source_summaries`
3. `ENABLED_PLATFORMS` — unclear if this is sources, platforms, or something else. Better: `ENABLED_SOURCES`
4. "Platform" vs "Source" — used inconsistently. Should pick one term.
5. `report_*` prefix on every table — every table belongs to a report. Prefix is noise. But too late to change.

**Recommended domain terminology for RivalEye going forward**:

- "Competitor" → stays (simple, user-facing)
- "Report" → stays (clear)
- "Source" or "Data Source" (not "Platform", not "Channel") → replace ENABLED_PLATFORMS with ENABLED_SOURCES
- "Source Job" (not "Platform Job") → internal terminology
- "Source Extract" (not "Brief") → clarifies what it is

---

## Current Database Schema Map

### Table: `competitors`

**File**: `packages/api/src/db/schema/competitors.ts`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK, default random | Unique ID |
| `owner_id` | UUID | FK → users.id | Associate with user |
| `name` | text | NOT NULL | Competitor name |
| `slug` | text | Unique per owner | URL-friendly identifier |
| `website` | text | optional | Company website |
| `category` | text | optional | Market segment |
| `color` | text | optional | UI color |
| `priority` | enum | optional | "primary", "secondary", "tertiary" |
| `tags` | text[] | optional | User-defined labels |
| `socials` | jsonb | optional | LinkedIn, Twitter, GitHub, YouTube, ProductHunt, blog |
| `monitor_enabled` | bool | default false | Monitoring toggle |
| `monitor_sensitivity` | enum | optional | "low", "med", "high" |
| `monitor_watch` | text[] | optional | Fields to monitor |
| `notes` | text | optional | User notes |
| `created_at` | timestamp | NOT NULL, default now | Creation time |
| `updated_at` | timestamp | NOT NULL, default now | Last update |

**Indexes**: 
- PK on id
- FK on owner_id

**Used by**:
- `packages/api/src/services/competitors.service.ts` (all CRUD)
- Frontend: `packages/web/src/api/competitors.ts`

**Issues**:
- No unique constraint on (owner_id, slug) — slug can duplicate across owners (fine, slugs are per-owner anyway)
- No index on owner_id for fast lookup of user's competitors
- `monitor_*` fields not actively used yet

---

### Table: `reports`

**File**: `packages/api/src/db/schema/reports.ts`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Unique report ID |
| `owner_id` | UUID | FK → users.id | Associate with user |
| `category` | text | NOT NULL | Market/product category |
| `competitors` | jsonb | NOT NULL, array | List of competitor names |
| `audience` | text | optional | Target audience for report |
| `goal` | enum | NOT NULL | "validate_idea", "find_user_pain", etc. (6 values) |
| `status` | enum | NOT NULL, default "queued" | "queued", "running", "completed", "failed", "cancelled" |
| `stage` | enum | NOT NULL, default "queued" | "queued", "scraping", "clustering", "done", "failed", "cancelled" |
| `error` | text | optional | Error message if failed |
| `primary_competitor_name` | text | optional | First competitor (for display) |
| `primary_competitor_domain` | text | optional | Domain (not currently populated) |
| `scanned_at` | timestamp | optional | When scan completed |
| `time_range` | text | optional | Date range of data |
| `total_sources` | int | optional | Number of mentions fetched |
| `total_threads` | int | optional | Number of threads fetched |
| `sentiment_overall` | real | optional | -1.0 to 1.0 |
| `sentiment_positive` | real | optional | Proportion positive |
| `sentiment_negative` | real | optional | Proportion negative |
| `sentiment_neutral` | real | optional | Proportion neutral |
| `sentiment_trend` | text | optional | "improving", "declining", "stable" |
| `sentiment_series` | jsonb | optional | Array of sentiment scores over time |
| `voice_summary` | text | optional | Customer voice narrative |
| `voice_phrases` | jsonb | optional | Array of key phrases |
| `pricing_blended` | text | optional | Overall pricing sentiment |
| `pricing_pain_score` | real | optional | 0–100 pain score |
| `switching_net_signal` | text | optional | "inbound", "outbound", "neutral" |
| `switching_reasons_out` | jsonb | optional | Array of reasons users switch away |
| `partial` | bool | NOT NULL, default false | True if any source failed |
| `failed_platforms` | text[] | NOT NULL, default {} | List of failed sources |
| `created_at` | timestamp | NOT NULL | Created when |
| `updated_at` | timestamp | NOT NULL | Last updated when |

**Indexes**:
- PK on id
- FK on owner_id (should have index for fast user lookup)

**Used by**:
- `packages/api/src/services/reports.service.ts` (CRUD)
- Worker: `packages/worker/src/scrape/fetch.ts`, `packages/worker/src/llm/stage-a.ts`, `packages/worker/src/synth/run.ts`
- Frontend: All report detail queries

**Issues**:
- Missing index on owner_id (slow user report list)
- `primary_competitor_domain` never populated
- `time_range` not set
- `sentiment_series` is array but frontend may not use it
- `stage` and `status` could be consolidated (both track progress)

---

### Table: `report_platform_jobs`

**File**: `packages/api/src/db/schema/pipeline.ts`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Job ID |
| `report_id` | UUID | FK → reports.id (cascade delete) | Parent report |
| `platform` | text | NOT NULL | "reddit", "appstore", etc. |
| `status` | enum | NOT NULL, default "queued" | "queued", "running", "completed", "failed" |
| `error` | text | optional | Error message |
| `stage` | enum | NOT NULL, default "scrape" | "scrape", "stage_a", "stage_b", "done", "failed" |
| `attempt_count` | int | NOT NULL, default 0 | Retry counter |
| `last_error` | text | optional | Last error message |
| `last_event_at` | timestamp | optional | When last event fired |
| `started_at` | timestamp | optional | When worker started |
| `completed_at` | timestamp | optional | When worker finished |
| `created_at` | timestamp | NOT NULL | Created when |

**Constraints**:
- Unique on (report_id, platform) — prevents duplicate job per source
- Index on report_id

**Used by**:
- Worker: All stages read/write
- API: createReport inserts, getProgress reads
- Frontend: Progress polling

**Issues**:
- `error` column never used (last_error is used instead)
- No index on created_at (can't easily find old jobs for cleanup)
- `stage` could be derived from presence of data in report_platform_briefs, but explicit tracking is good

---

### Table: `mentions`

**File**: `packages/api/src/db/schema/mentions.ts`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Mention ID |
| `report_id` | UUID | FK → reports.id | Parent report |
| `platform` | text | NOT NULL | Source ("reddit", etc.) |
| `external_id` | text | NOT NULL | Platform's post ID |
| `url` | text | optional | Post URL |
| `author` | text | optional | Post author |
| `title` | text | optional | Post title |
| `body` | text | optional | Post body/content |
| `score` | int | optional | Upvotes/karma |
| `num_comments` | int | optional | Reply count |
| `posted_at` | timestamp | optional | When posted (can be old data) |
| `raw` | jsonb | optional | Platform-specific metadata |
| `created_at` | timestamp | NOT NULL | When we fetched it |

**Constraints**:
- Unique on (report_id, platform, external_id) — prevents duplicate mentions
- Indexes on report_id, platform

**Used by**:
- Worker (scrape): Inserts
- Worker (llm stages): Reads for extraction
- Frontend: Can query for evidence/source

**Issues**:
- `raw` can bloat table (JSON stores platform-specific data)
- No pagination/limit on mentions per report (could fetch thousands)
- No way to know if a mention was actually used in the final report

---

### Table: `report_platform_briefs`

**File**: `packages/api/src/db/schema/pipeline.ts`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Brief ID |
| `report_id` | UUID | FK → reports.id | Parent report |
| `platform` | text | NOT NULL | Source |
| `extract` | jsonb | NOT NULL | Structured extraction (pain points, gaps, etc.) |
| `summary` | jsonb | NOT NULL | Prose summary |
| `model_used` | text | NOT NULL | LLM model name |
| `prompt_tokens` | int | default 0 | LLM usage |
| `completion_tokens` | int | default 0 | LLM usage |
| `created_at` | timestamp | NOT NULL | Created when |

**Constraints**:
- Unique on (report_id, platform)
- Indexes on report_id

**Used by**:
- Worker (stage-a): Inserts extract, empty summary
- Worker (stage-b): Updates with summary
- Worker (synthesis): Reads for merging
- (Not exposed to frontend directly)

**Purpose**: Intermediate representation between per-source extraction and final synthesis

---

### Table: `report_complaints`

**File**: `packages/api/src/db/schema/reports.ts`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Complaint ID |
| `report_id` | UUID | FK → reports.id | Parent report |
| `complaint` | text | NOT NULL | The complaint text |
| `severity` | text | optional | "high", "medium", "low" |
| `affected_users` | int | optional | Estimated count |
| `sources` | text[] | optional | Which platforms mention it |
| `sort_order` | int | optional | Display order |

**Used by**:
- Worker: Inserts during synthesis
- Frontend: Renders complaint cards

---

### Table: `report_feature_gaps`

Similar to complaints. Represents missing features users want.

---

### Table: `report_pricing_*`

- `report_pricing_tiers` — pricing models mentioned
- `report_pricing_quotes` — direct quotes about pricing
- `pricing_blended` (in reports table) — overall sentiment
- `pricing_pain_score` (in reports table) — 0–100 score

---

### Table: `report_switching`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | ID |
| `report_id` | UUID | FK |
| `direction` | enum | "inbound" (switching to competitor) or "outbound" (switching from competitor) |
| `reason` | text | Why they switch |
| `sort_order` | int | Display order |

---

### Table: `report_voice_words`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | ID |
| `report_id` | UUID | FK |
| `word` | text | Sentiment word or phrase |
| `kind` | enum | "positive" or "negative" |
| `frequency` | int | How often mentioned |
| `sort_order` | int | Display order |

---

### Table: `pipeline_events`

**File**: `packages/api/src/db/schema/pipeline-events.ts`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Event ID |
| `report_id` | UUID | FK |
| `stage` | text | "scrape.fetch", "llm.stage_a", "llm.stage_b", "synth.run" |
| `event` | text | "started", "completed", "failed", "retrying" |
| `platform` | text | optional, which source |
| `attempt` | int | Attempt number |
| `duration_ms` | int | optional, how long |
| `error` | text | optional, error message |
| `metadata` | jsonb | optional, additional data |
| `created_at` | timestamp | When event occurred |

**Used by**:
- Worker: Inserts progress events
- Frontend: Displays event timeline in progress UI

---

### Missing Tables

**No explicit error/retry tracking table.**

Retries are tracked via `attempt_count` on source jobs, but there's no dead-letter queue or explicit "failed jobs" log. Failed jobs just stay in `report_platform_jobs` with `status="failed"`.

**No job locking/lease table.**

With Inngest, events have idempotency keys. With a Postgres job runner, we'd need either:
- Advisory locks (what the code currently uses for fan-in)
- Or explicit lease/heartbeat table (more explicit but more complex)

---

### Schema Issues Summary

| Issue | Impact | Fix |
|-------|--------|-----|
| No index on reports.owner_id | Slow user report list | Add index |
| Redundant error columns in source_jobs | Confusion | Keep last_error, remove error |
| stage vs status duplication | Confusion | Consolidate or document |
| No cleanup/retention policy | DB bloat over time | Add job for archiving old reports |
| No explicit dead-letter queue | Failed jobs hard to find | Add failed_jobs_log table or query failed status |
| Unique constraint on (report_id, platform) prevents retry | Jobs can't be retried | Change to (report_id, platform, attempt) or use attempt_count for retry logic |
| No locking mechanism for job claiming | Concurrent workers could claim same job | Need advisory lock or lease table |

---

## Current Worker and Inngest Map

### Worker Process 1: Worker-Scrape

**File**: `packages/worker/src/scrape/index.ts` (entry point)

**Function**: `scrapeFetch` in `packages/worker/src/scrape/fetch.ts`

| Property | Value |
|----------|-------|
| Inngest event name | `scrape.fetch` |
| Function ID | `scrape-fetch` |
| Concurrency | 8 global, 1 per (reportId, platform) |
| Retries | 3 attempts |
| Idempotency key | `reportId:platform` |
| Timeout per step | Varies (fetch can be 30s+) |

**Input payload**:
```typescript
{
  reportId: string,
  platform: "reddit" | "appstore" | ...,
  competitor: string,
  category: string,
  keywords: string[]
}
```

**Steps**:
1. `emit-started` — log event, mark job running
2. `fetch-posts` — call scraper.fetch()
3. `persist-mentions` — bulk insert into mentions table
4. `mark-stage-a` — update job stage to "stage_a", send llm.stage-a event

**Database reads**:
- None in main flow

**Database writes**:
- `report_platform_jobs` (status, started_at, attempt_count, stage)
- `reports` (status → running)
- `pipeline_events` (started event)
- `mentions` (all posts fetched)

**Next event emitted**: `llm.stage-a`

**Failure modes**:
- Scraper returns 0 posts (valid, continues)
- Scraper throws error (caught, logged, retried 3x)
- DB write fails (retried)
- onFailure handler: calls `onFailureFinalize()` + `fanInCheck()`
  - Marks job as failed
  - Triggers fan-in to check if all jobs terminal

---

### Worker Process 2: Worker-LLM

**File**: `packages/worker/src/llm/index.ts`

#### Function 2a: `stageA`

**File**: `packages/worker/src/llm/stage-a.ts`

| Property | Value |
|----------|-------|
| Inngest event | `llm.stage-a` |
| Function ID | `llm-stage-a` |
| Concurrency | 4 global |
| Retries | 4 attempts |
| Idempotency | `reportId:platform:a` |
| Timeout | 30s per step (60s total) |

**Input payload**:
```typescript
{
  reportId: string,
  platform: string
}
```

**Steps**:
1. `emit-started` — log event
2. `extract` — read mentions, call LLM extraction
3. `save-brief` — insert into report_platform_briefs

**Database reads**:
- `reports` (for context: competitor, category, audience, goal)
- `mentions` (all posts for this report+platform)

**Database writes**:
- `report_platform_jobs` (stage → stage_a)
- `report_platform_briefs` (insert, extract + empty summary)
- `pipeline_events` (started, completed)

**Next event**: `llm.stage-b`

**Failure handling**:
- onFailure: marks job as failed, calls fanInCheck()

---

#### Function 2b: `stageB`

**File**: `packages/worker/src/llm/stage-b.ts`

| Property | Value |
|----------|-------|
| Inngest event | `llm.stage-b` |
| Function ID | `llm-stage-b` |
| Concurrency | 4 global |
| Retries | 4 attempts |
| Idempotency | `reportId:platform:b` |
| Timeout | 30s per step |

**Input payload**:
```typescript
{
  reportId: string,
  platform: string
}
```

**Steps**:
1. `emit-started` — log event
2. `summarize` — read extract, call LLM summarization
3. `update-brief` — update report_platform_briefs with summary
4. `mark-done` — mark job status as completed, call fanInCheck()

**Database reads**:
- `report_platform_briefs` (extract from stageA)

**Database writes**:
- `report_platform_jobs` (status → completed, stage → done, completed_at)
- `report_platform_briefs` (update summary)

**Next action**: Calls `fanInCheck(reportId)` which may emit `synth.run` if all jobs terminal

---

### Worker Process 3: Worker-Synth

**File**: `packages/worker/src/synth/index.ts`

**Function**: `synthRun` in `packages/worker/src/synth/run.ts`

| Property | Value |
|----------|-------|
| Inngest event | `synth.run` |
| Function ID | `synth-run` |
| Concurrency | 1 per reportId (serialize) |
| Retries | 2 attempts |
| Idempotency | `reportId:(reason ?? 'fan-in')` |
| Timeout | Very long (synthesis can take minutes) |

**Input payload**:
```typescript
{
  reportId: string,
  reason: "fan-in" | "retry"  // why synthesis triggered
}
```

**Steps**:
1. `emit-started` — log event
2. `compute-failed` — read source jobs, identify which failed
3. `run-pipeline` — call runPipeline(reportId)
   - Stages C, D, E run here (see below)
   - LLM calls happen here
4. `mark-report-done` — update reports table

**Database reads**:
- `reports` (main report)
- `report_platform_jobs` (which sources succeeded/failed)
- `report_platform_briefs` (all extracts for merging)
- `report_pipeline_checkpoints` (resume from checkpoint)

**Database writes**:
- All `report_*` detail tables (complaints, gaps, pricing, etc.)
- `report_pipeline_checkpoints` (save state after each stage)
- `reports` (status → completed, stage → done, sentiment, voice, pricing, switching, partial flag)

**Failure handling**:
- onFailure: marks report as failed, stores error message

---

### Worker Functions: Inngest Configuration Summary

| Function | Event | Trigger | Concurrency | Retries | Idempotency | Next Event |
|----------|-------|---------|-------------|---------|-------------|-----------|
| scrapeFetch | scrape.fetch | API send | 8 global, 1 per job | 3 | reportId:platform | llm.stage-a |
| stageA | llm.stage-a | scrape complete | 4 global | 4 | reportId:platform:a | llm.stage-b |
| stageB | llm.stage-b | stageA complete | 4 global | 4 | reportId:platform:b | synth.run (via fan-in) |
| synthRun | synth.run | all sources done | 1 per report | 2 | reportId:reason | (none, completes) |

---

### Stuck Job Scenarios

**Scenario 1: scrapeFetch succeeds but llm.stage-a event never sent**

- source job stuck with stage="stage_a", status="completed" (marked by stageB)
- But stageA never received the event
- fanInCheck waits for all jobs to be terminal (they are)
- synthRun starts with incomplete data

**Scenario 2: stageB succeeds but fanInCheck doesn't send synth.run**

- All source jobs marked completed
- fanInCheck triggered by last stageB
- Advisory lock acquired
- synthRun event sent to Inngest
- **But**: if Inngest dispatch fails, event lost
- Report stuck with status="running", all source jobs done

**Scenario 3: synthRun receives event but crashes mid-pipeline**

- synth.run starts (attempt=1)
- Stage C completes, checkpoint saved
- Stage D LLM call fails (timeout or error)
- Worker crashes
- Inngest retries (attempt=2)
- Checkpoint loaded, Stage C skipped, Stage D retried
- Works on 2nd attempt, report completes

**Scenario 4: All sources fail but synthRun still triggered**

- scrape fails for all 6 platforms
- All source jobs status="failed"
- fan-in check fires (all terminal)
- synthRun event sent
- synthRun checks: "no successful sources" → throws PermanentError
- onFailure handler marks report.status="failed"
- Report marked failed

---

## Current Report Creation Flow

**Route handler file**: `packages/api/src/controllers/reports/handlers/createReport.ts`

**Service file**: `packages/api/src/services/reports.service.ts:createReport()`

### Full Code Walkthrough

```typescript
export const createReportHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/",
    async ({ log, body, user, status }) => {
      try {
        const report = await createReport(user!.id, body);
        return ok({ id: report.id, stage: "queued" as const });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to create report",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: t.Object({
        category: t.String({ minLength: 1 }),
        competitors: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 5 }),
        target_audience: t.String({ minLength: 1 }),
        founder_goal: t.Union([
          t.Literal("validate_idea"),
          // ...6 values total
        ]),
      }),
    }
  );
```

### Step-by-Step: createReport() Service

**Location**: `packages/api/src/services/reports.service.ts`, lines 66–117

```typescript
export async function createReport(
  owner_id: string,
  input: CreateReportInput,
): Promise<{ id: string }> {
  // ===== STEP 1: Insert report row =====
  const [row] = await db
    .insert(reports)
    .values({
      owner_id,
      category: input.category,
      competitors: input.competitors,
      audience: input.target_audience,
      goal: input.founder_goal,
      status: "queued",
      stage: "queued",
      primary_competitor_name: input.competitors[0] ?? null,
    })
    .returning({ id: reports.id });

  if (!row) throw new Error("Failed to insert report");

  // ===== STEP 2: Expand keywords =====
  const competitor = input.competitors[0] ?? input.category;
  const keywords = await expandKeywords(getLlm(), {
    competitor,
    category: input.category,
    audience: input.target_audience,
    goal: input.founder_goal,
  });
  // Keywords: ["notion alternative", "notion pricing complaints", ...]

  // ===== STEP 3: Create source jobs =====
  await db.insert(report_platform_jobs).values(
    ENABLED_PLATFORMS.map((platform) => ({
      report_id: row.id,
      platform,
      status: "queued" as const,
    })),
  );
  // 6 rows inserted (one per enabled platform)

  // ===== STEP 4: Send Inngest events =====
  await inngest.send(
    ENABLED_PLATFORMS.map((platform) => ({
      name: "scrape.fetch" as const,
      data: {
        reportId: row.id,
        platform,
        competitor,
        category: input.category,
        keywords,
      },
    })),
  );
  // 6 events queued to Inngest

  // ===== STEP 5: Return =====
  return { id: row.id };
}
```

---

### Failure Analysis

**1. What if keyword expansion fails?**

- `expandKeywords()` throws error (missing LLM key, timeout, etc.)
- Error propagates to handler
- Handler catches, logs, returns 400
- **BUT**: report row was already inserted
- **AND**: source jobs were NOT created (we failed before step 3)
- User can't retry (report exists with no jobs)

**2. What if source job insertion partially fails?**

- Not possible; `db.insert().values([...])` is atomic
- Either all 6 inserts succeed or none do
- If Drizzle transaction fails, nothing is committed

**3. What if Inngest dispatch fails?**

- `inngest.send()` throws error (401, network, etc.)
- Error bubbles to handler
- Handler catches, logs, returns 400
- **CRITICAL**: Report + source jobs already exist in DB
- **CRITICAL**: Jobs will never be processed (events never sent)
- **CRITICAL**: No cleanup or alerting

**This is THE failure mode.**

---

### Is the Current Flow Transactional?

**Partially, but not fully.**

- Report insert + source job inserts are in same transaction (atomic)
- But Inngest dispatch is AFTER transaction commits
- So jobs exist in DB even if Inngest fails

**Should it be more transactional?**

There are two philosophies:

**Option A: Optimistic (current)**
- Insert jobs immediately
- Try to send events
- If events fail, jobs orphaned but visible (bad)

**Option B: Pessimistic**
- Insert jobs
- Send events (must succeed)
- If events fail, rollback jobs and return error
- User retries, creates report again
- Problem: User doesn't know what went wrong

**For a Postgres job runner** (recommended):
- Insert report + jobs in one transaction
- Events are just writes to job table (same transaction)
- Either everything succeeds or nothing commits
- Much simpler model

---

### Why Jobs Get Stuck: Root Cause

1. **Report created** with status="queued"
2. **Source jobs created** with status="queued"
3. **Inngest events fail to send** (INNGEST_EVENT_KEY missing, server down, etc.)
4. **Error bubbles to API handler**, returns 400 to client
5. **But report + jobs remain in DB**, now orphaned
6. **Workers never receive events** (they were never sent/delivered)
7. **Frontend polls progress**, sees status still "queued"
8. **Frontend shows infinite loading** (no progress)
9. **Job sits in DB forever** with status="queued"

**The problem is not the database or API logic. The problem is the event dispatch layer has no fallback.**

---

## Enabled Sources / Platform Readiness

### Where ENABLED_PLATFORMS is Defined

**File**: `packages/shared/src/index.ts`

```typescript
export const ENABLED_PLATFORMS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
] as const;
```

### Scraper Inventory

| Platform | Scraper Type | Status | File Path | Works? | Notes |
|----------|--------------|--------|-----------|--------|-------|
| **reddit** | DIY | MVP | `packages/scrapers/src/reddit/` | ✅ Functional | Uses Reddit API, documented, has auth |
| **appstore** | DIY | MVP | `packages/scrapers/src/appstore/` | ⚠️ Unknown | Not tested in this debug |
| **playstore** | DIY | MVP | `packages/scrapers/src/playstore/` | ⚠️ Unknown | Not tested |
| **hackernews** | DIY | MVP | `packages/scrapers/src/hackernews/` | ⚠️ Unknown | Not tested |
| **producthunt** | DIY | MVP | `packages/scrapers/src/producthunt/` | ⚠️ Unknown | Not tested |
| **devto** | DIY | MVP | `packages/scrapers/src/devto/` | ⚠️ Unknown | Not tested |

**Important discovery**: We haven't actually tested if the scrapers work. We've only tested the database layer and Inngest integration.

### Missing Sources (Not Enabled)

The CLAUDE.md mentions these sources as part of MVP scope:
- G2 (Apify-backed)
- Capterra (Apify-backed)
- Twitter/X (Apify-backed)
- LinkedIn (Apify-backed)
- Google Maps Reviews (Apify-backed)
- Trustpilot (API-backed?)

But they're not in ENABLED_PLATFORMS, suggesting they're not ready yet.

### Scraper Naming Confusion

The codebase uses:
- "platform" (in most places)
- "source" (sometimes)
- "channel" (rarely)
- "data source" (documentation)

**Recommendation**: Standardize on "source" or "data source". The current mix is confusing.

### Which Sources Should Be Prioritized for MVP?

Based on:
1. No external dependencies (no API keys, no Apify)
2. Likely data quality
3. User value

**Tier 1 (Must have)**:
- Reddit (high volume, targeted communities, strong signals)

**Tier 2 (Should have)**:
- ProductHunt (founder audience, explicit feature requests)
- HackerNews (developer/technical audience, detailed discussion)

**Tier 3 (Nice to have)**:
- DevTo (developer audience)
- AppStore/PlayStore (mobile product signals)

**Tier 4 (Post-MVP)**:
- G2, Capterra (review sites, require Apify $)
- LinkedIn (social signals, requires Apify $)
- Twitter/X (market noise, hard to filter)
- Google Maps (local business only)

---

## Frontend Progress Polling

### Component Location

**Route**: `/reports/:id`  
**File**: `packages/web/src/routes/report.tsx:ReportPage`

### Polling Hook

**File**: `packages/web/src/hooks/queries/use-reports.ts`

```typescript
export function useReportProgressQuery(reportId: string) {
  return useQuery({
    queryKey: ["report-progress", reportId],
    queryFn: () => api.v1.reports(reportId).progress.get(),
    refetchInterval: 2000,  // Poll every 2 seconds
    refetchIntervalInBackground: true,  // Keep polling if tab loses focus
  });
}
```

### API Endpoint

**Handler**: `packages/api/src/controllers/reports/handlers/getProgress.ts`

**Response shape**:
```typescript
{
  report: {
    id: string,
    status: "queued" | "running" | "completed" | "failed",
    partial: boolean,
    failed_platforms: string[]
  },
  platforms: Array<{
    platform: string,
    status: "queued" | "running" | "completed" | "failed",
    stage: "scrape" | "stage_a" | "stage_b" | "done" | "failed",
    attempt_count: number,
    last_event_at: timestamp,
    last_error: string | null
  }>,
  events: Array<{
    stage: string,
    event: "started" | "completed" | "failed" | "retrying",
    platform: string,
    attempt: number,
    duration_ms: number | null,
    created_at: timestamp
  }>,
  metrics: {
    mentions: number,
    comments: number,
    quotes: number,
    complaints: number
  }
}
```

### Frontend Rendering

**Component**: `packages/web/src/components/report/report-in-progress.tsx`

Displays:
- Report status as heading
- Per-platform progress bars
- Event timeline (last 20 events)
- Metrics (total mentions, comments, etc.)

### What Happens If Jobs Are Stuck?

If Inngest events never sent:
- `report.status` stays "queued" forever
- All `platforms[].status` stay "queued"
- No events appear in timeline
- `metrics` all stay 0
- Frontend shows loading spinner forever
- User refreshes page, same result
- User assumes product is broken

### What Happens on Partial Failure?

If 2 sources fail, 4 succeed:
- `report.partial` = true
- `failed_platforms` = ["reddit", "appstore"]
- Synthesis still runs (needs > 0 successful)
- Final report shows `partial: true` indicator
- Failed platforms show error message
- Report still completed (not failed)

### What Happens If All Sources Fail?

- `report.status` = "failed"
- `report.error` = "all platforms failed"
- All `platforms[].status` = "failed"
- Frontend shows error state
- User can't retry individual sources (no UI for it)

### UX Issues in Current Progress UI

**Problems**:
1. Loading spinner doesn't show actual progress (percent complete)
2. Can't distinguish "still running" from "stuck"
3. No "abort" or "cancel" button
4. No retry button for individual failed sources (exists in backend via `retryPlatform` endpoint but no UI)
5. Events timeline shows raw event names (not user-friendly)
6. No estimated time remaining

**Recommended improvements**:
- Show progress % (count of completed sources / 6)
- Add visual indicator of stuck (show per-platform time since last event)
- Show error messages inline per platform
- Add manual "retry this source" button
- Friendly event names ("Fetching Reddit posts...", "Analyzing data...", "Synthesizing insights...")
- Show ETA based on historical completion times

---

## Environment and Runtime Setup

### Required Environment Variables

| Variable | Used By | Required? | Type | Example | Missing Impact |
|----------|---------|-----------|------|---------|-----------------|
| `CONNECTION_STRING` | API + Worker | ✅ YES | string (Postgres URL) | `postgresql://...` | DB connection fails, app crashes |
| `BETTER_AUTH_SECRET` | API | ✅ YES | string (32+ chars) | Auto-generated | Auth fails, sessions invalid |
| `BETTER_AUTH_URL` | API | ✅ YES | string (URL) | `http://localhost:3001` | Auth redirects break |
| `INNGEST_EVENT_KEY` | API + Worker | ✅ YES (for worker) | string (`sk-...`) | From localhost:8288 | **Events fail with 401, jobs get stuck** |
| `OPENROUTER_API_KEY` | API + Worker | ✅ YES | string (API key) | From OpenRouter | Keyword expansion + LLM fails |
| `OPENROUTER_MODEL` | API + Worker | optional | string | `deepseek/deepseek-chat` | Defaults to free model |
| `REDDIT_CLIENT_ID` | Worker (scraper) | Conditional | string | From Reddit app | Reddit scraper fails |
| `REDDIT_CLIENT_SECRET` | Worker (scraper) | Conditional | string | From Reddit app | Reddit scraper fails |
| `REDDIT_USER_AGENT` | Worker (scraper) | Conditional | string | "RivalEye/1.0" | Reddit API blocks request |
| `PRODUCTHUNT_TOKEN` | Worker (scraper) | Conditional | string | GraphQL API token | ProductHunt scraper fails |
| `VITE_API_URL` | Frontend | ✅ YES | string (URL) | `http://localhost:3001` | Frontend can't call API |

### Local Dev Checklist for Full Pipeline

**Prerequisites**:
- [ ] Postgres running (Supabase or local)
- [ ] `.env` file with all required keys
- [ ] Node/Bun installed
- [ ] All dependencies installed (`pnpm install`)

**Inngest Setup**:
- [ ] Run `npx inngest-cli@latest dev` (Terminal 1)
- [ ] Visit `http://localhost:8288`
- [ ] Copy event key to `.env` as `INNGEST_EVENT_KEY`

**API**:
- [ ] Run `pnpm --filter @rivaleye/api dev` (Terminal 2)
- [ ] Check `http://localhost:3001/health` responds with `{ ok: true }`

**Workers** (all three must run simultaneously):
- [ ] Run `pnpm --filter @rivaleye/worker dev scrape` (Terminal 3)
- [ ] Run `pnpm --filter @rivaleye/worker dev llm` (Terminal 4)
- [ ] Run `pnpm --filter @rivaleye/worker dev synth` (Terminal 5)

**Frontend**:
- [ ] Run `pnpm --filter @rivaleye/web dev` (Terminal 6)
- [ ] Visit `http://localhost:5173`

**Test Flow**:
- [ ] Add a competitor
- [ ] Create a report
- [ ] Watch status change (should be "running" within 10s)
- [ ] Wait for completion (5–15 min depending on source speeds)
- [ ] Verify full report renders

### Documentation Gaps

**Missing from repo**:
- Clear "Getting Started" guide for full dev setup
- Checklist of which env keys are optional vs. required
- How to run just one source for faster testing
- How to mock/stub scrapers for development
- Expected completion times per source
- Troubleshooting guide ("jobs stuck? check these things...")

---

## Architecture Options Comparison

### Option A: Keep Inngest + Postgres

#### How It Works

- API creates report + source jobs in Postgres
- API sends `scrape.fetch` events to Inngest
- Inngest routes events to running worker processes (local dev server or cloud)
- Workers process events, emit next events
- All orchestration via Inngest events
- Postgres stores state only (snapshots of progress)

#### Pros

- **Event-driven**: Natural fit for async workflows
- **Resilient**: If worker crashes mid-process, Inngest retries with idempotency key
- **Cloud-ready**: Easy to deploy to serverless (Lambda, Cloud Functions)
- **Mature**: Inngest is proven, battle-tested
- **Type-safe**: EventSchemas in TypeScript
- **UI**: Inngest cloud dashboard shows event history
- **Scaling**: Can add workers without code changes

#### Cons

- **Operational complexity**: Another service to run locally + in production
- **Single point of failure**: If Inngest is down or keys wrong, entire system stalls
- **Hidden state**: Events can disappear into Inngest (hard to debug)
- **Configuration hell**: INNGEST_EVENT_KEY must be set, Inngest dev server must run
- **Vendor dependency**: Inngest is a third-party service
- **Cost**: Inngest pricing (free up to limits, then $$)
- **Local dev friction**: Developers must understand Inngest concepts
- **No fallback**: If events fail to send, no recovery mechanism

#### Failure Modes

1. **INNGEST_EVENT_KEY missing** → all events return 401, jobs stuck
2. **Inngest dev server down** → events queue but don't dispatch
3. **Network partition** → events sent but workers don't receive
4. **Event gets lost** → no visibility, no alerting, job silently stuck
5. **Worker crash mid-process** → retry doesn't fix idempotency if state wasn't saved

#### Debugging Experience

- Check Inngest cloud dashboard (if cloud deployment)
- Check worker logs (if local dev)
- Can't easily see if event was queued vs. delivered
- Need to understand Inngest's event model

#### Scale Analysis

**Excellent** for high scale. But MVP scale (10–100 reports/day) doesn't need it.

#### When to Choose

- If company already uses Inngest elsewhere
- If planning to scale to 10,000+ reports/day early
- If need serverless deployment
- If team is comfortable with event-driven systems

---

### Option B: Postgres-Backed Job Runner Only

#### How It Works

API creates report + source jobs:
```
INSERT INTO source_jobs (report_id, platform, status, stage, ...)
  VALUES (uuid, 'reddit', 'queued', 'fetch', ...)
```

Worker loop runs on fixed interval (e.g., every 2 seconds):
```typescript
while (true) {
  // Claim next job
  const jobs = await db
    .select()
    .from(source_jobs)
    .where(eq(source_jobs.status, 'queued'))
    .orderBy(asc(source_jobs.created_at))
    .limit(1)
    .for('update')
    .skipLocked();

  if (jobs.length === 0) {
    await sleep(2000);
    continue;
  }

  const job = jobs[0];

  // Mark running
  await db
    .update(source_jobs)
    .set({ status: 'running', started_at: now() })
    .where(eq(source_jobs.id, job.id));

  // Process job
  try {
    const posts = await fetchFromPlatform(job.platform, job.keywords);
    await saveMentions(job.report_id, posts);

    // Mark complete
    await db
      .update(source_jobs)
      .set({ status: 'completed', stage: 'extract', completed_at: now() })
      .where(eq(source_jobs.id, job.id));
  } catch (err) {
    // Mark failed
    await db
      .update(source_jobs)
      .set({ status: 'failed', last_error: err.message })
      .where(eq(source_jobs.id, job.id));
  }

  // Check if all jobs done
  await checkFanIn(job.report_id);
}
```

#### Pros

- **No external dependencies**: Just Postgres
- **Transparent**: All state visible in database
- **Simple to understand**: Poll, claim, process, repeat
- **Easy to debug**: View job state in `psql`, don't need external tools
- **Easy local dev**: Just need Postgres, no Inngest server
- **Stuck jobs visible**: Query `SELECT * FROM source_jobs WHERE status = 'running' AND updated_at < now() - interval '1 hour'` to find stuck jobs
- **Easy to operate**: Fewer moving parts
- **No secrets**: No INNGEST_EVENT_KEY needed
- **Better observability**: All logs can include job_id from Postgres

#### Cons

- **Polling overhead**: DB gets queried every 2s (manageable for MVP)
- **Stuck job recovery**: Need explicit cleanup job to handle crashed workers
- **No cloud functions**: Can't use serverless (workers must run continuously)
- **Scaling challenges**: High volume (10k+ jobs/day) means many DB queries
- **Job claiming complexity**: Need `SELECT ... FOR UPDATE SKIP LOCKED` (correct but unfamiliar to some)
- **Duplicate processing**: If worker crashes between claim and mark-running, job might be claimed twice (must handle idempotency in code)
- **No built-in retry**: Must implement retry logic ourselves
- **No UI**: No dashboard showing job progress (must query DB directly)

#### Failure Modes

1. **Worker crashes mid-process**: Job stays in `status='running'`, needs cleanup job to reset
2. **Duplicate claiming**: If two workers claim same job, both process it (mitigation: unique constraint + idempotency in scraper)
3. **Network partition**: Worker can't write to DB, doesn't mark job done, job stays running (cleanup job fixes it)
4. **Slow queries**: If many jobs queued, `SELECT ... WHERE status='queued'` could become slow (need index on status)

#### Debugging Experience

- Query jobs directly: `SELECT * FROM source_jobs WHERE report_id = '...' ORDER BY created_at`
- Can see entire job lifetime in one table
- Can manually retry job: `UPDATE source_jobs SET status='queued' WHERE id='...'`
- Logs can include job_id for tracing

#### Scale Analysis

**Good up to 1,000 reports/day (6,000 source_jobs/day)**:
- Polling every 2s = ~43k polls/day
- Each poll queries for queued jobs (with index, <1ms)
- No problem

**Acceptable up to 10,000 reports/day**:
- Polling every 1s = ~860k polls/day
- Might need to batch-claim (LIMIT 10 instead of LIMIT 1)
- Still works, but DB connection pool usage increases

**Not suitable for 100,000+ reports/day**:
- Polling becomes too frequent
- DB becomes bottleneck
- At this scale, move to BullMQ or Inngest

#### When to Choose

- MVP phase (true to "simple" principle)
- Team is comfortable with Postgres
- No serverless requirement
- Want maximum visibility + debuggability
- Expected scale is <10k reports/day for 1+ years

---

### Option C: BullMQ/Redis + Postgres

#### How It Works

API creates report + source jobs in Postgres, then queues job ID to Redis via BullMQ:
```typescript
const jobId = job.id;
const queue = new Queue('source_jobs', { connection: redis });
await queue.add('fetch', { report_id, platform, keywords });
```

BullMQ worker pulls from Redis queue:
```typescript
queue.process('fetch', async (bullJob) => {
  const { report_id, platform, keywords } = bullJob.data;
  // Process exactly like Option B
});
```

BullMQ features:
- Handles concurrency (maxConcurrency option)
- Retries with backoff
- Dead-letter queue for failed jobs
- Job timeouts
- Progress tracking
- Webhooks on completion

Postgres still stores complete state (jobs, mentions, briefs, final report).

#### Pros

- **Best of both**: Redis queue performance + Postgres state durability
- **Built-in retries**: BullMQ handles exponential backoff
- **Concurrency control**: Easy to limit workers per source
- **Better performance**: Redis push/pop is faster than Postgres polling
- **Familiar**: BullMQ is standard in Node ecosystem
- **Scaling path**: If load increases, just add more workers (each pulls from same queue)
- **Job progress**: Can track progress within a long-running job
- **Timeouts**: Job must complete within X seconds or marked failed

#### Cons

- **Redis dependency**: One more service to run + manage
- **More complexity**: Job state in both Redis + Postgres (must keep in sync)
- **Setup friction**: Redis + BullMQ knowledge required
- **Overkill for MVP**: BullMQ features not needed until 100+ jobs/day
- **Cost**: Redis service (managed or self-hosted)
- **Network hops**: Job goes: API → Redis → Worker → Postgres → Redis → ...
- **Consistency challenges**: What if Redis crashes? Jobs in Postgres remain, but queue lost (mitigated by persistent Redis)

#### When to Choose

- Expected scale is 1,000–10,000 reports/day immediately
- Team has Redis expertise
- Need built-in retry + timeout + progress features
- Can justify Redis operational cost

#### Scale Analysis

**Excellent** for 10,000–100,000 reports/day:
- Redis queue handles 100k+ enqueues/sec
- Each worker still processes ~1 job/min (bounded by scraper + LLM)
- Can run 10–100 workers without issue

---

## Scale Analysis: Postgres-Only Job Runner

### Example: 100 reports/day

- 100 reports × 6 sources = **600 source_jobs/day**
- Each job:
  - Takes ~30s–5 min to fetch + extract
  - DB operations: 2 writes (mark running, mark complete), 1 read (get report context), 1–50 writes (save mentions)
- **Polling**: Every 2s = ~43,200 queries/day

**Database load**:
- 43k polling queries (each ~1ms with index)
- 600 job writes (create, start, complete)
- 600 × 50 mention inserts (30k inserts)
- ~1 million mention rows in table (manageable)

**Hardware**: Single Postgres instance on shared hosting is sufficient. Index on `status, created_at` is critical.

---

### Example: 1,000 reports/day

- 6,000 source_jobs/day
- 5 million mention rows total (still manageable)
- **Polling**: ~43k queries/day (unchanged, index absorbs load)

**Database load**:
- Still single-instance Postgres
- Mentions table grows, need retention/archiving policy (e.g., delete reports >90 days old)

**Hardware**: Single instance still sufficient, but approaching edge. Monitor slow query log.

---

### Example: 10,000 reports/day

- 60,000 source_jobs/day
- 50 million mention rows (table getting large)
- **Polling**: Still fine (index key is fast)

**Optimization needed**:
- Batch claiming: `SELECT * FROM source_jobs WHERE status='queued' LIMIT 10` instead of LIMIT 1
- Sharding: Split source_jobs table by (report_id % 10) to reduce scan size
- Mention table: Archive old data to separate table

**Database**: Single instance starting to strain. May need read replicas or pgBouncer connection pooling.

---

### Example: 100,000 reports/day

- 600,000 source_jobs/day
- 500 million mention rows
- **Polling**: Becomes bottleneck

**At this scale**: Postgres-only polling model breaks down. Need to move to Redis queue (Option C) or just switch to Inngest (Option A).

---

## Recommended MVP Target Architecture

### Entities/Tables (Post-Inngest Removal)

#### `reports` (unchanged)

Tracks overall report state.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `owner_id` | UUID | FK |
| `category`, `competitors` | text, jsonb | Input params |
| `status` | enum | "queued", "running", "completed", "failed", "cancelled" |
| `stage` | enum | "queued", "running", "done", "failed" (can consolidate with status later) |
| `error` | text | Error message if failed |
| `partial` | bool | True if any source failed but others succeeded |
| `failed_sources` | text[] | Which sources failed |
| All output fields | ... | sentiment, voice, pricing, etc. |

**Status flow**:
1. Created with `status='queued'`
2. After first source job starts → `status='running'`
3. After all sources done AND synthesis done → `status='completed'` or `status='failed'`
4. User can cancel anytime → `status='cancelled'`

---

#### `source_jobs` (replaces report_platform_jobs)

Tracks individual source data collection task.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `report_id` | UUID | FK → reports |
| `source` | text | "reddit", "appstore", etc. (renamed from `platform`) |
| `status` | enum | "queued", "claiming", "running", "completed", "failed", "cancelled" |
| `stage` | enum | "fetch", "extract", "done", "failed" (can keep or consolidate into status) |
| `attempt_count` | int | How many times retried |
| `last_error` | text | Last error message |
| `claimed_by` | text | Which worker instance claimed it (for debugging) |
| `claimed_at` | timestamp | When claimed (to detect stale claims) |
| `started_at` | timestamp | When processing started |
| `completed_at` | timestamp | When finished |
| `created_at`, `updated_at` | timestamp | Lifecycle |

**Constraints**:
- Unique on `(report_id, source)` — one job per source per report
- Index on `(status, created_at)` — fast querying for claiming
- Index on `(status, claimed_at)` — find stale claims for cleanup

**Status transitions**:
- `queued` → `claiming` (worker about to claim)
- `claiming` → `running` (worker claimed successfully)
- `running` → `completed` (success)
- `running` → `failed` (error, won't retry)
- `running` → `queued` (cleanup job resets stale claims)

**New "claiming" stage** prevents two workers from claiming same job (race condition).

---

#### `synthesis_jobs` (new table)

Tracks the final synthesis task.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `report_id` | UUID | FK → reports (unique) |
| `status` | enum | "queued", "running", "completed", "failed" |
| `stage` | enum | "queued", "merging", "synthesizing", "refining", "done", "failed" |
| `attempt_count` | int | Retry count |
| `last_error` | text | Error if failed |
| `claimed_by` | text | Which worker |
| `claimed_at` | timestamp | When claimed |
| `started_at`, `completed_at` | timestamp | Lifecycle |
| `created_at`, `updated_at` | timestamp | Lifecycle |

**Purpose**: Explicit task to trigger synthesis after all sources done.

**Triggers when**: All source_jobs for report_id are terminal (completed or failed) AND >= 1 succeeded.

---

#### `pipeline_events` (unchanged)

Audit trail of all state transitions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `report_id` | UUID | FK |
| `source` | text | Which source (if applicable) |
| `stage` | text | "fetch", "extract", "merge", "synth", etc. |
| `event` | text | "started", "completed", "failed", "retry" |
| `attempt` | int | Attempt number |
| `duration_ms` | int | How long |
| `error` | text | Error message if failed |
| `metadata` | jsonb | Additional context |
| `created_at` | timestamp | When it happened |

---

#### Other tables

- `mentions` — unchanged
- `source_extracts` (rename from report_platform_briefs)
- `report_*` (complaints, gaps, pricing, etc.) — unchanged
- `report_checkpoints` — unchanged

---

### Source Job Statuses (Detailed)

```
queued
  ↓
claiming (optional, prevents race)
  ↓
running
  ├→ completed (success)
  ├→ failed (unrecoverable error, don't retry)
  └→ queued (stale claim, reset by cleanup job)

cancelled (user cancels report)
```

---

### Source Job Stages (Detailed)

```
fetch
  ├→ extract
  └→ failed

extract
  ├→ done
  └→ failed

done / failed (terminal)
```

---

### Synthesis Job Statuses & Stages

```
queued
  ↓
running
  ├→ merging (stage C: deduplicate)
  ├→ synthesizing (stage D: LLM insights)
  ├→ refining (stage E: polish)
  ├→ completed
  └→ failed
```

---

### Target API Flow

1. **POST /v1/reports** → API handler
   - Validate input
   - Insert reports row (status="queued")
   - Insert source_jobs rows (one per enabled source, status="queued")
   - **Return immediately** (all in one transaction)
2. **Worker loop** runs continuously
   - Poll Postgres every 1–2 seconds
   - `SELECT * FROM source_jobs WHERE status='queued' LIMIT 10 FOR UPDATE SKIP LOCKED`
   - For each job:
     - Update status → "claiming" (prevent race)
     - Fetch from source
     - Extract with LLM
     - Save mentions + brief
     - Update status → "completed"
     - Call `checkFanIn(report_id)`
   - `checkFanIn()`:
     - Query all source_jobs for report
     - If all terminal: create synthesis_job (status="queued")
3. **Synthesis worker** loop runs continuously
   - Poll for synthesis_jobs with status='queued'
   - Load report + all source_extracts
   - Run stages C, D, E
   - Update reports row (status="completed")
4. **Frontend** polls `/v1/reports/{id}/progress` every 2s
   - Gets current job states + events
   - Shows progress UI

---

### Cleanup Jobs (Scheduled)

**Every hour**: Find + reset stale claims
```sql
UPDATE source_jobs
SET status = 'queued', claimed_by = NULL, claimed_at = NULL
WHERE status IN ('claiming', 'running')
  AND updated_at < now() - interval '1 hour';
```

**Every day**: Archive old reports
```sql
DELETE FROM mentions WHERE report_id IN (
  SELECT id FROM reports WHERE created_at < now() - interval '90 days'
);
DELETE FROM reports WHERE created_at < now() - interval '90 days';
```

---

## Migration Plan From Current Inngest Architecture

### Phase 0: Stabilize Current System

**Goal**: Make current Inngest setup robust and documented.

**Duration**: 1–2 sprints

**Changes**:
- [ ] Add .env validation: fail fast if INNGEST_EVENT_KEY missing
- [ ] Add better error messages: "Failed to send Inngest events. Make sure INNGEST_EVENT_KEY is set and inngest-cli dev is running."
- [ ] Document local setup: exact commands to start Inngest, get key, set .env
- [ ] Disable incomplete scrapers: Mark appstore/playstore/etc. as TODO
- [ ] Add health check endpoint: `/health/inngest` verifies Inngest connectivity
- [ ] Monitor stuck jobs: Cron job that alerts if any source_job.status='running' for >2 hours

**Files affected**:
- `packages/api/src/libs/inngest.ts` — add validation
- `packages/api/src/controllers/reports/handlers/createReport.ts` — better error handling
- Documentation — new guide
- `packages/api/src/scripts/monitor-stuck-jobs.ts` (new)

**Risk**: Low (additive, no refactoring)

**Rollback**: None needed (improvements only)

---

### Phase 1: Introduce Postgres Job Runner (Feature Flagged)

**Goal**: Build new job runner in parallel, enable for testing cohort.

**Duration**: 2–3 sprints

**Changes**:
- [ ] Create source_jobs + synthesis_jobs tables (duplicates report_platform_jobs for now)
- [ ] Build worker loop with polling + claiming
- [ ] Implement stale claim cleanup
- [ ] Add feature flag: `USE_POSTGRES_JOB_RUNNER`
- [ ] Route createReport to either path based on flag
- [ ] Test with Reddit scraper only (simplest, most reliable)
- [ ] Keep Inngest path unchanged (for rollback)

**Files affected**:
- `packages/api/src/db/schema/pipeline.ts` — add new tables
- `packages/api/src/services/reports.service.ts` — add conditional logic
- `packages/worker/src/postgres-runner/` (new folder)
- `packages/worker/src/postgres-runner/loop.ts` (new)
- `packages/worker/src/postgres-runner/reddit-processor.ts` (new)

**Risk**: Medium (new code, but behind flag)

**Testing**:
- Create report with flag enabled
- Watch job progress in Postgres directly
- Verify idempotency (claim same job twice, verify only one processes)

**Rollback**: Disable flag, reports use old Inngest path

---

### Phase 2: Migrate Source Processing to Postgres Runner

**Goal**: Move all sources to new runner.

**Duration**: 2–3 sprints

**Changes**:
- [ ] Extract scraping + extraction logic into reusable function
- [ ] Build processor for each source (reddit, appstore, etc.)
- [ ] Wire all sources to Postgres runner
- [ ] Test each source individually
- [ ] Compare mentions/quality between Inngest and Postgres paths
- [ ] Turn on Postgres runner by default, keep Inngest as fallback

**Files affected**:
- `packages/worker/src/postgres-runner/` — expand
- `packages/worker/src/postgres-runner/process-source.ts` (new)
- Each scraper's extraction logic

**Risk**: Medium (more code, many scrapers)

**Testing**:
- Run reports with flag ON for new users, flag OFF for existing
- Compare final reports quality
- Verify job completion times

**Rollback**: Disable flag, revert to Inngest

---

### Phase 3: Move Synthesis Trigger to Postgres

**Goal**: Remove Inngest dependency entirely.

**Duration**: 1 sprint

**Changes**:
- [ ] Implement `checkFanIn()` in Postgres runner (instead of inngest.send)
- [ ] Create synthesis_jobs table
- [ ] Build synthesis worker loop (same pattern as source jobs)
- [ ] Remove all inngest.send() calls from source runners
- [ ] Test synthesis triggering (all sources done → synthesis starts)
- [ ] Deprecate `source_jobs` table (keep for migration safety)

**Files affected**:
- `packages/worker/src/postgres-runner/fan-in.ts` — use DB instead of Inngest
- `packages/worker/src/postgres-runner/synthesis-loop.ts` (new)
- Remove Inngest event sends

**Risk**: Medium (last hard dependency)

**Rollback**: Keep Inngest calls, use both systems in parallel

---

### Phase 4: Remove or Deprecate Inngest

**Goal**: Clean up codebase, decide Inngest's future role.

**Duration**: 1 sprint

**Decision point**:
- Is Inngest still useful? (Probably not for MVP)
- Can we remove it entirely? (Yes, if phases 0–3 successful)

**Changes**:
- [ ] Delete Inngest client code
- [ ] Remove Inngest event definitions
- [ ] Remove INNGEST_EVENT_KEY from .env.example
- [ ] Update documentation
- [ ] Remove inngest dependency from package.json
- [ ] Or: Keep Inngest code but don't use it (just in case)

**Files affected**:
- `packages/api/src/libs/inngest.ts` — delete
- `packages/shared/src/inngest-events.ts` — delete or keep
- `packages/api/src/services/reports.service.ts` — remove Inngest send call
- All worker Inngest function definitions — delete
- Dependencies

**Risk**: Low (cleanup only, after full Postgres migration)

**Rollback**: If Postgres runner has bugs, we still have Inngest code in git history

---

## Testing Strategy

### Unit Tests

**Source job claiming** (`packages/worker/src/__tests__/claim.test.ts`):
- Two workers try to claim same job simultaneously
- Only one gets it (SELECT ... FOR UPDATE SKIP LOCKED works)
- The other gets no rows returned

**Retry logic** (`packages/worker/src/__tests__/retry.test.ts`):
- Job fails, attempt_count incremented
- Stale claim reset (claimed_at > 1hr, reset to queued)
- Max retry count respected (fail permanently after 3 attempts)

**Idempotency** (`packages/worker/src/__tests__/idempotency.test.ts`):
- Process same source_job twice (simulate crash + retry)
- Mentions inserted only once (unique constraint prevents dupes)
- Brief updated only once

---

### Integration Tests

**Fan-in logic** (`packages/worker/src/__tests__/fan-in.test.ts`):
- Create report with 2 source_jobs
- Job 1 completes → fanInCheck → synthesis_job NOT created (job 2 still running)
- Job 2 completes → fanInCheck → synthesis_job created (both terminal)
- Verify synthesis_job.status='queued'

**Synthesis idempotency** (`packages/worker/src/__tests__/synthesis-idempotency.test.ts`):
- Create synthesis_job, start processing
- Simulate crash after stage C (save checkpoint)
- Create another synthesis_job with same report_id
- Verify second job is rejected or uses checkpoint (no duplicate work)

---

### Worker Tests

**Reddit processor** (`packages/worker/src/__tests__/sources/reddit.test.ts`):
- Mock Reddit API
- Verify posts fetched correctly
- Verify mentions inserted into DB
- Verify brief created

**Stale job recovery** (`packages/worker/src/__tests__/cleanup.test.ts`):
- Create job with claimed_at = now() - 2 hours
- Run cleanup job
- Verify status reset to 'queued'

---

### Database Locking Tests

**Concurrent claim prevention** (`packages/worker/src/__tests__/locking.test.ts`):
- Two worker processes
- Both try to claim same job
- Verify only one succeeds

---

### Stuck Job Recovery Test

**Comprehensive scenario** (`packages/worker/src/__tests__/stuck-recovery.test.ts`):
- Create report with 2 sources
- Source 1 completes
- Source 2 claims job, starts processing, crashes
- Verify job status is 'running' with claimed_at = past
- Run cleanup job
- Verify job reset to 'queued'
- Source 2 retries, succeeds
- Verify synthesis triggers

---

### Partial Failure Test

**One source succeeds, one fails** (`packages/api/src/__tests__/e2e-partial-fail.test.ts`):
- Create report
- Reddit scraper succeeds (100 mentions)
- AppStore scraper fails (API error)
- Verify synthesis runs with only Reddit data
- Verify final report.partial=true, failed_sources=['appstore']
- Verify frontend shows partial indicator

---

### Complete E2E Golden Test

**Full pipeline end-to-end** (`packages/api/src/__tests__/e2e-golden.test.ts`):

```typescript
describe("E2E: Complete Report Pipeline", () => {
  it("should create, process, and complete a report", async () => {
    // 1. Create competitor
    const competitor = await createCompetitor(userId, { name: "Notion" });

    // 2. Create report
    const report = await createReport(userId, {
      category: "productivity",
      competitors: ["Notion"],
      target_audience: "founders",
      founder_goal: "find_user_pain"
    });

    expect(report.status).toBe("queued");

    // 3. Manually run workers (in test, not real workers)
    // For each source_job:
    for (const source of ["reddit", "appstore"]) {
      const job = await claimJob(report.id, source);
      if (source === "reddit") {
        // Mock fetch, return 50 posts
        await processFetch(job.id, mockPosts);
      } else {
        // Simulate failure
        await failJob(job.id, "API rate limited");
      }
    }

    // 4. Verify fan-in triggered synthesis
    const synthJob = await db.select().from(synthesis_jobs)
      .where(eq(synthesis_jobs.report_id, report.id));
    expect(synthJob).toHaveLength(1);
    expect(synthJob[0].status).toBe("queued");

    // 5. Run synthesis
    await processSynthesis(synthJob[0].id);

    // 6. Verify report complete
    const finalReport = await getReport(report.id);
    expect(finalReport.status).toBe("completed");
    expect(finalReport.partial).toBe(true); // appstore failed
    expect(finalReport.failed_sources).toContain("appstore");

    // 7. Verify frontend can fetch full report
    const sections = await Promise.all([
      getComplaints(report.id),
      getFeatureGaps(report.id),
      getPricing(report.id),
    ]);
    for (const section of sections) {
      expect(section.length).toBeGreaterThan(0);
    }
  });
});
```

**Why this test matters**: Proves the entire Postgres-backed system works without external services.

---

## Final Recommendation

### Recommendation

**Migrate from Inngest to Postgres-backed job runner over the next 2–3 months.**

### Reason

1. **Inngest adds fragility**: Missing INNGEST_EVENT_KEY causes all jobs to fail silently. Events can be lost with no visibility. This is unacceptable for a core product feature.

2. **Postgres-backed is simpler**: All state visible, debugging is straightforward (query jobs table), no external service to run locally, no vendor dependency.

3. **Postgres is sufficient for MVP scale**: 100 reports/day = 600 jobs/day = ~43k polling queries/day. This is trivial for Postgres. Won't become a bottleneck until 10k+ reports/day.

4. **Phased migration is safe**: Can build new system in parallel, test behind feature flag, roll back if needed.

5. **Better observability**: Stuck jobs are obvious (query DB), no hidden events.

### What to Do Next

**Immediately (this sprint)**:

1. Add environment validation: fail fast if INNGEST_EVENT_KEY missing
2. Document local Inngest setup properly
3. Disable incomplete/untested scrapers (appstore, playstore, etc.)
4. Test that existing Inngest path works end-to-end

**Next 2–3 sprints**:

1. Phase 0: Stabilize Inngest + monitoring
2. Phase 1: Build Postgres runner (feature flagged) for Reddit only
3. Phase 2: Migrate all sources to Postgres runner
4. Phase 3: Move synthesis to Postgres
5. Phase 4: Deprecate/remove Inngest

### What Not to Do

❌ Don't jump straight to BullMQ/Redis (overkill for MVP, adds complexity).  
❌ Don't try to keep both systems running indefinitely (technical debt nightmare).  
❌ Don't add more Inngest event types or complexity to current system.  
❌ Don't rely on Inngest cloud unless you have strong reasons (yet another vendor).

### Biggest Risk

**Risk**: Postgres runner has a subtle bug (race condition, deadlock, etc.) that doesn't show up in testing. Jobs silently fail or duplicate.

**Mitigation**:
- Thorough unit tests for claiming + locking
- Monitor stuck jobs aggressively during Phase 2
- Canary with single source (Reddit) before full rollout
- Keep Inngest code in git; can revert if needed
- Have clear rollback plan at each phase

### Fastest Safe Next Step

1. **Today**: Add INNGEST_EVENT_KEY validation + error message
2. **This week**: Write comprehensive Inngest setup docs (so other devs don't hit this issue)
3. **Next sprint**: Start Phase 0 (stabilization + monitoring)
4. **2 sprints from now**: Start Phase 1 (Postgres runner, feature flagged, Reddit only)

---

## Appendix: Known Unknowns

| Question | Impact | Answer |
|----------|--------|--------|
| Do scrapers (appstore, playstore, etc.) actually work? | High | **Unknown** — not tested in this debug session. May need fixes. |
| How long does typical report take end-to-end? | Medium | Estimated 5–15 min, depends on source speeds + LLM latency. Need real benchmarks. |
| What's acceptable error rate for sources? | Medium | Unknown. Is 1 failure per 10 reports acceptable? |
| Do frontend + worker code scale beyond MVP? | Medium | Unknown. Backend likely fine, frontend might need pagination for 1000+ complaints. |
| What's Inngest's actual cost at scale? | Low | Unknown. Probably free for MVP, $$$ at scale. Not researched. |
| Is there a simpler job runner we should consider? | Low | Probably not. Postgres + polling is standard, BullMQ + Redis is industry standard upgrade. |
| Can we use pg-boss instead of custom Postgres runner? | Low | Maybe. pg-boss is battle-tested Postgres job queue library. Could be alternative to custom code. |

---

**End of Architecture Review Document**
