# PostgreSQL Runner E2E Testing Guide

**Date:** 2026-05-19  
**Status:** Manual testing procedure for Phase 1 (Reddit only)  

This guide walks you through a complete end-to-end test of the Postgres-based report pipeline locally, using real Reddit and OpenRouter APIs.

---

## 1. Prerequisites

### 1.1 Environment Variables

Create `.env` files in each package with the following:

**packages/api/.env:**

```bash
# Database
CONNECTION_STRING=postgresql://user:password@localhost:5432/rivaleye

# Authentication
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:4000

# LLM (required for keyword expansion + synthesis)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=deepseek/deepseek-chat

# Reddit scraper (required for real Reddit fetch)
REDDIT_CLIENT_ID=your-reddit-app-id
REDDIT_CLIENT_SECRET=your-reddit-app-secret
REDDIT_USER_AGENT=RivalEye/1.0 (+https://rivaleye.app)

# Pipeline engine (CRITICAL for this test)
REPORT_PIPELINE_ENGINE=postgres
```

**packages/worker/.env:**

```bash
# Database
CONNECTION_STRING=postgresql://user:password@localhost:5432/rivaleye

# LLM
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=deepseek/deepseek-chat

# Reddit scraper
REDDIT_CLIENT_ID=your-reddit-app-id
REDDIT_CLIENT_SECRET=your-reddit-app-secret
REDDIT_USER_AGENT=RivalEye/1.0 (+https://rivaleye.app)

# Pipeline engine
REPORT_PIPELINE_ENGINE=postgres
```

**packages/web/.env:**

```bash
VITE_API_URL=http://localhost:4000
```

### 1.2 Required API Keys

You need:

1. **OPENROUTER_API_KEY**: Sign up at https://openrouter.ai/. Fund your account ($5 should be sufficient for testing).
2. **REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET**: Create a Reddit app at https://www.reddit.com/prefs/apps. Select "script" type. Note the credentials.

### 1.3 Database Setup

Ensure Supabase Postgres is running and migrations are applied:

```bash
# From repo root
pnpm db:migrate
pnpm db:studio  # Optional: browse schema visually
```

---

## 2. Terminal Setup (4 Terminals)

Open four terminal windows in the repo root.

### Terminal 1: PostgreSQL monitoring (for live debugging)

```bash
# Watch the jobs table as they progress
psql "$CONNECTION_STRING" -c "
SELECT 
  j.id, j.platform, j.status, j.stage, j.attempt_count,
  j.last_error, j.locked_at, j.locked_by,
  ROUND((EXTRACT(EPOCH FROM (now() - j.last_event_at)))::numeric, 0) AS secs_since_last_event
FROM report_platform_jobs j
ORDER BY j.created_at DESC
LIMIT 20;
"
```

Run this command repeatedly as the test progresses to see job state transitions.

Alternatively, keep a psql session open:

```bash
psql "$CONNECTION_STRING"
\x on  # expanded output (easier to read)
SELECT * FROM report_platform_jobs ORDER BY created_at DESC LIMIT 5;
```

Then press the up arrow to re-run the query.

### Terminal 2: API server

```bash
pnpm --filter @rivaleye/api dev
```

Should output:
```
API listening on http://localhost:4000
```

### Terminal 3: Worker (pg-runner)

```bash
pnpm --filter @rivaleye/worker dev
```

Should output:
```
Starting pg-runner with configuration
Starting source job polling loop
Starting synthesis job polling loop
Starting stale job recovery loop (every 30s)
```

### Terminal 4: Frontend

```bash
pnpm --filter @rivaleye/web dev
```

Should output:
```
VITE dev server running at http://localhost:4004
```

---

## 3. Step-by-Step E2E Test

### Step 1: Verify All Services Are Running

Check all four terminals show success:

- **Terminal 2 (API)**: Listening on 3001
- **Terminal 3 (Worker)**: All three loops started
- **Terminal 4 (Web)**: Vite server running
- **Terminal 1 (psql)**: Ready to query

### Step 2: Sign Up and Log In

1. Open http://localhost:4004 in your browser
2. Click "Sign up" (or navigate to `/auth/signup`)
3. Enter:
   - Email: `test@example.com`
   - Password: `testpassword123`
4. Click "Sign up"
5. Verify you land on the dashboard

**Expected:** No errors; you are logged in.

### Step 3: Create a Report

On the dashboard, fill in the form:

| Field | Value |
|---|---|
| Category | `customer service software` |
| Competitor(s) | `Zendesk` |
| Target audience | `SMB founders` |
| Founder goal | `understand pain points in support workflows` |

Click "Generate Report".

**Expected:** You see a "Report created" toast or status screen.

**Note the report ID** from the URL or response (should be a UUID like `550e8400-e29b-41d4-a716-446655440000`).

### Step 4: Monitor the Job Queue

In **Terminal 1 (psql)**, run:

```sql
SELECT 
  id, report_id, platform, status, stage, attempt_count, last_error
FROM report_platform_jobs
WHERE report_id = '550e8400-e29b-41d4-a716-446655440000'  -- your report ID
ORDER BY created_at DESC;
```

**Expected output after Step 3:**

```
 id                                   | report_id                            | platform | status  | stage  | attempt_count | last_error
--------------------------------------+--------------------------------------+----------+---------+--------+---------------+-----------
 550e8400-e29b-41d4-a716-446655440001 | 550e8400-e29b-41d4-a716-446655440000 | reddit   | queued  | queued |             0 | 
```

- `status = 'queued'` ✅ (job not yet claimed)
- `stage = 'queued'` ✅ (initial stage)
- `attempt_count = 0` ✅ (first attempt)
- `last_error = null` ✅ (no errors yet)

### Step 5: Wait for Source Job Claiming (15–30 seconds)

Check **Terminal 3 (worker)** logs. You should see:

```
[pg-runner] Starting source job processing
[pg-runner] Fetching posts from scraper
[pg-runner] Fetched posts (count=127)
[pg-runner] Persisting mentions
[pg-runner] Running Stage A extraction
[pg-runner] Running Stage B summarization
[pg-runner] Source job completed successfully
```

In **Terminal 1 (psql)**, re-run the query. Status should now be `running`:

```
 id                                   | report_id                            | platform | status  | stage       | attempt_count | last_error
--------------------------------------+--------------------------------------+----------+---------+-------------+---------------+-----------
 550e8400-e29b-41d4-a716-446655440001 | 550e8400-e29b-41d4-a716-446655440000 | reddit   | running | extracting  |             1 | 
```

- `status = 'running'` ✅ (worker claimed it)
- `stage = 'extracting'` ✅ (Stage A/B in progress)
- `locked_by = 'hostname:pid:xxxxx'` ✅ (worker identity recorded)

### Step 6: Wait for Source Job Completion (2–5 minutes)

Re-run the query in Terminal 1 every 30 seconds. You'll see the stage progress:

- `stage = 'extracting'` → LLM is processing Reddit posts (Stage A)
- `stage = 'summarizing'` → LLM is summarizing themes (Stage B)
- `stage = 'completed'` → Source job done

**Final state:**

```
 status    | stage     | attempt_count | last_error | completed_at
-----------+-----------+---------------+------------+--------------------------------
 completed | completed |             1 |            | 2026-05-19 12:45:30.123456+00
```

**Expected:** Job transitions from running → completed without errors.

If it gets stuck (still running after 5 minutes), check Terminal 3 logs for errors (e.g., Reddit rate limit, OpenRouter API key invalid).

### Step 7: Verify Synthesis Job Creation

Once the source job is `completed`, the fan-in check creates a synthesis job. Query the synthesis_jobs table:

```sql
SELECT 
  id, report_id, status, attempt_count, last_error
FROM synthesis_jobs
WHERE report_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at DESC;
```

**Expected output:**

```
 id                                   | report_id                            | status  | attempt_count | last_error
--------------------------------------+--------------------------------------+---------+---------------+-----------
 550e8400-e29b-41d4-a716-446655440002 | 550e8400-e29b-41d4-a716-446655440000 | queued  |             0 | 
```

- `status = 'queued'` ✅ (synthesis not yet claimed)
- Row exists ✅ (fan-in created it)

If synthesis_jobs is empty, the fan-in didn't trigger. Check:

1. Source job status is `completed` (not stuck in running)
2. Worker logs don't show fan-in errors (Terminal 3)

### Step 8: Wait for Synthesis Job Claiming (5–10 seconds)

Worker will claim the synthesis job. Status becomes `running`:

```
 status  | locked_at            | locked_by
---------+----------------------+-------------------------------------
 running | 2026-05-19 12:46:00  | hostname:pid:xxxxx
```

### Step 9: Wait for Report Completion (1–3 minutes)

Worker runs the full synthesis pipeline (Stages C, D, E):

- Stage C: Cluster complaints and feature gaps
- Stage D: Extract pricing, switching, and positioning signals
- Stage E: Generate final report sections

Terminal 3 logs will show:

```
[synthesis-worker] Running pipeline (Stage C/D/E)
[synthesis-worker] Persisting report sections
[synthesis-worker] Report marked completed
[synthesis-worker] Synthesis job completed successfully
```

Query the synthesis_jobs table again:

```
 status    | attempt_count | completed_at
-----------+---------------+--------------------------------
 completed |             1 | 2026-05-19 12:48:15.654321+00
```

### Step 10: Verify Report Completion in Database

Query the reports table:

```sql
SELECT id, status, stage, created_at, updated_at
FROM reports
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Expected output:**

```
 id                                   | status    | stage | created_at           | updated_at
--------------------------------------+-----------+-------+----------------------+-------------------------------
 550e8400-e29b-41d4-a716-446655440000 | completed | done  | 2026-05-19 12:43:00  | 2026-05-19 12:48:15
```

- `status = 'completed'` ✅ (report done)
- `stage = 'done'` ✅ (all stages finished)

### Step 11: Verify Progress Endpoint

In your browser or via curl:

```bash
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:4000/v1/reports/550e8400-e29b-41d4-a716-446655440000/progress
```

**Expected response shape:**

```json
{
  "report": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "partial": false,
    "failed_platforms": []
  },
  "platforms": [
    {
      "platform": "reddit",
      "status": "completed",
      "stage": "completed",
      "attempt_count": 1,
      "max_attempts": 3,
      "last_error": null,
      "last_event_at": "2026-05-19T12:48:15Z",
      "is_stuck": false,
      "stuck_reason": null,
      "time_since_last_event_seconds": 5
    }
  ],
  "synthesis": {
    "status": "completed",
    "attempt_count": 1,
    "last_error": null,
    "locked_at": null,
    "is_stuck": false,
    "stuck_reason": null
  },
  "events": [
    {
      "created_at": "2026-05-19T12:43:00Z",
      "platform": "reddit",
      "stage": "scrape.fetch",
      "event": "started",
      "attempt": 0,
      "duration_ms": null
    },
    {
      "created_at": "2026-05-19T12:45:30Z",
      "platform": "reddit",
      "stage": "scrape.fetch",
      "event": "completed",
      "attempt": 0,
      "duration_ms": 150000
    },
    {
      "created_at": "2026-05-19T12:48:15Z",
      "platform": null,
      "stage": "synth.run",
      "event": "completed",
      "attempt": 0,
      "duration_ms": 165000
    }
  ],
  "metrics": {
    "total_mentions_stored": 127,
    "total_complaints_extracted": 34
  }
}
```

**Key fields to verify:**
- `report.status = "completed"` ✅
- `platforms[0].status = "completed"` ✅
- `synthesis.status = "completed"` ✅
- `is_stuck = false` for all ✅
- `events` contains scrape, extraction, and synthesis events ✅

### Step 12: View the Report in the UI

Navigate to http://localhost:4004/reports/550e8400-e29b-41d4-a716-446655440000 (replace with your report ID).

**Expected:** You see the final report with sections like:
- Top pain points
- Feature gaps
- Pricing pain
- Switching signals
- Positioning opportunities

All data should be sourced from Reddit posts fetched in Step 5–6.

---

## 4. Expected Database State After Each Phase

### After Step 3 (Report Created)

```sql
-- reports table
SELECT id, status, stage FROM reports 
WHERE id = '<report-id>';
-- Expected: status='queued', stage='queued'

-- report_platform_jobs table
SELECT platform, status, stage FROM report_platform_jobs 
WHERE report_id = '<report-id>';
-- Expected: platform='reddit', status='queued', stage='queued'

-- synthesis_jobs table
SELECT * FROM synthesis_jobs WHERE report_id = '<report-id>';
-- Expected: (empty - not created yet)
```

### After Step 6 (Source Job Completes)

```sql
-- report_platform_jobs
SELECT platform, status, stage FROM report_platform_jobs 
WHERE report_id = '<report-id>';
-- Expected: platform='reddit', status='completed', stage='completed'

-- mentions table (Reddit posts stored)
SELECT COUNT(*) FROM mentions WHERE report_id = '<report-id>';
-- Expected: ~100–150 rows (depends on Reddit search results)

-- report_platform_briefs table (Stage A/B summaries stored)
SELECT COUNT(*) FROM report_platform_briefs WHERE report_id = '<report-id>';
-- Expected: 1 row (reddit brief with extract + summary JSON)

-- synthesis_jobs
SELECT status FROM synthesis_jobs WHERE report_id = '<report-id>';
-- Expected: status='queued' (fan-in just created it)
```

### After Step 9 (Synthesis Completes)

```sql
-- reports
SELECT status, stage FROM reports WHERE id = '<report-id>';
-- Expected: status='completed', stage='done'

-- synthesis_jobs
SELECT status FROM synthesis_jobs WHERE report_id = '<report-id>';
-- Expected: status='completed'

-- Final report sections (populated by Stage C/D/E)
SELECT COUNT(*) FROM report_complaints WHERE report_id = '<report-id>';
-- Expected: > 0 (complaints extracted from mentions)

SELECT COUNT(*) FROM report_feature_gaps WHERE report_id = '<report-id>';
-- Expected: > 0

SELECT COUNT(*) FROM report_switching WHERE report_id = '<report-id>';
-- Expected: > 0 (switching signals)
```

---

## 5. Expected Progress Endpoint Response Timeline

| Time | Status | Stage | Explanation |
|---|---|---|---|
| T+0s | queued | queued | Report created, job queued |
| T+2s | running | fetching | Worker claimed job, fetching Reddit |
| T+30s | running | extracting | Reddit posts fetched, Stage A (LLM extraction) started |
| T+90s | running | summarizing | Stage A done, Stage B (summarization) started |
| T+150s | completed | completed | Source job done; synthesis job created |
| T+160s | completed | completed | Synthesis job claimed by worker |
| T+180s | completed | completed | Synthesis (Stages C/D/E) running (not visible in source job status) |
| T+300s | completed | completed | Report marked completed; all stages done |

---

## 6. Troubleshooting Guide

### Issue: Source Job Stuck in "Running"

**Symptoms:**
- Job status is `running` for >5 minutes
- No progress in logs
- `locked_at` is old but not being recovered

**Diagnosis:**

1. Check Terminal 3 (worker) logs for errors
2. Query the job:
   ```sql
   SELECT id, status, locked_at, locked_by, last_error FROM report_platform_jobs 
   WHERE report_id = '<id>';
   ```

3. Check if `last_error` has a message

**Common causes:**

| Cause | Solution |
|---|---|
| Reddit API rate-limited | Wait 15–30 minutes; recovery loop will retry |
| OpenRouter API key invalid | Verify `OPENROUTER_API_KEY` in `.env` and that account is funded |
| Reddit credentials invalid | Verify `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| Network timeout | Check internet connection; verify APIs are accessible |
| Database connection lost | Restart API and worker processes |

### Issue: Synthesis Job Never Created

**Symptoms:**
- Source job is `completed`
- `synthesis_jobs` table is empty
- Report status is still `queued` or `running`

**Diagnosis:**

1. Check Terminal 3 logs for fan-in errors
2. Query source job status:
   ```sql
   SELECT platform, status FROM report_platform_jobs 
   WHERE report_id = '<id>';
   ```

3. Verify status is actually `completed` (not `running`)

**Solution:**

If source job is stuck in `running`:
- Wait 15 minutes for recovery loop to reset it
- Or manually reset in psql:
  ```sql
  UPDATE report_platform_jobs 
  SET status = 'completed', locked_at = NULL, locked_by = NULL
  WHERE report_id = '<id>' AND platform = 'reddit';
  ```

Then the next fan-in check (called by recovery loop or manually) will create synthesis job.

### Issue: OpenRouter LLM Timeouts

**Symptoms:**
- Job shows `last_error: "LLM request timeout"` or similar
- Logs show "Failed to call LLM"
- Job retries 2–3 times then fails

**Diagnosis:**

1. Check https://openrouter.ai/activity (your account dashboard) for recent requests
2. Verify your account has available credits (balance > $0.01)
3. Check if OpenRouter service is down

**Solution:**

1. Top up your OpenRouter account ($5–10)
2. Restart the worker process
3. The recovery loop will retry the job after 15 minutes

### Issue: Database Migration Failed on Startup

**Symptoms:**
- API or worker crashes on startup with "Unknown table: synthesis_jobs"
- Error mentions missing columns

**Diagnosis:**

1. Check if migrations were applied:
   ```bash
   pnpm db:migrate
   ```

2. Verify schema matches expected version:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'synthesis_jobs';
   ```

**Solution:**

1. Run migrations:
   ```bash
   pnpm db:migrate
   ```

2. Restart API and worker
3. Try report creation again

### Issue: Feature Flag Not Recognized

**Symptoms:**
- Error: "Invalid REPORT_PIPELINE_ENGINE: <value>"
- Job creation fails with validation error

**Diagnosis:**

1. Check .env file:
   ```bash
   grep REPORT_PIPELINE_ENGINE packages/api/.env packages/worker/.env
   ```

2. Verify value is exactly `postgres` or `inngest` (case-sensitive, no spaces)

**Solution:**

1. Update `.env`:
   ```bash
   echo "REPORT_PIPELINE_ENGINE=postgres" >> packages/api/.env
   echo "REPORT_PIPELINE_ENGINE=postgres" >> packages/worker/.env
   ```

2. Restart API and worker

### Issue: Worker Won't Start (Port Conflict)

**Symptoms:**
- Worker fails to start with "Port 3100 in use" or similar
- Old worker process still running

**Diagnosis:**

1. Check for stray processes:
   ```bash
   lsof -i :4001
   lsof -i :4002
   lsof -i :4003
   ```

2. Or check all Bun processes:
   ```bash
   ps aux | grep bun
   ```

**Solution:**

1. Kill old processes:
   ```bash
   pkill -f "bun.*worker"
   ```

2. Or kill by PID:
   ```bash
   kill -9 <pid>
   ```

3. Restart worker

### Issue: No Events Logged

**Symptoms:**
- `pipeline_events` table is empty
- Progress endpoint shows no events
- Worker logs don't show "Emitting event"

**Diagnosis:**

1. Check if emit function is being called:
   ```bash
   grep -n "await emit" packages/worker/src/pg-runner/source-worker.ts
   ```

2. Verify event logging is working:
   ```sql
   SELECT COUNT(*) FROM pipeline_events;
   ```

**Solution:**

Events are optional; if they're not being logged, the report will still complete. To debug:

1. Add manual logging in source-worker.ts:
   ```typescript
   log.info({ reportId: job.report_id }, "About to emit event");
   await emit({ reportId: job.report_id, stage: "scrape.fetch", event: "started" });
   ```

2. Restart worker and re-run test
3. Check logs in Terminal 3

---

## 7. Advanced: Simulating Failures

### Simulating a Failed Source Job

To test retry logic, manually fail a job:

```sql
UPDATE report_platform_jobs
SET status = 'queued', last_error = 'Manual failure for testing'
WHERE report_id = '<id>' AND platform = 'reddit' AND attempt_count < 2;
```

Then restart the worker. It should:

1. Claim the job
2. Try to process it (will likely fail again or succeed on retry)
3. If it fails, increment `attempt_count` and reset with backoff
4. After 3 failed attempts, mark as `failed` and trigger fan-in

### Simulating a Worker Crash

To test stale job recovery, manually lock a job:

```sql
UPDATE report_platform_jobs
SET status = 'running', locked_at = now() - interval '20 minutes', locked_by = 'dead-worker'
WHERE report_id = '<id>' AND platform = 'reddit';
```

Then wait 30 seconds. The recovery loop should:

1. Detect the stale lock
2. Reset to `queued` with backoff
3. Log "Recovered stale source job"

Then the job will be re-claimed and processed normally.

### Simulating Fan-In Race

To test fan-in deduplication, manually create both source jobs as completed:

```sql
-- Reset the setup
DELETE FROM synthesis_jobs WHERE report_id = '<id>';
UPDATE report_platform_jobs 
SET status = 'completed' 
WHERE report_id = '<id>';
```

Then manually call fan-in (by triggering any source job completion event). Check that only one synthesis job is created:

```sql
SELECT COUNT(*) FROM synthesis_jobs WHERE report_id = '<id>';
-- Expected: 1 (not 2 or 3)
```

---

## 8. Cleanup

### After Each Test Run

To avoid interference with the next test, you can delete the report:

```sql
DELETE FROM reports WHERE id = '<id>';
-- This cascades to:
-- - report_platform_jobs
-- - synthesis_jobs
-- - mentions
-- - report_platform_briefs
-- - All final report tables
-- - pipeline_events (filtered by report_id)
```

Or just create a new report with a different competitor name.

### Full Reset Between Test Sessions

To reset everything:

```bash
# Backup current data (optional)
pg_dump "$CONNECTION_STRING" > backup-$(date +%s).sql

# Drop and recreate schema
pnpm db:migrate --fresh  # This might not work; use SQL instead

# Or manually:
psql "$CONNECTION_STRING" << 'EOF'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
EOF

# Re-apply migrations
pnpm db:migrate
```

---

## 9. Success Criteria ✅

After this test, you should have:

- ✅ Report created with only reddit source job (postgres mode, not Inngest)
- ✅ Source job claimed by worker safely (no race conditions)
- ✅ Reddit posts fetched and stored in mentions table (~100–150 rows)
- ✅ Stage A extraction ran (LLM analyzed mentions)
- ✅ Stage B summarization ran (LLM created brief)
- ✅ Fan-in detected completion and created synthesis job
- ✅ Synthesis job claimed and ran (Stages C, D, E)
- ✅ Report marked completed with all final sections populated
- ✅ Progress endpoint shows `status: "completed"` and all events
- ✅ UI displays the final report with complaints, feature gaps, pricing, switching, positioning
- ✅ No Inngest events were sent (verified by absence of inngest calls in logs)
- ✅ All retries, backoffs, and recovery worked as expected

If all checks pass, the PostgreSQL runner is working end-to-end!

---

## 10. Next Steps

Once this test passes:

1. **Run unit tests** to verify edge cases (concurrent claiming, fan-in deduplication, etc.):
   ```bash
   pnpm test
   ```

2. **Add more platforms** (Phase 2):
   - Update `createReport()` to insert jobs for G2, Twitter, LinkedIn, etc.
   - No worker changes needed; it's platform-agnostic

3. **Load testing** (optional):
   - Create 10 concurrent reports
   - Verify worker handles them all without race conditions
   - Monitor database performance

4. **Production readiness**:
   - Set `REPORT_PIPELINE_ENGINE=postgres` in production `.env`
   - Monitor stale job recovery in production logs
   - Consider horizontal scaling (multiple worker processes/pods)

---

**Last updated:** 2026-05-19  
**Contact:** For questions, check worker logs and database state as outlined above.
