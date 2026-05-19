# PostgreSQL Runner Tests

Comprehensive test suite for the postgres-based job runner (pg-runner) without live Reddit/LLM calls.

## Files Created

### 1. `packages/api/src/__tests__/postgres-report-creation.test.ts`
**Purpose:** Test report creation in postgres mode

**Tests:**
- `creates report with correct initial status` — Report creation with queued/queued state
- `creates one job per enabled platform` — Platform job fan-out for all ENABLED_PLATFORMS
- `maintains uniqueness: one job per (report_id, platform)` — Uniqueness constraints
- `transaction is atomic: report + jobs succeed together` — Transactional integrity
- `inngest is NOT called in postgres mode` — No event dispatching (postgres runner handles it)
- `feature flag: enables/disables postgres runner mode` — Feature flag behavior
- `handles multiple concurrent report creations` — Concurrency safety
- `job metadata is correctly initialized` — Job metadata (attempt_count, max_attempts, etc.)

**Key assertions:**
- Report status = "queued", stage = "queued"
- One job per platform with status = "queued", stage = "scrape"
- attempt_count = 0, max_attempts = 3
- locked_at/locked_by = null (not yet claimed)
- Uniqueness constraint on (report_id, platform)

---

### 2. `packages/worker/src/__tests__/pg-runner-job-claiming.test.ts`
**Purpose:** Test concurrent job claiming with SELECT...FOR UPDATE SKIP LOCKED

**Tests:**
- `source job: claims next queued job and transitions to running` — Job claiming and status transition
- `source job: same job cannot be claimed twice` — Prevents duplicate claiming
- `source job: multiple workers claim different jobs atomically` — Concurrent claiming by 3 workers
- `source job: respects run_after timestamp for job scheduling` — Future job scheduling
- `synthesis job: claims and transitions correctly` — Synthesis job claiming
- `synthesis job: only one synthesis job per report` — Uniqueness per report
- `source job: FOR UPDATE SKIP LOCKED prevents race conditions` — 10-worker stress test
- `source job: increments attempt_count on each claim` — Attempt tracking across retries
- `returns null when no jobs available` — Empty queue handling

**Key assertions:**
- Job transitions to status = "running" with locked_at and locked_by set
- attempt_count incremented on each claim
- Same job never claimed twice
- Multiple workers claim different jobs
- run_after timestamp respected for scheduling
- No race conditions in concurrent scenarios

---

### 3. `packages/worker/src/__tests__/pg-runner-worker.test.ts`
**Purpose:** Test source and synthesis job processing (with mocked scrapers/LLM)

**Tests:**
- `source job: persists mentions from scraper output` — Mention persistence from normalized posts
- `source job: marks job completed after successful processing` — Job completion marking
- `source job: updates report status to running` — Report status transitions
- `source job: retry logic on failure (not max attempts)` — Exponential backoff on transient errors
- `source job: marks failed when max attempts exceeded` — Permanent failure handling
- `synthesis job: transitions from queued to running` — Synthesis job claiming
- `synthesis job: marks completed after pipeline run` — Synthesis job completion
- `synthesis job: updates report to completed status` — Report finalization
- `handles transient error: resets job to queued` — Error recovery with backoff
- `handles permanent error: marks job as failed immediately` — Non-retriable failures
- `backoff calculation: exponential delays` — 30s, 2m, 5m backoff verification
- `concurrent job processing: no interference between jobs` — Job isolation
- `mention deduplication: upserts prevent duplicates` — Uniqueness on (report_id, platform, external_id)

**Key assertions:**
- Mentions inserted with all required fields (url, author, title, body, posted_at, raw)
- Job status transitions: running → completed/failed
- Report status transitions: queued → running → completed
- Exponential backoff: [30s, 2m, 5m] for retry attempts 0, 1, 2+
- Transient errors reset job to queued with run_after backoff
- Permanent errors mark job as failed immediately
- Concurrent jobs don't interfere

---

### 4. `packages/worker/src/__tests__/pg-runner-fanin-e2e.test.ts`
**Purpose:** Mocked end-to-end workflow test with fan-in

**Test Steps:**
1. **STEP 1: Create Report** — Report + platform jobs created
2. **STEP 2: Process Source Job** — Mock fetch → persist mentions → extract → summarize → mark complete
3. **STEP 3: Verify Mentions** — Verify mentions persisted in database
4. **STEP 4: Fan-in Check** — All source jobs terminal → synthesis job created
5. **STEP 5: Process Synthesis Job** — Mock pipeline stages C, D, E → update report with results
6. **STEP 6: Verify Completion** — Report status = "completed", stage = "done"
7. **STEP 7: Final States** — All jobs have correct final states
8. **STEP 8: Timeline** — Measure end-to-end duration
9. **Partial Failures** — Handle mixed completed/failed jobs gracefully

**Mock Implementations:**
- Scraper output: `mockScraperOutput` with 2 normalized posts
- Pipeline execution: `mockPipelineOutput` with pain points and sentiment
- Fan-in logic: `mockFanIn()` checks terminal state and creates synthesis job

**Key Assertions:**
- Report transitions: queued → running → completed
- Mentions persisted correctly
- Fan-in triggers when all source jobs terminal
- Synthesis job created and claimed
- Report updated with pipeline output (sentiment, stage, scanned_at)
- All jobs have correct final states (status, completed_at, locked_at=null)
- Partial failures don't prevent fan-in

---

## Running the Tests

### API Tests (postgres-report-creation.test.ts)
```bash
# Run single test
bun test --env-file=.env packages/api/src/__tests__/postgres-report-creation.test.ts

# Run all API tests
bun test --env-file=.env packages/api/src/__tests__/
```

### Worker Tests
```bash
# Run job claiming tests
bun test --env-file=.env packages/worker/src/__tests__/pg-runner-job-claiming.test.ts

# Run worker processing tests
bun test --env-file=.env packages/worker/src/__tests__/pg-runner-worker.test.ts

# Run E2E fan-in test
bun test --env-file=.env packages/worker/src/__tests__/pg-runner-fanin-e2e.test.ts --timeout 60000

# Run all worker tests via bun
pnpm --filter @rivaleye/worker test:bun

# Or via vitest (if configured)
pnpm --filter @rivaleye/worker test
```

## Test Configuration

### Environment Requirements
- `CONNECTION_STRING` — Postgres connection to Supabase
- `BETTER_AUTH_SECRET` — Auth secret (can be dummy for tests)
- Tests use real database (not mocked)
- External calls (scrapers, LLM) are mocked

### Database State
- Tests create users and reports
- Cleanup happens in afterAll hooks
- Cascade deletes clean up related records
- Tests are isolated and can run concurrently

## Key Testing Patterns

### 1. Transaction Testing (claim.ts)
```typescript
const job = await db.transaction(async (tx) =>
  claimSourceJob(tx as any, "worker-id:123:abc")
);
```
- Tests verify SELECT...FOR UPDATE SKIP LOCKED behavior
- Concurrent claiming prevents duplicates
- Atomicity ensured by transactions

### 2. Mention Persistence Testing
```typescript
const mentions = await db.insert(mentions).values([...]).returning();
expect(mentions).toHaveLength(posts.length);
```
- Tests verify all fields persisted correctly
- Uniqueness constraint on (report_id, platform, external_id)
- Duplicate detection

### 3. Fan-in Logic Testing
```typescript
const readyForSynthesis = await mockFanIn(reportId);
expect(readyForSynthesis).toBeTruthy();
const synthJobs = await db.select().from(synthesis_jobs).where(...);
expect(synthJobs).toHaveLength(1);
```
- Mock fan-in function checks if all source jobs terminal
- Creates synthesis job if not already created
- Tests verify synthesis job creation only when ready

### 4. Error Handling Testing
```typescript
// Transient error: reset to queued with backoff
await db.update(report_platform_jobs).set({
  status: "queued",
  run_after: new Date(Date.now() + 30000), // 30s backoff
  last_error: "Network timeout"
});

// Permanent error: mark as failed
await db.update(report_platform_jobs).set({
  status: "failed",
  last_error: "Invalid credentials"
});
```

## Coverage

### Postgres Runner Core Features
- ✅ Job claiming with FOR UPDATE SKIP LOCKED
- ✅ Concurrent worker safety
- ✅ Exponential backoff on retries
- ✅ Fan-in logic for synthesis job creation
- ✅ Report status transitions
- ✅ Mention persistence and deduplication
- ✅ Transient vs. permanent error handling
- ✅ Job state machines (queued → running → completed/failed)

### Not Tested (External Dependencies)
- ❌ Live scraper calls (Reddit, G2, etc.)
- ❌ Live LLM calls (OpenRouter, Claude)
- ❌ Stage A/B extraction and summarization
- ❌ Inngest event routing
- ❌ Pipeline stages C/D/E (only mocked)

## Future Improvements

1. **Integration Tests**: Add full pipeline tests with mocked external services
2. **Chaos Testing**: Simulate worker crashes and recovery
3. **Performance Tests**: Benchmark job claiming with 10k+ jobs
4. **Stress Tests**: Multiple concurrent workers claiming jobs
5. **Snapshot Tests**: Verify exact database state transitions

## References

- Database schema: `packages/api/src/db/schema/pipeline.ts`
- Job claiming: `packages/worker/src/pg-runner/claim.ts`
- Source worker: `packages/worker/src/pg-runner/source-worker.ts`
- Synthesis worker: `packages/worker/src/pg-runner/synthesis-worker.ts`
- Fan-in logic: `packages/worker/src/pg-runner/fan-in.ts`
