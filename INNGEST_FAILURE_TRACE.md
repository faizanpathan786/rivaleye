# Inngest Failure Trace: Exact Point of Breakdown

When a user tries to create a report **without INNGEST_EVENT_KEY set**, here's exactly what happens:

---

## The HTTP Request

```http
POST /v1/reports HTTP/1.1
Content-Type: application/json

{
  "category": "productivity",
  "competitors": ["Notion"],
  "target_audience": "founders",
  "founder_goal": "find_user_pain"
}
```

---

## What Happens in the API

### Step 1: Request Hits Handler ✓
```
POST /v1/reports
  ↓
packages/api/src/controllers/reports/handlers/createReport.ts
  ↓
(validate with Elysia schema) ✓
  ↓
call createReport(user.id, body)
```

### Step 2: Service Execution Begins ✓
```
packages/api/src/services/reports.service.ts:createReport()
  ↓
const [row] = await db.insert(reports).values({...}).returning()
  ✓ INSERT succeeds - report row created with status="queued"
  ✓ Return value: { id: "abc-123" }
```

### Step 3: Keyword Expansion (LLM) - SKIPPED BY MOCK
```
const keywords = await expandKeywords(llm, {...})
  (We mocked this in tests to avoid needing OPENROUTER_API_KEY)
  (In real code, this would require OPENROUTER_API_KEY)
```

### Step 4: Platform Jobs Creation ✓
```
await db.insert(report_platform_jobs).values(
  ENABLED_PLATFORMS.map((platform) => ({
    report_id: "abc-123",
    platform,  // "reddit", "appstore", "playstore", ...
    status: "queued",
  }))
)
  ✓ INSERT succeeds - 6 rows created
```

### Step 5: **INNGEST EVENT DISPATCH - THIS IS WHERE IT FAILS** ✗

```typescript
await inngest.send(
  ENABLED_PLATFORMS.map((platform) => ({
    name: "scrape.fetch",
    data: {
      reportId: "abc-123",
      platform,
      competitor: "Notion",
      category: "productivity",
      keywords: ["..."],
    },
  }))
)
```

**This call:**
1. Opens HTTP connection to Inngest API (default: http://localhost:8288 or Inngest cloud)
2. Sends authentication header with `INNGEST_EVENT_KEY`
3. Inngest validates the key
4. **KEY NOT FOUND IN ENVIRONMENT** ✗
5. Inngest returns 401 Unauthorized with message: "Event key not found"

---

## The Error Stack

```
error: Inngest API Error: 401 Event key not found
  at /node_modules/inngest/components/Inngest.js:597

Stack trace:
  at inngest.send()
    packages/api/src/services/reports.service.ts:103
      
  at createReport()
    packages/api/src/controllers/reports/handlers/createReport.ts:15
    
  at POST /v1/reports handler
    (Elysia error boundary catches this)
```

---

## What the User Sees

### In Browser Console / Response

```json
{
  "status": 400,
  "message": "Failed to create report",
  "error": "Inngest API Error: 401 Event key not found"
}
```

### In Frontend

Report creation fails. User sees error toast: "Failed to create report: Inngest API Error: 401 Event key not found"

---

## Database State After Failure

### What Got Written

```sql
-- ✓ Report row EXISTS
SELECT * FROM reports WHERE id = 'abc-123';
  ↓
{
  id: 'abc-123',
  owner_id: 'user-uuid',
  status: 'queued',        ← Still queued!
  stage: 'queued',         ← Never advances
  category: 'productivity',
  ...
}

-- ✓ Platform jobs EXIST
SELECT * FROM report_platform_jobs WHERE report_id = 'abc-123';
  ↓
{
  report_id: 'abc-123',
  platform: 'reddit',
  status: 'queued',        ← Still queued!
  stage: 'scrape',         ← Never advances
  created_at: '2026-05-19T11:10:47Z',
  ...
}  (× 6 rows, one per platform)
```

### Why This is Confusing

- The HTTP request **appears to fail** (API returns 400)
- But **data is partially written** to the database
- User doesn't know if report was created or not
- If they retry, they get a UNIQUE constraint error (duplicate job per platform)

---

## The Cascade Effect

Because `inngest.send()` fails:

1. ❌ Inngest never queues `scrape.fetch` events
2. ❌ Worker-scrape never receives signals
3. ❌ No platform scraping happens
4. ❌ No mentions are fetched
5. ❌ Worker-llm gets nothing to process
6. ❌ Report status never updates
7. ❌ Frontend poll sees `status="queued"` forever
8. ❌ User sees: "Report creation in progress..." (forever, no progress)

---

## Code Path Visualization

```
createCompetitor()                        ✓ Works fine
  └─ db.insert(competitors)               ✓ No external dependencies

createReport()                            ✓ Partially works
  ├─ db.insert(reports)                   ✓ Works
  ├─ expandKeywords(llm, ...)             ⚠ Requires LLM API key (but can be mocked)
  ├─ db.insert(report_platform_jobs)      ✓ Works
  └─ inngest.send([...])                  ✗ FAILS HERE without INNGEST_EVENT_KEY
      │
      └─ Throws error: 401 Unauthorized
          ↓
          HTTP 400 response to client
          ↓
          Report created but orphaned (jobs stuck)
```

---

## How To Fix (Step by Step)

### 1. Start Inngest Dev Server

```bash
npx inngest-cli@latest dev
```

Output:
```
Inngest Dev Server listening on http://localhost:8288
```

### 2. Get Event Key

Navigate to: http://localhost:8288

Look for UI showing:
- "Event Key: sk-z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p" (example format)

### 3. Update .env

```bash
# Before:
CONNECTION_STRING=postgresql://...
BETTER_AUTH_SECRET=...

# After:
CONNECTION_STRING=postgresql://...
BETTER_AUTH_SECRET=...
INNGEST_EVENT_KEY=sk-z1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

### 4. Restart API Server

```bash
# Kill old: Ctrl+C
# Start new:
pnpm --filter @rivaleye/api dev
```

### 5. Test Again

```bash
CONNECTION_STRING=... bun test packages/api/src/__tests__/debug-inngest-integration.test.ts
```

Expected output:
```
✓ INNGEST_EVENT_KEY is set: YES
✓ inngest.send() succeeded
✓ Inngest Send Results: Succeeded: 6/6
```

---

## Code That Needs Fixing

**File:** `packages/api/src/services/reports.service.ts`  
**Lines:** 103-114

```typescript
// CURRENT (broken when INNGEST_EVENT_KEY not set):
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

// COULD ADD error handling:
try {
  await inngest.send([...]);
} catch (err) {
  // Log but don't fail report creation?
  // Or re-throw with better message?
  console.error("Failed to queue scrape jobs:", err);
  throw err; // Currently re-throws, causing 400 to user
}
```

**Current behavior:** Error is thrown → 400 response → report creation fails

**Could be improved:**
- Log the error
- Continue anyway (report created, but workers never notified)
- Return warning to user: "Report created but scraping disabled"

---

## Event Key Missing - Symptom vs Root Cause

### Symptoms (What User Sees)

- ❌ Report creation returns 400 error
- ❌ Reports stuck in `queued` status
- ❌ Frontend shows "Report creation in progress" forever
- ❌ No data appears in report view
- ❌ Worker logs show no incoming events

### Root Cause (What's Really Happening)

- `INNGEST_EVENT_KEY` environment variable not set
- `inngest.send()` fails auth with 401
- Error propagates to API handler
- Handler returns 400 to client
- Jobs created in DB but never processed

### How They're Related

```
Missing INNGEST_EVENT_KEY
    ↓
inngest.send() authentication fails (401)
    ↓
createReport() throws error
    ↓
API returns 400 to user
    ↓
User sees: "Failed to create report"
    ↓
But in DB: Report rows exist, jobs stuck in "queued"
```

---

## Verification Checklist

After adding `INNGEST_EVENT_KEY`:

- [ ] `INNGEST_EVENT_KEY` set in `.env`
- [ ] Inngest dev server running on localhost:8288
- [ ] `bun test` shows "Inngest Send Results: Succeeded: 6/6"
- [ ] Create a report in the app
- [ ] Report status changes from `queued` to `running` within 10 seconds
- [ ] Worker logs show "scrape.fetch received"
- [ ] Report status becomes `completed` within 5-15 minutes
- [ ] Full report renders in UI

---

## Why This Matters

This is a **configuration dependency** that's easy to miss:

- The API code is correct
- The database schema is correct
- The worker code is correct
- **But without this one environment variable, nothing works**

It's like having a perfect house with no electricity - structurally sound, but non-functional.
