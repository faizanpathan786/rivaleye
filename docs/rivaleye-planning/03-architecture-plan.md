# RivalEye Architecture Plan

**Principles:** Simple, scalable, report-focused, source-agnostic

---

## System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│ WEB (Next.js)                                                       │
│ /report/create → /report/[id] → /report/[id]/export               │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTP
                         ▼
┌────────────────────────────────────────────────────────────────────┐
│ API (Fastify)                                                       │
│ POST /projects (create search)                                      │
│ GET /projects/{id}/report (get report)                              │
│ GET /projects/{id}/evidence (get raw quotes)                        │
│ POST /projects/{id}/export (generate PDF/markdown)                  │
│ POST /auth/* (signup/login)                                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐    ┌──────────┐    ┌──────────────┐
    │Database│    │Job Queue │    │LLM APIs      │
    │(Postgres)   │(Redis)   │    │(Claude API)  │
    └────────┘    └──────────┘    └──────────────┘
                         │
                ┌────────┴────────┐
                │                 │
                ▼                 ▼
        ┌──────────────┐  ┌──────────────┐
        │Workers       │  │Source APIs   │
        │(BullMQ)      │  │(Reddit,etc.) │
        │Processors:   │  │              │
        │1.Ingestion   │  │              │
        │2.Classify    │  │              │
        │3.Cluster     │  │              │
        │4.Report Gen  │  │              │
        └──────────────┘  └──────────────┘
```

---

## Component Details

### Frontend (Web)

**Tech:** Next.js 14 (App Router), TypeScript, Tailwind, Shadcn UI

**Pages:**
```
/                        → Landing (public)
/auth/signup             → Sign up (public)
/auth/login              → Log in (public)
/dashboard               → Project list (protected)
/dashboard/project/[id]  → Create new report
/report/[id]             → View report (main product)
/report/[id]/evidence    → Evidence drawer
/report/[id]/export      → Download options
```

**Key Components:**
- ReportView (renders report sections)
- EvidenceDrawer (shows Reddit quotes + links)
- InsightCard (displays a pain cluster)
- ExportMenu (PDF/markdown download)
- LoadingState (shows progress during analysis)

**State Management:**
- React hooks for local component state
- Fetch API for async data
- Error boundaries for graceful failures
- PWA manifest for offline reading of saved reports (later)

**Performance:**
- Code splitting by page
- Image optimization
- Lazy load evidence drawer
- Cache API responses in localStorage (5 min)

---

### API Server (Fastify)

**Tech:** Fastify, TypeScript, JWT auth, Zod validation

**Route Structure:**

```typescript
// Auth
POST   /auth/signup
POST   /auth/login
POST   /auth/logout
GET    /auth/me

// Projects
POST   /projects                    → Create report request
GET    /projects                    → List user's projects
GET    /projects/{id}               → Get project + status
DELETE /projects/{id}               → Delete project

// Reports
GET    /projects/{id}/report        → Get generated report (JSON)
GET    /projects/{id}/evidence/{evidenceId} → Get single Reddit quote + context
POST   /projects/{id}/export        → Queue report export (PDF/markdown)

// Admin
GET    /admin/jobs/{id}             → Get job status
GET    /admin/health                → Health check
```

**Key Services:**
- `ProjectService` - CRUD projects
- `ReportService` - Generate report from data
- `EvidenceService` - Retrieve Reddit quotes
- `ExportService` - Convert report to PDF/markdown
- `SourceManager` - Interface to source providers

**Auth:**
- JWT token (30 min expiry)
- Refresh token (7 day expiry)
- Workspace isolation (multi-tenant)

**Error Handling:**
- All routes wrapped in try/catch
- Structured error responses (code, message, details)
- Logging for all 5xx errors
- Graceful degradation (return partial data if one source fails)

---

### Database (PostgreSQL + Drizzle)

**Tables:**

```sql
-- Accounts
users
├─ id (PK)
├─ email (unique)
├─ password_hash
├─ name
├─ created_at

workspaces
├─ id (PK)
├─ owner_id (FK users)
├─ name
├─ created_at

-- Core Business
projects (NEW - renamed from competitors)
├─ id (PK)
├─ workspace_id (FK workspaces)
├─ search_query (e.g. "Notion")
├─ status (pending/processing/complete/failed)
├─ source_types [] (e.g. ["reddit", "appstore"])
├─ created_at
├─ completed_at

reports (NEW)
├─ id (PK)
├─ project_id (FK projects)
├─ status (generating/complete)
├─ generated_at
├─ data JSON (full report structure)
├─ created_at

-- Source Data
mentions
├─ id (PK)
├─ project_id (FK projects)
├─ source (reddit/appstore/g2/etc)
├─ external_id (dedup key)
├─ content (text)
├─ author
├─ url
├─ score/rating
├─ posted_at
├─ metadata JSON (source-specific fields)
├─ fetched_at

source_posts_reddit (NEW - optimized for Reddit)
├─ mention_id (FK mentions)
├─ subreddit
├─ post_type (post/comment)
├─ num_comments
├─ permalink

-- Analysis
classifications
├─ id (PK)
├─ mention_id (FK mentions)
├─ sentiment (positive/negative/neutral/mixed)
├─ category (complaint/praise/request/comparison/other)
├─ relevance_score (0-100)
├─ confidence (0-1)
├─ summary
├─ classified_at

clusters
├─ id (PK)
├─ project_id (FK projects)
├─ label (e.g. "Pricing pain for small teams")
├─ category (complaint/request/etc)
├─ sentiment
├─ mention_count
├─ summary
├─ evidence_ids [] (top 3-5 mention IDs)

-- Jobs
ingestion_jobs
├─ id (PK)
├─ project_id (FK projects)
├─ status (pending/running/complete/failed)
├─ mentions_fetched
├─ error
├─ started_at
├─ completed_at

classification_jobs (NEW)
├─ id (PK)
├─ project_id (FK projects)
├─ status (pending/running/complete/failed)
├─ mentions_classified
├─ error
├─ started_at
├─ completed_at

report_generation_jobs (NEW)
├─ id (PK)
├─ project_id (FK projects)
├─ status (pending/running/complete/failed)
├─ error
├─ started_at
├─ completed_at

-- Exports
report_exports (NEW)
├─ id (PK)
├─ report_id (FK reports)
├─ format (pdf/markdown)
├─ status (generating/ready/failed)
├─ file_url (S3/Cloudinary path)
├─ created_at
```

**Indexes:**
- `projects (workspace_id)` - List projects by user
- `mentions (project_id)` - Fetch mentions for project
- `mentions (external_id)` - Deduplication
- `classifications (mention_id)` - 1:1 relationship
- `clusters (project_id)` - Get clusters for report
- `ingestion_jobs (project_id)` - Track progress
- `reports (project_id)` - Get report

**Relationships:**
```
workspace → project → mention → classification → cluster
         → report
         → job (ingestion, classification, report_gen)
         → export
```

**Migration Strategy:**
- Current schema: 9 tables
- New schema: 15 tables (add project, report, exports, job tables)
- Drizzle auto-generates migrations
- Zero-downtime (add tables, keep old for rollback)
- After verification, delete old "competitors" table

---

### Job Queue (BullMQ + Redis)

**Processors:**

```
1. SourceDiscovery
   Input: project {search_query, source_type}
   Output: source_configs {subreddit, search_terms}
   Tool: LLM (Claude) → "What Reddit communities discuss Notion?"

2. Ingestion
   Input: project {source_configs}
   For each source:
   - Fetch posts/comments
   - Normalize + deduplicate
   - Save to mentions table
   Output: mentions_count, job_status
   Tool: Reddit API client

3. Classification
   Input: project_id → fetch unclassified mentions
   For each batch of mentions:
   - Send to Claude API
   - Parse sentiment/category/relevance
   - Save classifications
   Output: classifications_count, job_status
   Tool: Claude API

4. Clustering
   Input: project_id → fetch classifications
   - Group by semantic similarity
   - Generate cluster summaries
   - Save clusters
   Output: clusters_count, job_status
   Tool: LLM (clustering prompts)

5. ReportGeneration
   Input: project_id → fetch clusters + insights
   - Format into report structure
   - Select evidence (best 3-5 quotes per insight)
   - Generate recommendations
   - Save to reports table
   Output: report_json, job_status
   Tool: Report generator service
```

**Queue Configuration:**
```typescript
const queues = {
  'discovery':        { priority: 1, delay: 0 },
  'ingestion':        { priority: 2, delay: 100ms },
  'classification':   { priority: 3, delay: 100ms },
  'clustering':       { priority: 4, delay: 100ms },
  'report-generation': { priority: 5, delay: 100ms },
  'exports':          { priority: 6, delay: 100ms }
}
```

**Retry Strategy:**
```
Job fails →
  1st retry after 5s  (exponential backoff)
  2nd retry after 30s
  3rd retry after 2m
  4th retry after 10m
  5th retry after 1h
  → Dead letter queue (log + alert)
```

**Monitoring:**
- Job processing time (target <30s per job)
- Success rate (target >99%)
- Queue depth (alert if >100 pending)
- Worker health (alert if offline >2min)

---

### LLM Integration

**Current Problem:** Llama 3.1 8B context window too small

**Solution:** Use Claude API (Anthropic)

**Prompts:**

**Discovery Prompt:**
```
You are helping find what Reddit communities discuss a specific product.

Product: {search_query}
Current sources found: {existing_sources}

Task: 
1. Identify 5-10 most relevant subreddits for finding user pain about this product
2. Generate 3-5 search terms that find pain-focused discussions

Return JSON:
{
  "subreddits": ["subreddit1", "subreddit2", ...],
  "search_terms": ["term1", "term2", ...]
}
```

**Classification Prompt:**
```
Classify these Reddit mentions for competitive intelligence.

For each mention, determine:
- sentiment: positive/negative/neutral/mixed
- category: complaint/praise/request/comparison/pricing/ux/support/other
- relevance_score: 0-100 (how relevant to product pain/opportunities)
- confidence: 0-1 (your confidence in this classification)

Input mentions:
[{mention_id, content, context}, ...]

Return JSON array:
[{mention_id, sentiment, category, relevance_score, confidence}, ...]
```

**Clustering Prompt:**
```
Group these Reddit complaints into themes.

You have {count} classified mentions about {product}.

Task:
1. Identify 4-8 major themes/clusters
2. For each theme:
   - Come up with a clear label (e.g. "Pricing forced small teams away")
   - List the 3 most representative mention IDs
   - Rate sentiment (mostly positive/negative)

Return JSON:
{
  "clusters": [{
    "label": "...",
    "mention_ids": ["id1", "id2", "id3"],
    "sentiment": "negative"
  }, ...]
}
```

**Report Generation Prompt:**
```
Convert these insights into a founder-friendly competitive report.

Data:
- Product: {product_name}
- Mentions analyzed: {count}
- Top clusters: {cluster_summaries}

Task:
1. Write 2-3 sentence executive summary
2. Identify top 3 pain themes with evidence counts
3. List feature requests (if any)
4. Suggest 2-3 positioning opportunities

Return JSON:
{
  "summary": "...",
  "painThemes": [...],
  "featureRequests": [...],
  "opportunities": [...]
}
```

**Cost Control:**
- Set API token budget: $50/month max (dev), $500/month (production)
- Log all LLM calls with token count
- Alert if monthly spend >20% over budget
- Batch requests (classify 5-10 mentions per call, not 1)

---

### Source Abstraction Layer

**Goal:** Make it easy to add Reddit, AppStore, G2, Twitter, etc.

**Interface:**

```typescript
interface SourceProvider {
  // Config
  id: string  // 'reddit', 'appstore', 'g2'
  name: string
  maxMentionsPerRequest: number
  
  // Operations
  discoverSources(query: string): Promise<SourceConfig[]>
  // Returns: [{type: 'subreddit', value: 'IndiaInvestments'}, ...]
  
  search(config: SourceConfig, terms: string[]): Promise<Mention[]>
  // Returns: [{ content, author, score, url, timestamp }, ...]
  
  fetchMentions(config: SourceConfig, limit: number): Promise<Mention[]>
  // Returns: [{ content, author, score, url, timestamp }, ...]
  
  normalize(raw: any): Mention
  // Convert source-specific format to common Mention shape
}

class RedditProvider implements SourceProvider {
  // Current implementation
}

class AppStoreProvider implements SourceProvider {
  // Future implementation
}

class G2Provider implements SourceProvider {
  // Future implementation
}
```

**Registry:**
```typescript
const sourceRegistry = {
  reddit: new RedditProvider(),
  appstore: new AppStoreProvider(),
  g2: new G2Provider(),
  // ... more sources
}

// In discovery service
const sources = await sourceRegistry[sourceType].discoverSources(query)
```

---

### Error Handling

**Levels:**

1. **Route level** (API)
   ```typescript
   app.post('/projects', async (req, res) => {
     try {
       const validated = createProjectSchema.parse(req.body)
       const project = await projectService.create(...)
       return { success: true, data: project }
     } catch (e) {
       logger.error('Project creation failed', { error: e, userId: req.user.id })
       return { success: false, code: 'PROJECT_CREATE_FAILED', message: e.message }
     }
   })
   ```

2. **Service level** (Business logic)
   ```typescript
   async create(query, userId) {
     // Validate input
     if (!query || query.length < 2) {
       throw new ValidationError('Query too short')
     }
     
     // Create project
     const project = await db.insert(projects).values({...})
     
     // Queue jobs
     try {
       await enqueueDiscovery(project.id)
     } catch (e) {
       // Log but don't fail - discovery is async
       logger.warn('Discovery enqueue failed', { projectId: project.id })
     }
     
     return project
   }
   ```

3. **Job level** (Workers)
   ```typescript
   processor.process(async (job) => {
     try {
       const mentions = await reddit.search(...)
       await db.insert(mentions).values(...)
       return { success: true, count: mentions.length }
     } catch (e) {
       logger.error('Ingestion failed', { projectId: job.data.projectId, error: e })
       job.moveToFailed(new Error(e.message), true) // Retry
     }
   })
   ```

**Error Categories:**
- Validation errors → 400 (user's fault, don't retry)
- API errors (Reddit rate limit) → 429 (throttle, retry later)
- LLM errors (context limit) → 500 (log, retry with fallback)
- Database errors → 500 (log, alert ops)

---

### Rate Limiting & Cost Control

**Reddit API:**
- Limit: 60 requests/min per IP
- Current client: Respects via rate-limiter module ✓
- No additional work needed

**Claude API:**
- Limit: Rate depends on plan (start with free, $5/mo free tier)
- Strategy: Batch 5-10 mentions per request (not 1)
- Cost: ~$0.50-1 per report (estimate: 5k input tokens, 500 output tokens)
- Budget: $500/month max (1000 reports)

**API Server:**
- Fastify rate limiting: 100 req/min per IP (default)
- Per-user limits later (if needed)

---

### Observability & Monitoring

**Logging:**
```typescript
// Structured logging (Pino)
logger.info('Project created', {
  projectId,
  userId,
  searchQuery,
  duration: Date.now() - start
})

logger.error('Classification failed', {
  projectId,
  mentionCount,
  error: e.message,
  stack: e.stack
})
```

**Metrics:**
- Job processing time (histogram)
- Job success rate (counter)
- Queue depth (gauge)
- API response time (histogram)
- LLM token usage (counter)

**Alerts:**
- If job failure rate >5%, page oncall
- If queue depth >100, page oncall
- If API p95 latency >5s, warn in Slack
- If monthly LLM spend >$250, email

**Health Check:**
```typescript
GET /health → {
  status: 'healthy',
  database: 'ok',
  redis: 'ok',
  llm: 'ok',
  timestamp: now
}
```

---

### Deployment & Environment Config

**Environments:**

```
Development (localhost):
- DATABASE_URL=postgres://localhost/rivaleye_dev
- REDIS_URL=redis://localhost:6379
- ANTHROPIC_API_KEY=sk-... (local test key)
- NODE_ENV=development

Staging (Vercel + Railway):
- DATABASE_URL=postgresql://... (staging DB)
- REDIS_URL=redis://... (staging Redis)
- ANTHROPIC_API_KEY=sk-... (test key with limit)
- NODE_ENV=staging

Production (Vercel + Supabase + Upstash):
- DATABASE_URL=postgresql://... (production DB)
- REDIS_URL=redis://... (production Redis)
- ANTHROPIC_API_KEY=sk-... (production key)
- NODE_ENV=production
```

**Secrets Management:**
- Dev: .env.local (not in git) ✓
- Staging: Vercel env vars + Railway env vars
- Production: Vercel + Supabase secrets manager
- Rotation: Every 90 days

**Database Backups:**
- Supabase auto-backups: daily + 7-day retention ✓
- Test restore: monthly

**Deployment Pipeline:**
```
Git push to main
  ↓
GitHub Actions: build + test
  ↓
Merge to staging
  ↓
Deploy to Vercel + Railway (staging)
  ↓
Manual QA testing
  ↓
Merge to production
  ↓
Deploy to Vercel + Railway (production)
```

---

## Summary: What to Build vs What Exists

### Exists (Reuse As-Is)
- Fastify API skeleton ✓
- Database schema ✓
- Reddit client ✓
- Discovery service (LLM) ✓
- Job queue architecture ✓
- Frontend scaffold ✓
- Auth system ✓

### Needs Major Fix
- Classification pipeline (switch to Claude API, fix batching)
- Clustering pipeline (finish + test)

### Needs to Be Built
- Report generation service
- Report UI components
- Evidence drawer UI
- Export service (PDF/markdown)
- Source abstraction layer
- Project CRUD (rename competitors → projects)
- New job queue processors
- Observability (logging, metrics)
- Production hardening

### Can Wait (Post-MVP)
- Multiple sources (AppStore, G2, etc.)
- Custom report builder
- Team collaboration
- API integrations
- Mobile app
