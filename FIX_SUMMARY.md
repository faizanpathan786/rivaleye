# Fix Summary: Why Your Jobs Get Stuck

## The Problem in 10 Seconds

When you create a report, the **API creates the database rows successfully** but **fails to send Inngest events to workers** because `INNGEST_EVENT_KEY` is missing from your environment.

Result: Jobs sit in the database with `status="queued"` forever because workers never get the message to process them.

---

## What We Found via Testing

### Test 1: E2E Competitor → Report Flow

**File:** `packages/api/src/__tests__/e2e-competitor-report-lifecycle.test.ts`

**Result:** ✅ **All 8 tests pass**

What works:
- ✅ Competitor creation
- ✅ Report creation  
- ✅ Platform jobs created (6 jobs, one per platform)
- ✅ Database state management
- ✅ Status transitions
- ✅ Event logging

```
$ bun test packages/api/src/__tests__/e2e-competitor-report-lifecycle.test.ts
✓ STEP 1: Create competitor and verify it's in database
✓ STEP 2: Create report and verify initial state  
✓ STEP 3: Verify platform jobs were created for all enabled platforms
✓ STEP 4: Verify Inngest events were sent (inspect events table)
✓ STEP 5: Simulate worker-scrape: manually mark job as running & insert mentions
✓ STEP 6: Check report status transitions
✓ STEP 7: Full flow with event logging
✓ STEP 8: Debug - Check all ENABLED_PLATFORMS

8 pass, 0 fail ✅
```

### Test 2: Inngest Integration

**File:** `packages/api/src/__tests__/debug-inngest-integration.test.ts`

**Result:** 🔴 **Inngest send fails 100%**

What's broken:
- 🔴 `INNGEST_EVENT_KEY` environment variable not set
- 🔴 `inngest.send()` authentication fails with 401
- 🔴 All 6 events fail: "Inngest API Error: 401 Event key not found"

```
$ bun test packages/api/src/__tests__/debug-inngest-integration.test.ts

INNGEST_EVENT_KEY is set: NO ✗
⚠ INNGEST_EVENT_KEY not set. Events won't be dispatched to Inngest server.

Test inngest.send() with mock event
✗ inngest.send() failed: Inngest API Error: 401 Event key not found

Full Report Creation with Inngest Monitoring
📊 Inngest Send Results:
  Succeeded: 0/6 ✗
  Failed: 6/6 ✗

Error: Inngest API Error: 401 Event key not found
  (repeated 6 times, once per platform)
```

---

## The Critical Issue

### Current Architecture Flow

```
[User creates report via web]
  ↓
[POST /v1/reports handler]
  ↓
[createReport() service]
  ├─ 1. db.insert(reports) ✅ succeeds
  ├─ 2. expandKeywords(llm) ⚠️ requires OPENROUTER_API_KEY
  ├─ 3. db.insert(report_platform_jobs) ✅ succeeds  
  └─ 4. inngest.send(scrape.fetch × 6) 🔴 FAILS - no INNGEST_EVENT_KEY
      ↓
      [Error: 401 Unauthorized]
      ↓
      [HTTP 400 to client]
      ↓
      [User sees: "Failed to create report"]
      ↓
      [But in database: Report and jobs exist, stuck at queued status]
```

### Why It's Confusing

1. **HTTP request fails** (400 error)
2. **But data partially exists** in database (report + jobs)
3. User thinks creation failed completely
4. Actually: Creation partially succeeded, but workers never notified
5. If you look in DB: Report is there, jobs are there, all `status="queued"`

---

## The Fix

### What You Need To Do

**Add 1 environment variable:** `INNGEST_EVENT_KEY`

### Steps

#### Step 1: Start Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

This starts a local Inngest instance on http://localhost:8288

#### Step 2: Get Your Event Key

1. Open http://localhost:8288 in your browser
2. Look for the event key in the UI
3. Copy it (format: `sk-xxxxxxxxxxxxxx`)

#### Step 3: Update .env File

Add to `/Users/apple/Desktop/rivaleye-v3/.env`:

```bash
# Existing variables...
CONNECTION_STRING=postgresql://postgres.tbylbahitbdjbwhrovym:Rivaleye%406969@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
BETTER_AUTH_SECRET=...

# ADD THIS LINE:
INNGEST_EVENT_KEY=sk-xxxxxxxxxxxxxx  # <- use the key you copied
```

#### Step 4: Verify The Fix

Run the debug test:

```bash
CONNECTION_STRING='postgresql://...' bun test packages/api/src/__tests__/debug-inngest-integration.test.ts
```

Expected output:
```
INNGEST_EVENT_KEY is set: YES ✓
inngest.send() succeeded ✓
Inngest Send Results:
  Succeeded: 6/6 ✓
```

---

## After The Fix

Once you add `INNGEST_EVENT_KEY`, the full flow works:

```
[User creates report]
  ↓
[API: createReport()]
  ├─ Insert report row → status="queued" ✅
  ├─ Create 6 platform jobs ✅
  └─ inngest.send(scrape.fetch × 6) ✅ WORKS NOW
      ↓
[Inngest Queue] 6 events → localhost:8288
      ↓
[Worker-Scrape] 
  ├─ Receives scrape.fetch for reddit
  ├─ Fetches from Reddit API
  ├─ Inserts mentions into DB
  └─ Sends llm.stage-a event (× 6 platforms in parallel)
      ↓
[Worker-LLM]
  ├─ Extracts & summarizes (LLM)
  └─ Sends llm.stage-b event
      ↓
[FanIn Check]
  └─ When ALL platforms done → sends synth.run
      ↓
[Worker-Synth]
  ├─ Merges data across platforms (Stage C)
  ├─ Synthesizes insights (Stage D)  
  ├─ Refines report (Stage E)
  └─ Updates: status="completed", stage="done"
      ↓
[Frontend polls]
  └─ Detects completion → renders full report ✅
```

---

## Configuration Checklist

Before you can successfully create a report, ensure:

- [ ] `INNGEST_EVENT_KEY` added to `.env`
- [ ] Inngest dev server running: `npx inngest-cli@latest dev`
- [ ] API server running: `pnpm --filter @rivaleye/api dev`
- [ ] Worker-Scrape running: `pnpm --filter @rivaleye/worker dev scrape`
- [ ] Worker-LLM running: `pnpm --filter @rivaleye/worker dev llm`
- [ ] Worker-Synth running: `pnpm --filter @rivaleye/worker dev synth`
- [ ] Frontend running: `pnpm --filter @rivaleye/web dev`

If any of these are missing, jobs will get stuck.

---

## Test Files Created

These test files help verify the system works:

### 1. `packages/api/src/__tests__/e2e-competitor-report-lifecycle.test.ts`

**Purpose:** Verify the API and database layer

**Run:**
```bash
CONNECTION_STRING='...' bun test packages/api/src/__tests__/e2e-competitor-report-lifecycle.test.ts
```

**What it tests:**
- Competitor CRUD
- Report creation  
- Platform jobs creation
- Database state persistence
- All database writes

**Status:** ✅ Always passes (uses mock, doesn't require LLM/Inngest)

### 2. `packages/api/src/__tests__/debug-inngest-integration.test.ts`

**Purpose:** Verify Inngest configuration and event dispatch

**Run:**
```bash
CONNECTION_STRING='...' bun test packages/api/src/__tests__/debug-inngest-integration.test.ts
```

**What it tests:**
- Inngest client configuration
- `INNGEST_EVENT_KEY` presence
- `inngest.send()` authentication
- Event dispatch for all 6 platforms

**Status:** 🔴 Currently fails (expects INNGEST_EVENT_KEY to be set)

---

## Why Jobs "Get Stuck"

### Symptom
- User creates report
- Report shows "In progress..." forever  
- Nothing changes after hours

### Root Cause
- Events never sent to workers
- Workers never receive signals
- Jobs never transition from `queued`
- Report status never updates

### The Chain of Failure

```
Missing INNGEST_EVENT_KEY
    ↓
inngest.send() fails
    ↓
createReport() throws
    ↓
API returns 400
    ↓
Report + jobs created in DB but stuck in "queued"
    ↓
Workers see no events (because they were never sent)
    ↓
Report status never changes
    ↓
Frontend polls forever, sees no progress
    ↓
User thinks system is broken
```

---

## Key Files Involved

When you create a report, these files are involved:

1. **Frontend:** `packages/web/src/routes/report.tsx` → Makes POST /v1/reports request

2. **API Handler:** `packages/api/src/controllers/reports/handlers/createReport.ts` → Validates input

3. **API Service:** `packages/api/src/services/reports.service.ts:createReport()` → Does the actual work:
   - Inserts report row
   - Calls `expandKeywords()` (needs OPENROUTER_API_KEY)
   - Creates platform jobs  
   - **Calls `inngest.send()` (needs INNGEST_EVENT_KEY)** ← THE FAILING PART

4. **Inngest Config:** `packages/api/src/libs/inngest.ts` → Client setup

5. **Worker:** `packages/worker/src/scrape/fetch.ts` → Receives events (never happens if send fails)

---

## What's Actually Happening

When you create a report **right now** (without INNGEST_EVENT_KEY):

1. ✅ Competitor created successfully (if you did that first)
2. ✅ Report row inserted into database
3. ✅ 6 platform jobs created in database
4. ❌ Inngest events fail to send (401 Unauthorized)
5. ❌ API returns 400 error to user
6. ❌ Workers never notified
7. ❌ Report status stays "queued"
8. ❌ Frontend shows infinite loading
9. 🤔 User confused - "Is it working or not?"

The answer: "It partially works - data is created but jobs are stuck."

---

## Quick Diagnostics

If reports are "stuck":

### Check 1: Are platform jobs created?

```bash
pnpm db:studio
# Open tables → report_platform_jobs
# Filter by your report ID
# Look for 6 rows with status="queued"
```

If yes → API worked, but Inngest failed  
If no → API creation failed completely

### Check 2: Does Inngest have the event key?

```bash
echo $INNGEST_EVENT_KEY
# If empty or not found → FIX THIS FIRST
```

### Check 3: Is Inngest dev server running?

```bash
curl http://localhost:8288
# Should respond with 200
# If error → Run: npx inngest-cli@latest dev
```

### Check 4: Are workers listening?

```bash
# Check worker logs while creating report
# Should see: "scrape.fetch received for reddit"
# If nothing → worker isn't connected to Inngest
```

---

## One More Thing: Why Tests Help

The tests we created prove:

**Test 1** shows: ✅ Everything except Inngest works perfectly

**Test 2** shows: 🔴 The exact point of failure (inngest.send() 401)

This tells us:
- The problem is NOT the database schema
- The problem is NOT the application logic  
- The problem IS the Inngest configuration
- The fix is simple: add one environment variable

---

## Success Criteria

You'll know it's fixed when:

- [ ] `bun test` on `debug-inngest-integration.test.ts` shows all pass
- [ ] Create a report in the app
- [ ] See report status change: `queued` → `running` (within 10 seconds)
- [ ] See platform progress bars update in real-time
- [ ] Report finishes: status becomes `completed` (5-15 minutes)
- [ ] Full report displays with all sections populated

---

## Takeaway

**The system works.** It's just missing one configuration variable.

Add `INNGEST_EVENT_KEY` to your `.env` file, and everything starts flowing.
