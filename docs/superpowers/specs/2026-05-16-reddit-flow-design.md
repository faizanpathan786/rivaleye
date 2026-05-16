# Reddit Flow — Design Spec

**Date:** 2026-05-16  
**Status:** Approved

---

## Context

RivalEye's core value prop: enter a competitor's name, get a report of what their users hate. The Reddit flow is the first end-to-end implementation of this loop. Reddit is the highest-signal DIY scraper (free OAuth API, rich complaint threads, no Apify cost). This spec covers everything from the user typing a competitor name through to seeing pain cluster cards on screen.

---

## User Journey

1. User lands on home page → types competitor name (e.g. "Notion"), picks category ("productivity"), picks goal ("find_user_pain") → submits
2. API validates input → inserts report row (`status: queued`) → enqueues `scrape-platform` job for Reddit
3. Worker picks up job → Reddit scraper fetches posts + comments → bulk-inserts to `mentions` table → enqueues `generate-report`
4. Worker picks up `generate-report` → loads mentions → calls Claude twice (search terms, then pain clustering) → writes `PainReportOutput` to `reports.output` → sets `status: completed`
5. Web frontend polls `GET /v1/reports/:id` every 3s → once completed, renders pain cluster cards

---

## Architecture

```
web (Vite + React)
  CompetitorForm  →  POST /v1/reports
  ReportPage      →  GET  /v1/reports/:id  (poll)
                  →  renders PainClusterCard grid

api (Elysia + pg-boss)
  POST /v1/reports   validate → insert report → enqueue scrape-platform
  GET  /v1/reports   list user's reports (DB query)
  GET  /v1/reports/:id  return report + output (DB query)

worker (Bun + pg-boss)
  [scrape-platform]   RedditScraper.fetch() → insert mentions → enqueue generate-report
  [generate-report]   load mentions → LLM cluster → update report.output + status
```

**Hard rules preserved:**
- API never calls scrapers or LLM. Long work lives in worker only.
- Scrapers return `NormalizedPost[]` only. No Reddit-specific fields leak past scraper boundary.
- All DB changes via Drizzle migrations. No raw SQL.

---

## Data Model

### New table: `mentions`

```typescript
// packages/api/src/db/schema/mentions.ts
{
  id:          uuid PK default gen_random_uuid()
  reportId:    uuid NOT NULL FK → reports.id ON DELETE CASCADE
  platform:    text NOT NULL   -- "reddit"
  externalId:  text NOT NULL   -- Reddit post t3_ ID
  url:         text NOT NULL
  author:      text            -- null if deleted
  title:       text            -- null for comment-only posts
  body:        text NOT NULL   -- selftext + top comments concatenated
  score:       integer
  numComments: integer
  postedAt:    timestamp NOT NULL  -- original Reddit post date
  raw:         jsonb NOT NULL  -- original Reddit API response
  createdAt:   timestamp NOT NULL default now()

  UNIQUE (reportId, platform, externalId)
}
```

**Existing `reports` table** (no schema change needed — `output jsonb` already exists for `PainReportOutput`).

---

## Component Breakdown

### `packages/scrapers/src/reddit/` (port + rewrite from legacy)

| File | Responsibility |
|------|---------------|
| `auth.ts` | OAuth2 client credentials. Token cache with 60s buffer. Concurrent-refresh dedup. |
| `client.ts` | Axios wrapper. Base: `https://oauth.reddit.com`. Timeout: 15s. Retry: 3× exponential (1s/2s/4s). Respects `Retry-After` on 429. |
| `rate-limiter.ts` | Token bucket. 55 tokens/min (safety below Reddit's 60 req/min). Queue drain loop. |
| `search.ts` | `searchPosts(term, sort, time, limit)` → raw Reddit listings |
| `comments.ts` | `getComments(postId)` → top-level + depth-2 replies. Filters deleted/AutoModerator. |
| `normalize.ts` | raw Reddit post + comments → `NormalizedPost`. Body = selftext + top 5 comments joined. |
| `index.ts` | `RedditScraper implements Scraper`. `fetch(query)` flow: build search terms from `query.competitor` + `query.category` → search → fetch comments per post → normalize → return `NormalizedPost[]` |

**Search term strategy (inside `RedditScraper.fetch`):**  
Build 6 deterministic template terms locally (no LLM call at scrape time — LLM is only used in `generate-report`):
- `"{competitor} complaints"`
- `"{competitor} alternatives"`
- `"{competitor} vs"`
- `"{competitor} pricing"`
- `"{competitor} switching"`
- `"{competitor} review"`

Fetch up to 50 posts per term (`sort=relevance`, `time=year`). Fetch up to 10 comments per post. Total cap: 500 posts per run.

### `packages/worker/src/jobs/scrape-platform.ts`

1. Call `getScraper(platform).fetch(query)` → `NormalizedPost[]`
2. Bulk-insert to `mentions` in chunks of 500 (skip on conflict by `(reportId, platform, externalId)`)
3. Update `reports.status = "running"` if still `"queued"`
4. Enqueue `generate-report` job with `{ reportId }`

### `packages/worker/src/jobs/generate-report.ts`

1. Load all mentions for `reportId` from DB
2. **LLM call 1 — search term generation:**  
   Prompt: given competitor name + category, return 8-10 search queries. Result passed as context to the clustering prompt so Claude understands what angles were searched.
3. **LLM call 2 — pain clustering**:  
   Batch mentions body text → Claude → return `PainCluster[]` matching `shared` types
4. Build full `PainReportOutput` (summary, painClusters, featureGaps, pricingPain, switchingSignals, voiceOfCustomer, positioningAngles, recommendedActions)
5. `UPDATE reports SET output = $output, status = 'completed', updatedAt = now() WHERE id = $reportId`
6. On any error: `UPDATE reports SET status = 'failed'`

### `packages/worker/src/llm.ts`

Thin Claude wrapper using Anthropic SDK with prompt caching. Single export: `callLlm(systemPrompt, userPrompt): Promise<string>`. Model: `claude-haiku-4-5-20251001` for cost. `ANTHROPIC_API_KEY` from env.

### `packages/api/src/db/schema/mentions.ts`

Drizzle table definition. Run `pnpm db:generate && pnpm db:migrate` after adding.

### `packages/api/src/controllers/reports/handlers/`

- `list-reports.ts` — real DB query: `SELECT * FROM reports WHERE ownerId = $userId ORDER BY createdAt DESC`
- `get-report.ts` — `SELECT * FROM reports WHERE id = $id AND ownerId = $userId`

### `packages/web/src/`

| File | Responsibility |
|------|---------------|
| `lib/api.ts` | Typed fetch wrapper. `createReport(input)`, `getReport(id)`, `listReports()`. Reads `VITE_API_URL`. |
| `pages/home.tsx` | `CompetitorForm`: competitor name input + category select + goal select → `createReport()` → `navigate("/reports/:id")` |
| `pages/report.tsx` | Polls `getReport(id)` every 3s while `status !== "completed"`. Shows loading state. Renders `PainClusterCard` grid when done. |
| `components/pain-cluster-card.tsx` | Props: `PainCluster`. Shows title, category badge, evidence quote count, up to 3 quotes. |
| `app.tsx` | Add react-router-dom routes: `/` → `<HomePage>`, `/reports/:id` → `<ReportPage>` |

---

## LLM Prompts

### Pain clustering (generate-report worker)

**System:**
```
You are a competitive intelligence analyst. Given Reddit posts and comments mentioning a competitor product, identify distinct pain point clusters.

For each cluster return:
- title: 3-7 word theme name
- description: 1-2 sentences explaining the pain
- evidence: array of 2-5 direct quotes from the posts

Group by user pain, not by feature. Prioritize complaints with multiple independent mentions.
Return valid JSON only: { "painClusters": [...], "featureGaps": [...], "pricingPain": "...", "switchingSignals": [...], "voiceOfCustomer": [...], "positioningAngles": [...], "recommendedActions": [...] }
```

**User:**
```
Competitor: {name}
Category: {category}

Posts and comments:
{mentions joined by "\n---\n", truncated to fit context}
```

---

## Error Handling

- Reddit 429: respect `Retry-After`, retry via rate limiter queue — never crash worker
- Reddit OAuth failure: throw `ScraperError`, worker marks job failed, report → `status: failed`
- LLM JSON parse failure: log warning, set `output` to partial result with defaults, still mark `completed`
- All scraper errors bubble as `ScraperError(platform, message)` — worker catches and sets report to `failed`

---

## Verification Plan

1. `pnpm db:generate && pnpm db:migrate` — confirms `mentions` table created
2. `pnpm --filter @rivaleye/worker dev` — worker boots without errors
3. `POST /v1/reports` with `{ category: "productivity", competitors: ["Notion"], goal: "find_user_pain", platforms: ["reddit"] }` → get `{ id, status: "queued" }`
4. Poll `GET /v1/reports/:id` every few seconds → watch status: queued → running → completed
5. Inspect `reports.output` in Drizzle Studio — verify `painClusters` array populated
6. Visit `/reports/:id` in browser — pain cluster cards render with titles + quotes
7. `pnpm type-check` — no TypeScript errors across workspace
