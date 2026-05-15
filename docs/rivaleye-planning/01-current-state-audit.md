# RivalEye Current State Audit

**Last Updated:** May 12, 2026  
**Status:** Partial MVP working, classification pipeline blocked

## Executive Summary

RivalEye has a functional foundation for Reddit-based competitive intelligence: API, database, ingestion, and frontend exist. However, the system is incomplete and blocked on LLM classification. The core value (competitor pain reports) is not yet deliverable. This audit identifies what works, what's broken, and what should be deleted or reused.

---

## What Already Exists ✅

### Backend Architecture (Solid)
- **Fastify API** (`packages/api/src/`)
  - JWT-based auth with refresh tokens ✓
  - Auth routes (signup, login, logout, me) ✓
  - Competitor CRUD routes (create, list, get, update, delete) ✓
  - Stats endpoint (competitor stats) ✓
  - Cluster retrieval endpoint ✓
  - Job monitoring routes ✓
  - Rate limiting via `@fastify/rate-limit` ✓
  - CORS configured ✓

- **Database Schema** (`packages/db/src/schema/`)
  - Users table with password hashing ✓
  - Workspaces with members (multi-tenant) ✓
  - Competitors with status (active/paused/archived) ✓
  - Mentions table with Reddit metadata ✓
  - Classifications table with sentiment/category/relevance ✓
  - Clusters table with mention grouping ✓
  - RedditSources table for per-competitor Reddit configs ✓
  - IngestionJobs table for job tracking ✓
  - CompetitorMentions junction table ✓

- **Reddit Integration** (`packages/reddit-client/src/`)
  - OAuth authentication ✓
  - Search posts by subreddit + keyword ✓
  - Fetch subreddit hot/new posts ✓
  - Fetch post comments ✓
  - Rate limiter (respects Reddit API limits) ✓
  - Text normalization/deduplication ✓

- **Job Queue** (`packages/api/src/queues.ts`, `packages/workers/`)
  - BullMQ integration with Redis ✓
  - Ingestion processor (finds Reddit sources, fetches mentions) ✓
  - Classification processor (LLM-powered batch classifier) ✓
  - Clustering processor (groups similar mentions) ✓
  - Job retry logic ✓
  - Job error tracking ✓

- **Services** (`packages/api/src/services/`)
  - Auth service (signup, login, token refresh) ✓
  - Competitor service (CRUD) ✓
  - Discovery service (LLM-powered source discovery) ✓

- **Frontend** (`packages/web/`)
  - Next.js 14 with TypeScript ✓
  - Tailwind + Shadcn UI components ✓
  - Auth pages (signup, login) ✓
  - Dashboard layout ✓
  - Competitor detail page ✓
  - Stats visualization (basic charts) ✓
  - Tab-based UI (growth, PM, sales tabs) ✓

### What Works in Production ✓

| Component | Status | Notes |
|-----------|--------|-------|
| **Signup/Login** | ✓ Working | JWT auth, password hashing, refresh tokens |
| **Competitor Creation** | ✓ Working | Non-blocking, queues discovery async |
| **Reddit Discovery** | ✓ Working | LLM identifies subreddits + search terms (~50-60s latency) |
| **Reddit Ingestion** | ✓ Working | Fetches ~500+ mentions in <10 seconds |
| **Deduplication** | ✓ Working | External ID prevents duplicates |
| **API Endpoints** | ✓ Working | 100% pass rate on core endpoints |
| **Database** | ✓ Working | Postgres + Drizzle migrations functional |
| **Job Queue** | ✓ Working | BullMQ picks up and processes jobs |

---

## What's Broken ❌

### 1. **Classification Pipeline (CRITICAL BLOCKER)**
- **Problem:** LLM classification fails consistently
- **Causes:**
  - Llama 3.1 8B (localhost:1234) has 8K context window - insufficient for batch prompts
  - Groq API rate-limited (100k TPD exhausted)
  - LLM returns non-JSON output, breaks JSON parsing
  
- **Impact:** No sentiment, category, relevance scores = can't generate insights
- **Evidence:** May 12 test - ingested 501 mentions, classified 1 (0.2% success)

### 2. **Clustering Pipeline (BLOCKED BY CLASSIFICATION)**
- **Problem:** Depends on classifications to group mentions
- **Status:** Code exists but never executes (no classifications to cluster)

### 3. **Report Generation (NOT IMPLEMENTED)**
- **Problem:** No code to convert data into founder-friendly report
- **Missing:**
  - Report schema (sections, evidence, recommendations)
  - Report generation logic
  - Report export (PDF, markdown, copy-to-clipboard)
  - Report saving/history

### 4. **Frontend Report Experience (NOT IMPLEMENTED)**
- **Problem:** Dashboard shows raw data, not actionable report
- **Missing:**
  - Report detail page
  - Evidence drawer with source links
  - Export buttons
  - Report history/saved reports
  - Share/download functionality

### 5. **Missing API Endpoints**
- No GET /mentions (mentioned in memory but not implemented)
- No GET /reports
- No POST /reports/{id}/export
- No GET /reports/{id}/evidence

---

## What's Incomplete ⚠️

### 1. **Source Abstraction Layer**
- **Current:** Reddit hardcoded in discovery, ingestion, ingestion processor
- **Needed:** Clean interface for multiple sources (Reddit, AppStore, G2, etc.)
- **Files affected:** `packages/api/src/services/discovery.service.ts`, `packages/workers/src/processors/ingestion.processor.ts`

### 2. **Error Handling & Observability**
- **Logging:** Uses Pino but no structured logging for job failures
- **Metrics:** No job timing, success rate tracking
- **Alerts:** No way to know classification is failing (unless manually checking queue)
- **Recovery:** Failed jobs don't auto-retry with backoff

### 3. **AI Analysis Pipeline**
- **Classification:** Batch classification exists but doesn't work due to LLM
- **Insights:** No code to extract actionable patterns (pain themes, feature requests, positioning gaps)
- **Report Writing:** No code to generate human-friendly report sections
- **Evidence Linking:** No code to include source snippets with mention links

### 4. **Frontend Polish**
- **Mobile:** Not responsive
- **Loading states:** Basic skeletons but missing for long operations (ingestion, classification)
- **Error states:** Limited error messaging
- **UX flows:** No guidance for new users
- **Navigation:** Minimal (no breadcrumbs, limited sidebar)

### 5. **Production Basics**
- **Secrets:** API keys in .env, not rotated
- **Validation:** Input validation at routes but not comprehensive
- **Rate limiting:** Fastify rate-limit configured but no per-user limits
- **Cost controls:** No LLM token budgets or quotas
- **Monitoring:** No health checks, no alerting for failed jobs
- **Backup:** No database backup strategy documented

---

## What Should Be Deleted or Simplified

### 1. **Unused Dashboard Tabs** (low priority)
- Growth tab, PM tab, Sales tab in competitor detail
- These are placeholder analytics
- **Action:** Replace with report-focused tabs (Executive Summary, Pain Themes, Opportunities, Evidence)

### 2. **Over-Engineered LLM Integration**
- Multiple LLM options (local Llama, Groq, Claude) causing complexity
- **Action:** Standardize on Claude API (Anthropic SDK already in use) with fallback to local for testing
- **Remove:** Groq integration, local Llama setup scripts

### 3. **Unused Services**
- Some discovery prompt logic could be simpler
- **Action:** Simplify prompt engineering, remove complexity

### 4. **Test Files in Root**
- `test-zerodha.js`, `benchmark-models.ts`, `clear-tables.sql`
- **Action:** Move to `/tests` or `/scripts`, remove from root

---

## Backend Status

### API Server (Fastify)
- **Port:** 3001
- **Code:** `packages/api/src/`
- **Routes:** Auth, competitors, mentions, stats, clusters, leads, jobs
- **Middleware:** JWT auth, CORS, rate limiting
- **Status:** ✓ Working, ready for feature additions

### Database (PostgreSQL + Drizzle)
- **Connection:** Via DATABASE_URL (Supabase or local)
- **Schema:** 9 tables (users, workspaces, competitors, mentions, classifications, clusters, etc.)
- **Migrations:** Drizzle with auto-generate
- **Status:** ✓ Working, schema stable
- **Gap:** No data retention policy, no archive/soft-delete strategy

### Job Queue (BullMQ + Redis)
- **Connection:** Via REDIS_URL
- **Processors:** 3 (ingestion, classification, clustering)
- **Status:** ✓ Working for ingestion, ❌ broken for classification/clustering
- **Gap:** No job monitoring UI, no dead-letter queue handling

### Reddit Client
- **Auth:** OAuth 2-legged (user agent auth)
- **Methods:** Search posts, fetch subreddit posts, fetch comments
- **Rate Limit:** Respects Reddit's 60 requests/min per IP
- **Status:** ✓ Working well
- **Gap:** No LinkedIn/Twitter/GitHub/G2 equivalents yet

---

## Frontend Status

### Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind + Shadcn UI (Radix primitives)
- **State:** Client-side only (no Redux/Zustand), manual API calls
- **Code:** `packages/web/src/`

### Pages
- `/auth/signup` - User registration ✓
- `/auth/login` - User login ✓
- `/dashboard` - Competitor list ✓
- `/dashboard/competitors/[id]` - Competitor detail with tabs ✓

### Components
- UI primitives (button, input, label, card, badge, etc.) ✓
- Stats charts (basic) ✓
- Skeleton loading states ✓

### Status
- **Auth flow:** ✓ Working
- **Competitor list:** ✓ Working
- **Competitor detail:** ✓ Basic working (shows tabs but tabs are placeholder)
- **Responsiveness:** ⚠️ Not mobile-friendly
- **Type safety:** ✓ Full TypeScript

### Gaps
- No report page/component
- No evidence drawer
- No export functionality
- No real-time updates (job progress polling missing)
- No error boundaries
- Limited loading states
- No user onboarding

---

## Data Flow Assessment

```
User Input
    ↓
✓ Competitor Creation (API)
    ↓
✓ Discovery (LLM finds Reddit sources)
    ↓
✓ Ingestion (Reddit API fetches mentions)
    ↓
❌ Classification (LLM context limit blocks)
    ↓
❌ Clustering (depends on classification)
    ↓
❌ Report Generation (not implemented)
    ↓
❌ Report Display (frontend not built)
```

---

## LLM Integration Assessment

### Current Setup
- **Local:** Llama 3.1 8B via LM Studio (localhost:1234)
- **Remote:** Claude API via Anthropic SDK (configured but not used)
- **Deprecated:** Groq (rate limited)

### Discovery Works ✓
- LLM identifies subreddits + search terms
- ~50-60 second latency (acceptable for background job)

### Classification Broken ❌
- Context window insufficient (8K tokens for even 2 mentions + prompt)
- Non-JSON output breaks parsing

### Recommendation
- **Use Claude API** (Anthropic SDK already in codebase)
  - 200K context window (vs Llama's 8K)
  - Better instruction-following
  - Higher cost but more reliable
- **Keep local Llama** for development/testing when offline

---

## Environment & Configuration

### Current .env Variables
```
DATABASE_URL           → Supabase PostgreSQL
REDIS_URL             → Local or cloud Redis
JWT_SECRET            → Auth (hardcoded, should rotate)
JWT_REFRESH_SECRET    → Auth refresh (hardcoded, should rotate)
REDDIT_CLIENT_ID      → Reddit OAuth
REDDIT_CLIENT_SECRET  → Reddit OAuth
REDDIT_USER_AGENT     → Identifies API calls
ANTHROPIC_API_KEY     → Claude API (configured but not used)
API_PORT              → Fastify (3001)
WEB_PORT              → Next.js (3000)
NODE_ENV              → development
```

### Gaps
- No Groq key (rate-limited)
- No local LLM endpoint documented
- No database backup credentials
- No monitoring/alerting credentials

---

## What Can Be Reused ✓

1. **Entire API skeleton** - Routes, middleware, auth
2. **Database schema** - Well-designed, normalized
3. **Reddit integration** - Solid, well-tested
4. **Frontend components** - Shadcn UI setup, auth pages
5. **Job queue architecture** - BullMQ pattern works
6. **Discovery service** - LLM-based source finding

---

## What Needs to Be Built

1. **Classification pipeline fix** - Switch to Claude API with proper batching
2. **Clustering pipeline** - Finish implementation (exists but untested)
3. **Report generation** - Core product logic (completely missing)
4. **Report UI** - Frontend pages and components (completely missing)
5. **Insights extraction** - Convert data into actionable patterns (completely missing)
6. **Export functionality** - PDF, markdown, copy (completely missing)
7. **Source abstraction** - Clean interface for multiple sources
8. **Production infrastructure** - Monitoring, alerting, cost controls
9. **Onboarding flow** - Guide new users through creating first report

---

## Risk Assessment

### Critical Risks 🔴
1. **LLM classification doesn't work** - Blocks entire product
2. **Groq rate limits** - Need alternative provider
3. **No report generation** - Can't deliver core product

### High Risks 🟠
1. **No cost controls** - LLM calls unmetered, could be expensive
2. **No error recovery** - Failed jobs not retried
3. **No data export** - Users can't take data elsewhere

### Medium Risks 🟡
1. **Single source (Reddit)** - Needs diversification
2. **LLM hallucinations** - Need citation/evidence tracking
3. **No A/B testing infrastructure** - Can't optimize report format

---

## Code Quality Assessment

### Strengths
- Good TypeScript coverage
- Clean separation (api, db, workers, web, reddit-client)
- Schema is normalized and well-indexed
- Services follow dependency injection pattern
- Zod for validation

### Weaknesses
- Limited error handling (few try/catch blocks)
- No unit tests
- No integration tests
- No E2E tests
- Limited logging/observability
- Comments missing in complex areas (LLM prompts)

---

## Summary: Reusable Assets

✓ API server (Fastify)  
✓ Database schema  
✓ Reddit client  
✓ Discovery service  
✓ Job queue pattern  
✓ Auth system  
✓ Frontend scaffold  

❌ Classification logic (doesn't work)  
❌ Report generation (doesn't exist)  
❌ Report UI (doesn't exist)  
❌ Insights extraction (doesn't exist)  

---

## Next Steps

1. Fix classification pipeline (switch to Claude API)
2. Build clustering from classifications
3. Build report generation engine
4. Build report UI
5. Add observability + error handling
6. Add source abstraction layer
7. Production hardening (secrets, monitoring, cost controls)
8. Launch with manual reports first (prove concept)
