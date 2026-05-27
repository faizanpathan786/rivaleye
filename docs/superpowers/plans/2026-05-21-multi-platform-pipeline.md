# Multi-Platform Pipeline Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fan-out report creation across all 6 platforms (reddit, appstore, playstore, hackernews, producthunt, devto) so a single UI submission produces a synthesized report drawing on all available platform data.

**Architecture:** When a report is created in postgres mode, one `report_platform_jobs` row is inserted per enabled platform. Each job is independently claimed and processed by the source worker (scrape → Stage A extract → Stage B summarize). The synthesis job fan-ins once all source jobs are completed or failed, then runs Stage C/D/E on the union of all platform briefs. Two source jobs run concurrently (bounded by DB pool size).

**Tech Stack:** Bun, Drizzle ORM, PostgreSQL (Supabase), OpenRouter (deepseek-chat), pg-runner polling loop with `SELECT FOR UPDATE SKIP LOCKED`

---

## Context for implementers

This is a mono-repo at `/Users/apple/Desktop/rivaleye-v3`. The active packages are:
- `packages/api` — Elysia HTTP server, creates reports and jobs
- `packages/worker` — pg-runner, processes jobs
- `packages/scrapers` — one scraper class per platform
- `packages/shared` — `ENABLED_PLATFORMS`, `LLM_MODEL`, OpenRouter client

Run commands from the relevant package directory. The `.env` file is at the repo root. The worker is started with `bun --watch --env-file=../../.env src/pg-runner/index.ts` from `packages/worker/`.

---

## Files to modify

| File | Change |
|---|---|
| `packages/api/src/services/reports.service.ts` | Fan-out to all ENABLED_PLATFORMS in postgres mode |
| `packages/worker/src/pg-runner/index.ts` | Concurrent source job processing (MAX=2) |
| `packages/worker/src/pg-runner/source-worker.ts` | Graceful 0-post handling — skip A/B, mark completed |

---

### Task 1: Fan-out to all platforms on report creation

**Files:**
- Modify: `packages/api/src/services/reports.service.ts` (around line 107)

The problem: the postgres branch only inserts one job for `"reddit"`. Fix: insert one job per `ENABLED_PLATFORMS` entry, exactly like the inngest branch already does.

- [ ] **Step 1: Locate the postgres branch in createReport**

```bash
grep -n 'engine === "postgres"' packages/api/src/services/reports.service.ts
```
Expected output: a line around 105-110 with the single-platform insert.

- [ ] **Step 2: Replace the single-platform insert with a fan-out**

Find this block (around line 105):
```typescript
if (engine === "postgres") {
  // Phase 1: Only Reddit for MVP
  await tx.insert(report_platform_jobs).values({
    report_id: reportRow.id,
    platform: "reddit",
    status: "queued",
  });
}
```

Replace with:
```typescript
if (engine === "postgres") {
  await tx.insert(report_platform_jobs).values(
    ENABLED_PLATFORMS.map((platform) => ({
      report_id: reportRow.id,
      platform,
      status: "queued" as const,
    })),
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/api type-check 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/reports.service.ts
git commit -m "feat(api): fan-out report creation to all ENABLED_PLATFORMS in postgres mode"
```

---

### Task 2: Concurrent source job processing (up to 2 concurrent)

**Files:**
- Modify: `packages/worker/src/pg-runner/index.ts` (the `pollSourceJobs` function)

**Problem:** The current loop awaits `processSourceJob` before claiming the next job. With 6 platforms, Reddit alone takes ~10 min, so all platforms run sequentially = 60+ min total. Fix: fire-and-forget each job (up to `MAX_CONCURRENT_SOURCE=2`) so multiple platforms process in parallel.

**Why MAX=2:** DB pool is `max: 5`. We have: 2 source jobs + 1 synthesis poller + 1 recovery loop + 1 headroom = 5 connections max. Safe.

- [ ] **Step 1: Add MAX_CONCURRENT_SOURCE constant and activeSourceJobs counter to index.ts**

Find the `pollSourceJobs` function signature:
```typescript
async function pollSourceJobs(config: WorkerConfig): Promise<void> {
  log.info(
    { workerId: config.workerId, interval: config.pollIntervalMs },
    "Starting source job polling loop"
  );

  while (true) {
```

Replace the entire `pollSourceJobs` function body with the concurrent version:
```typescript
async function pollSourceJobs(config: WorkerConfig): Promise<void> {
  const MAX_CONCURRENT_SOURCE = 2;
  let activeJobs = 0;

  log.info(
    { workerId: config.workerId, interval: config.pollIntervalMs, maxConcurrent: MAX_CONCURRENT_SOURCE },
    "Starting source job polling loop"
  );

  while (true) {
    try {
      if (activeJobs >= MAX_CONCURRENT_SOURCE) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      const job = await db.transaction(async (tx) =>
        claimSourceJob(tx as any, config.workerId)
      );

      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, job.report_id))
        .limit(1);

      if (!report) {
        log.warn(
          { jobId: job.id, reportId: job.report_id },
          "Report not found for claimed job"
        );
        await db
          .update(report_platform_jobs)
          .set({
            status: "failed",
            stage: "failed",
            locked_at: null,
            locked_by: null,
            last_error: "Report not found",
            completed_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(report_platform_jobs.id, job.id));
        continue;
      }

      // Fire and forget — increment counter before async work starts
      activeJobs++;
      processSourceJob(job, report, config.workerId)
        .then(() => {
          log.info({ jobId: job.id, platform: job.platform }, "Source job completed successfully");
        })
        .catch((err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          log.error({ jobId: job.id, platform: job.platform, error: errorMsg }, "Source job processing failed");
        })
        .finally(() => {
          activeJobs--;
        });

      // No sleep — immediately try to claim another job up to MAX_CONCURRENT_SOURCE
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ error: errorMsg }, "Unexpected error in source polling loop");
      await sleep(config.pollIntervalMs);
    }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/worker type-check 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/pg-runner/index.ts
git commit -m "feat(worker): concurrent source job processing up to 2 parallel platform jobs"
```

---

### Task 3: Graceful 0-post handling in source worker

**Files:**
- Modify: `packages/worker/src/pg-runner/source-worker.ts`

**Problem:** When DevTo (or any platform) returns 0 posts, we currently still run Stage A (which returns empty extract) and Stage B (which wastes an LLM call on an empty payload). Fix: detect 0 posts early, skip A/B entirely, mark job completed, and let fan-in proceed naturally. No brief is written for 0-post platforms — synthesis just gets fewer briefs, which is fine.

- [ ] **Step 1: Locate the 0-post guard and post-fetch section in source-worker.ts**

```bash
grep -n "posts.length\|No posts\|Running Stage A" packages/worker/src/pg-runner/source-worker.ts | head -10
```

Expected: lines showing the guard in `runStageAExtractionStep` and the Step 5 section in `processSourceJob`.

- [ ] **Step 2: Add early exit for 0 posts in processSourceJob, after Step 3 (persisting mentions)**

Find this comment block in `processSourceJob`:
```typescript
    // Step 5: Run Stage A extraction
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage A extraction");
    const extract = await runStageAExtractionStep(job.report_id, job.platform, posts, reportRow);
```

Insert an early-exit block immediately before Step 5:
```typescript
    // Step 4b: Skip A/B and complete early if no posts found
    if (posts.length === 0) {
      log.warn({ jobId: job.id, platform: job.platform }, "No posts found; skipping Stage A/B and marking completed");
      const durationMs = Date.now() - startedAt;
      await db
        .update(report_platform_jobs)
        .set({
          status: "completed",
          completed_at: new Date(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));
      await emit({
        reportId: job.report_id,
        platform: job.platform,
        stage: "scrape.fetch",
        event: "completed",
        attempt: job.attempt_count,
        durationMs,
        metadata: { posts_count: 0 },
      });
      await fanInCheck(job.report_id, "fan-in");
      return;
    }

    // Step 5: Run Stage A extraction
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage A extraction");
    const extract = await runStageAExtractionStep(job.report_id, job.platform, posts, reportRow);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/worker type-check 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/pg-runner/source-worker.ts
git commit -m "feat(worker): skip Stage A/B and complete gracefully when scraper returns 0 posts"
```

---

### Task 4: Restart worker and E2E test

**Context:** After Tasks 1-3, the worker needs to be restarted to pick up the new code. Use **Notion** as the test competitor — it has a mobile app (AppStore + PlayStore), active Reddit community, HackerNews presence, ProductHunt listing, and DEV.to articles.

- [ ] **Step 1: Kill the running worker**

```bash
kill $(ps aux | grep "pg-runner/index" | grep -v grep | awk '{print $2}') 2>/dev/null; echo "killed"
```

- [ ] **Step 2: Start the worker fresh**

```bash
cd /Users/apple/Desktop/rivaleye-v3/packages/worker
bun --watch --env-file=../../.env src/pg-runner/index.ts > /tmp/worker.log 2>&1 &
echo "started pid $!"
```

- [ ] **Step 3: Verify worker started with 6 platforms**

Wait 3 seconds then check:
```bash
sleep 3 && grep "Starting source job polling loop" /tmp/worker.log
```
Expected: log line showing worker started.

- [ ] **Step 4: Submit Notion report via the UI**

Open `http://localhost:4000` (or wherever the web app runs), submit a new report:
- Competitor: `Notion`
- Category: `Productivity`
- Goal: `find what users hate so we can position against it`

- [ ] **Step 5: Verify 6 platform jobs appear in logs**

```bash
tail -f /tmp/worker.log | grep --line-buffered -E "platform|scrape|batch|Stage A|Stage B|fan-in|synth|completed|failed"
```

Expected: 2 platform jobs start immediately (concurrent), then 2 more after those finish, etc. All 6 platforms eventually hit "Stage A extraction completed".

- [ ] **Step 6: Verify synthesis runs on multi-platform data**

When synthesis starts, check the Stage C log line:
```
stage C: merge {"platforms":N, "totalExtracts":N}
```
Expected: `platforms` > 1 (at least Reddit + 1 other platform with data).

- [ ] **Step 7: Confirm report is completed in UI**

Open the report in the web app. Check:
- `executive_brief` is populated
- `complaints` has entries with `mentions > 0`
- `quotes` is not empty
- Platform stats shows multiple platforms

---

## Self-Review

**Spec coverage:**
- ✅ Task 1 enables all 6 platforms in postgres mode
- ✅ Task 2 adds concurrent processing so 6 platforms don't take 60+ minutes
- ✅ Task 3 handles 0-post platforms (DevTo for some competitors) without blocking fan-in
- ✅ Task 4 verifies the full E2E flow

**Placeholder scan:** No TODOs or placeholders — all code is complete.

**Type consistency:**
- `ENABLED_PLATFORMS` is imported in `reports.service.ts` already ✅
- `activeJobs` is a `number`, `MAX_CONCURRENT_SOURCE` is a `number` ✅
- `posts.length === 0` check uses the existing `posts` variable already in scope ✅
- `fanInCheck` is already imported in `source-worker.ts` ✅
