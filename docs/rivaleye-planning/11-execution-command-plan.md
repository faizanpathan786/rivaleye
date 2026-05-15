# RivalEye Execution Command Plan

**Objective:** Fastest path from competitor name → useful founder report  
**Timeline:** 5-6 weeks for production-ready MVP  
**Team:** Optimized for 1-3 engineers working in parallel  
**Starting point:** Today (May 12, 2026)  
**Target launch:** May 2026

---

## Parallel Track Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Fix Foundation (Week 1)                                    │
│ ┌─────────────┬──────────────┬──────────────┬─────────────────────┐ │
│ │ Track C.1   │ Track D.1    │ Track A.1    │ Track B (already ok)│ │
│ │ Switch LLM  │ Schema prep  │ API prep     │                     │ │
│ └─────────────┴──────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: End-to-End Report (Week 2-3)                               │
│ ┌──────────────┬──────────────┬──────────────┬─────────────────────┐ │
│ │ Track C.2-.3 │ Track D.2-3  │ Track A.2-3  │ Track E.1 (basic)   │ │
│ │ Classification│ Schema apply │ Report API   │ Report page         │ │
│ │ Clustering   │ Migrations   │ Evidence API │                     │ │
│ │ Report gen   │ Job tables   │              │                     │ │
│ └──────────────┴──────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Quality & Polish (Week 3-4)                                │
│ ┌──────────────┬──────────────┬──────────────┬─────────────────────┐ │
│ │ Track C.4    │ Track E.2-3  │ Track A.4    │ Track F.1-2         │ │
│ │ Better prompts│ Evidence    │ Export API   │ Secrets + Logging   │ │
│ │ Evidence sel │ drawer       │ Project CRUD │                     │ │
│ │              │ Export menu  │              │                     │ │
│ └──────────────┴──────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 4: UI Complete & Mobile (Week 4)                              │
│ ┌──────────────┬──────────────┬──────────────┬─────────────────────┐ │
│ │ Track E.4-5  │ Track A.5    │ Track F.3    │ Track F.4           │ │
│ │ Dashboard    │ Create form  │ Monitoring   │ Error handling      │ │
│ │ Loading state│              │ Health check │                     │ │
│ │ Mobile       │              │              │                     │ │
│ └──────────────┴──────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 5: Production + Payment (Week 4-5)                            │
│ ┌──────────────┬──────────────┬──────────────┬─────────────────────┐ │
│ │ Track F.5    │ Track A.6    │ Track F.6-7  │ Track G.1           │ │
│ │ Stripe setup │ Payment flow │ Env + Redis  │ Landing page        │ │
│ │              │              │ DB + backups │                     │ │
│ └──────────────┴──────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 6: Deploy & Launch (Week 5-6)                                 │
│ ┌──────────────┬──────────────┬──────────────┬─────────────────────┐ │
│ │ All tracks   │ Production   │ Monitoring   │ GTM.2-3             │ │
│ │ Final tests  │ deployment   │ Alerts       │ Beta outreach       │ │
│ │              │              │              │ Sample reports      │ │
│ └──────────────┴──────────────┴──────────────┴─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Track A: Backend API

**Goal:** API endpoints for projects, reports, evidence, exports  
**Owner:** Backend engineer  
**Can start:** Week 1  
**Dependencies:** Track D (schema), Track C (report data available)

### A.1: Rename Competitors → Projects (Week 1)

**Goal:** Update API to use "projects" terminology  
**Tasks in order:**

1. Understand current CompetitorService code
2. Create/plan projects table schema (in Track D)
3. Rename CompetitorService → ProjectService
4. Update routes: /competitors → /projects
5. Add search_query field to project
6. Update all references in API

**Files to change:**

- `packages/api/src/services/competitor.service.ts` → `project.service.ts`
- `packages/api/src/routes/competitors.ts` → `projects.ts`
- `packages/api/src/app.ts` (route registration)
- `packages/api/src/index.ts` (imports)

**Dependencies:** Wait for D.1 (schema design)

**Acceptance criteria:**

- [ ] All CRUD operations still work
- [ ] No broken imports
- [ ] API tests pass (if exist)
- [ ] Can create/get/list/update/delete projects
- [ ] search_query field populated
- [ ] No reference to "competitor" in API surface

**Testing:**

- POST /projects → creates project ✓
- GET /projects → lists user's projects ✓
- GET /projects/{id} → returns project ✓
- PUT /projects/{id} → updates ✓
- DELETE /projects/{id} → deletes ✓

### A.2: Add Report API Endpoints (Week 2)

**Goal:** Retrieve generated reports and evidence  
**Tasks in order:**

1. Design report response structure
2. Add GET /projects/{id}/report endpoint
3. Add GET /projects/{id}/evidence/{mentionId} endpoint
4. Add caching (5 min in memory or Redis)
5. Add error handling for missing reports

**Files to change:**

- `packages/api/src/routes/reports.ts` (new)
- `packages/api/src/app.ts` (register route)

**Dependencies:** D.2 (reports table exists)

**Acceptance criteria:**

- [ ] GET /projects/{id}/report returns valid JSON
- [ ] Evidence endpoint returns Reddit quote + context
- [ ] 404 if report not found
- [ ] Response time <500ms
- [ ] Caching works (2nd request faster)

**Testing:**

- Fetch report after generation ✓
- Evidence shows correct quote + link ✓
- Cache hit verification ✓

### A.3: Add Evidence Extraction (Week 2)

**Goal:** Pull top evidence snippets from mentions for report  
**Tasks in order:**

1. Build EvidenceService class
2. Select top 3-5 mentions per cluster by score
3. Trim content to 200 chars, add ellipsis
4. Include source (subreddit, score, author)
5. Include URL (Reddit permalink)

**Files to change:**

- `packages/api/src/services/evidence.service.ts` (new)

**Dependencies:** C.3 (clustering complete)

**Acceptance criteria:**

- [ ] Evidence snippets < 200 chars
- [ ] Reddit URLs correct
- [ ] Scored by relevance + engagement
- [ ] No duplicates

### A.4: Add Export API Endpoint (Week 3)

**Goal:** Queue report export (PDF/Markdown/JSON)  
**Tasks in order:**

1. Create ExportService class
2. Add POST /projects/{id}/export endpoint
3. Accept format parameter (pdf | markdown | json)
4. Queue export job
5. Return job ID + status endpoint
6. Implement export processors (in separate track)

**Files to change:**

- `packages/api/src/services/export.service.ts` (new)
- `packages/api/src/routes/exports.ts` (new)
- `packages/api/src/queues.ts` (add export queue)

**Dependencies:** A.2 (report endpoint), C.4 (report generation complete)

**Acceptance criteria:**

- [ ] Can queue export with format
- [ ] Returns job ID
- [ ] Status endpoint works
- [ ] Frontend can poll for completion

**Testing:**

- POST /projects/{id}/export with format ✓
- Job queued successfully ✓
- Status endpoint returns progress ✓

### A.5: Add Create Report Form Handler (Week 4)

**Goal:** Handle form submission from frontend  
**Tasks in order:**

1. Create POST /projects endpoint handler
2. Validate search_query (length, format)
3. Create project in DB
4. Queue discovery job
5. Return project ID immediately (async)
6. Return status endpoint for polling

**Files to change:**

- `packages/api/src/routes/projects.ts` (enhance POST)

**Dependencies:** D.1 (projects table), Track C.1 (discovery job exists)

**Acceptance criteria:**

- [ ] Form submission queues job
- [ ] Returns project ID within 100ms
- [ ] Discovery job starts automatically
- [ ] Status can be polled

**Testing:**

- Create report request ✓
- Returns immediately ✓
- Job queued in background ✓
- Status endpoint shows progress ✓

### A.6: Add Payment Webhook Handler (Week 5)

**Goal:** Mark project as paid when Stripe payment succeeds  
**Tasks in order:**

1. Create POST /webhooks/stripe endpoint
2. Verify webhook signature
3. Update project.status = "paid"
4. Send receipt email
5. Log transaction

**Files to change:**

- `packages/api/src/routes/webhooks.ts` (new)
- `packages/api/src/services/payment.service.ts` (new)

**Dependencies:** F.5 (Stripe account setup)

**Acceptance criteria:**

- [ ] Webhook signature verified
- [ ] Project marked paid correctly
- [ ] Email sent
- [ ] No duplicate processing

**Testing:**

- Webhook received ✓
- Project marked paid ✓
- Email sent ✓

### A.6b: Add Sync/Regenerate Endpoint (Later, P1)

**Goal:** Allow users to re-run analysis  
**Tasks:** (Post-MVP)

---

## Track B: Reddit Ingestion

**Goal:** Reliable collection of 500+ Reddit mentions per competitor  
**Owner:** Can be same as Track C (LLM logic is integrated)  
**Can start:** Week 1 (mostly parallel)  
**Dependencies:** None critical (works already)

### B.1: Enhance Source Discovery (Week 1-2)

**Goal:** Improve subreddit + search term selection via LLM  
**Tasks in order:**

1. Refine discovery LLM prompt (clearer instructions)
2. Test with 5 competitors
3. Validate subreddit names (check Reddit exists)
4. Add error handling for private subreddits
5. Improve search term generation

**Files to change:**

- `packages/api/src/services/discovery.service.ts` (enhance prompt)
- `packages/reddit-client/src/client.ts` (add subreddit validation)

**Dependencies:** C.1 (Claude API)

**Acceptance criteria:**

- [ ] Subreddit list is relevant
- [ ] Search terms find pain-focused discussions
- [ ] No private subreddits in results
- [ ] 5+ subreddits per competitor

**Testing:**

- Run discovery on 5 test competitors ✓
- Verify subreddit names valid ✓
- Spot-check search results ✓

### B.2: Add Source Config Table (Week 1-2, with Track D)

**Goal:** Store discovered Reddit sources per competitor  
**Tasks in order:**

1. Create source_configs table (generic, not Reddit-specific)
2. Store subreddit + search_terms JSON
3. Add index on project_id + source_type
4. Save discovery results to table

**Files to change:**

- `packages/db/src/schema/source-configs.ts` (new, or enhance reddit-sources)

**Dependencies:** D.1 (schema planning)

**Acceptance criteria:**

- [ ] Source configs saved
- [ ] Can retrieve by project
- [ ] Supports both subreddit and search terms

### B.3: Optimize Collection Volume (Week 2-3)

**Goal:** Ensure 500+ mentions per competitor reliably  
**Tasks in order:**

1. Test current ingestion with 5 competitors
2. Measure mention count per subreddit
3. If <500: Add more subreddits or search terms
4. If >1500: Filter to top 1500 by score
5. Tune noise filtering thresholds

**Files to change:**

- `packages/workers/src/processors/ingestion.processor.ts` (tune)

**Dependencies:** B.1, B.2, current working ingestion

**Acceptance criteria:**

- [ ] 500-1000 mentions per competitor consistently
- [ ] <20% are noise/spam
- [ ] Execution time <2 min

**Testing:**

- Ingest 5 competitors ✓
- Check mention counts ✓
- Spot-check for quality ✓

**Note:** Track B is mostly ready. Focus is on enhancement and tuning, not building from scratch.

---

## Track C: AI Analysis & Report Generation

**Goal:** Convert Reddit mentions → classified, clustered, report-ready data  
**Owner:** Backend engineer  
**Can start:** Week 1 (CRITICAL PATH)  
**Dependencies:** None, but blocks everything else

### C.1: Switch from Llama to Claude API (Week 1, DAY 1-2)

**CRITICAL:** This unblocks the entire pipeline  
**Goal:** Use Claude API instead of broken Llama 3.1 8B  
**Tasks in order:**

1. Remove Groq configuration
2. Update discovery service to use Claude API
3. Test discovery with 3 competitors
4. Verify JSON parsing
5. Monitor token usage

**Files to change:**

- `packages/api/src/services/discovery.service.ts` (enhance)
- `packages/workers/src/llm/discovery.ts` (if separate)
- `.env.example` (remove Groq keys)
- `.env.local` (add ANTHROPIC_API_KEY if not present)

**Dependencies:** None

**Acceptance criteria:**

- [ ] Discovery calls Claude successfully
- [ ] Returns valid JSON (subreddits + search terms)
- [ ] Token usage logged
- [ ] Cost tracking shows $0.001-0.003 per call

**Testing:**

- Test discovery on 3 competitors ✓
- Verify subreddit relevance ✓
- Check token count logged ✓

**Timeline:** Must complete FIRST, before any other C tasks

---

### C.2: Build Batch Classification (Week 2, after C.1)

**Goal:** Classify 500+ mentions using Claude in 50-mention batches  
**Tasks in order:**

1. Build classification prompt
2. Split mentions into batches of 50
3. Call Claude for each batch
4. Parse JSON response
5. Handle batch failures gracefully
6. Map responses back to mention IDs
7. Save classifications to DB

**Files to change:**

- `packages/workers/src/processors/classification.processor.ts` (major rewrite)
- `packages/workers/src/llm/classification.ts` (new)
- `packages/api/src/services/classification.service.ts` (new)

**Dependencies:** C.1 (Claude working), D.2 (classifications table)

**Acceptance criteria:**

- [ ] Classifies 500 mentions in <3 min
- [ ] 99%+ mention IDs correct
- [ ] Batch retries work
- [ ] Failed batches don't crash job
- [ ] All 5 fields present (sentiment, category, relevance, confidence, summary)

**Testing:**

- Classify 500 test mentions ✓
- Verify JSON parsing ✓
- Check all fields populated ✓
- Spot-check accuracy (5-10 random samples) ✓

### C.3: Implement Clustering (Week 2-3, after C.2)

**Goal:** Group classified mentions into 8-12 pain themes  
**Tasks in order:**

1. Fetch classified mentions by project
2. Group by category initially
3. Within each category, cluster by semantic similarity
4. Generate cluster summaries via LLM
5. Calculate cluster strength (by mention count + sentiment)
6. Save clusters to DB
7. Limit to top 12 clusters

**Files to change:**

- `packages/workers/src/processors/clustering.processor.ts` (enhance)
- `packages/workers/src/llm/clustering.ts` (new, if separate)

**Dependencies:** C.2 (classifications complete), D.2 (clusters table)

**Acceptance criteria:**

- [ ] 8-12 clusters created per competitor
- [ ] Clusters are thematically coherent
- [ ] Summaries are 1-2 sentences
- [ ] Mention counts accurate
- [ ] Top clusters ranked by strength

**Testing:**

- Cluster 5 test competitors ✓
- Verify coherence of clusters ✓
- Spot-check summaries ✓

### C.4: Build Report Generation (Week 3, after C.3)

**Goal:** Convert clusters → founder-friendly report structure  
**Tasks in order:**

1. Create ReportService class
2. Generate executive summary (LLM)
3. Extract pain themes (top 5)
4. Extract feature requests
5. Generate positioning opportunities (LLM)
6. Generate validation steps
7. Compile report JSON
8. Save to reports table

**Files to change:**

- `packages/api/src/services/report.service.ts` (new)
- `packages/workers/src/processors/report-generation.processor.ts` (new)

**Dependencies:** C.3 (clusters complete), D.2 (reports table)

**Acceptance criteria:**

- [ ] Report JSON well-formed
- [ ] Summary 2-3 sentences, clear
- [ ] Pain themes have evidence quotes
- [ ] Opportunities are actionable
- [ ] Validation steps specific

**Testing:**

- Generate 3 test reports ✓
- Verify JSON structure ✓
- Read reports for sense-check ✓

**Manually verify:** Read actual reports and confirm they are "brutally useful"

### C.5: Implement Prompt Engineering (Week 3-4)

**Goal:** Improve report quality through better LLM prompts  
**Tasks in order:**

1. Test discovery prompt with 10 competitors
2. Refine based on results
3. Test classification prompt with 100+ mentions
4. Add few-shot examples if needed
5. Test report generation prompt with 5 reports
6. Document prompts + reasoning

**Files to change:**

- `packages/workers/src/llm/*.ts` (all prompt files)

**Dependencies:** C.1, C.2, C.3, C.4

**Acceptance criteria:**

- [ ] Discovery finds relevant subreddits
- [ ] Classification accuracy >80% (spot check)
- [ ] Reports are actionable
- [ ] Prompts documented

**Testing:**

- A/B test old vs new prompts (if time)
- User feedback on report quality ✓

---

## Track D: Database & Job Queue

**Goal:** Schema for projects, reports, jobs; reliable queue execution  
**Owner:** Database/DevOps engineer  
**Can start:** Week 1 (parallel)  
**Dependencies:** None critical

### D.1: Plan Schema Migration (Week 1)

**Goal:** Design "competitors → projects" migration strategy  
**Tasks in order:**

1. Review current competitors table
2. Design new projects table (with search_query)
3. Plan source_configs table (generic for Reddit/AppStore/G2)
4. Design reports table (with JSONB)
5. Design job tracking tables (classification, report-gen)
6. Write migration plan document
7. Identify rollback strategy

**Files to change:**

- `packages/db/src/schema/` (plan new files)
- Design document (internal planning)

**Dependencies:** None

**Acceptance criteria:**

- [ ] Schema supports MVP requirements
- [ ] Backward compatible (can rollback)
- [ ] Proper indexes planned
- [ ] No data loss risk

**No code yet, just planning.**

### D.2: Create New Schema Files (Week 1-2)

**Goal:** Add new tables using Drizzle  
**Tasks in order:**

1. Create projects.ts (with search_query, status, source_types)
2. Create source-configs.ts (generic for any source)
3. Create reports.ts (with report_data JSONB)
4. Create classification-jobs.ts table
5. Create report-generation-jobs.ts table
6. Create report-exports.ts table
7. Add all to index.ts
8. Generate Drizzle migration files

**Files to change:**

- `packages/db/src/schema/projects.ts` (new)
- `packages/db/src/schema/source-configs.ts` (new)
- `packages/db/src/schema/reports.ts` (new)
- `packages/db/src/schema/classification-jobs.ts` (new)
- `packages/db/src/schema/report-generation-jobs.ts` (new)
- `packages/db/src/schema/report-exports.ts` (new)
- `packages/db/src/schema/index.ts` (update exports)

**Dependencies:** D.1 (plan complete)

**Acceptance criteria:**

- [ ] All tables created with Drizzle
- [ ] Migrations generated
- [ ] No schema conflicts
- [ ] Indexes defined

### D.3: Apply Migrations to Dev Database (Week 1-2)

**Goal:** Test migrations on development database  
**Tasks in order:**

1. Backup dev database
2. Run migrations
3. Verify all tables exist
4. Verify data integrity (if migrating from old tables)
5. Test rollback

**Files to change:** (None, just operations)

**Dependencies:** D.2 (migrations exist)

**Acceptance criteria:**

- [ ] Migrations run successfully
- [ ] All tables visible
- [ ] Rollback works
- [ ] No data loss

### D.4: Add Job Enqueuing (Week 2)

**Goal:** Queue classification and report generation jobs  
**Tasks in order:**

1. Add enqueueClassification function
2. Add enqueueReportGeneration function
3. Call from ingestion processor (after mentions saved)
4. Job data includes project_id
5. Retry policy: exponential backoff

**Files to change:**

- `packages/api/src/queues.ts` (enhance)
- `packages/workers/src/index.ts` (add processor registration)

**Dependencies:** D.2 (job tables exist)

**Acceptance criteria:**

- [ ] Jobs enqueued successfully
- [ ] Job status trackable
- [ ] Retries work

---

## Track E: Frontend & Report UI

**Goal:** Beautiful report page + supporting pages  
**Owner:** Frontend engineer  
**Can start:** Week 2 (after C.2, so data available)  
**Dependencies:** A.2 (report API), C.4 (report generation complete)

### E.1: Build Report Page (Week 2)

**Goal:** Display report with sections + evidence  
**Tasks in order:**

1. Create /report/{id} page component
2. Fetch report JSON from API
3. Display Executive Summary section
4. Display Pain Themes section (expandable)
5. Display Feature Requests
6. Display Opportunities section
7. Display Validation Recommendations
8. Add typography + spacing (beautiful layout)
9. Test on desktop

**Files to change:**

- `packages/web/src/app/report/[id]/page.tsx` (new)
- `packages/web/src/components/report/ReportView.tsx` (new)
- `packages/web/src/components/report/PainThemeCard.tsx` (new)

**Dependencies:** A.2 (API endpoint), C.4 (report data)

**Acceptance criteria:**

- [ ] Report renders without errors
- [ ] All sections visible
- [ ] Typography clear + readable
- [ ] Evidence shows quotes + links
- [ ] No layout issues

**Testing:**

- Load report page ✓
- Verify all sections render ✓
- Click links (verify Reddit URLs correct) ✓

### E.2: Build Evidence Drawer (Week 3)

**Goal:** Expandable section showing Reddit quotes  
**Tasks in order:**

1. Create EvidenceDrawer component
2. Show "View Evidence" button per theme
3. Expand to show 3-5 quotes
4. Display subreddit + score + author
5. Display Reddit permalink
6. Add "Copy Quote" button
7. Add "View on Reddit" button

**Files to change:**

- `packages/web/src/components/report/EvidenceDrawer.tsx` (new)

**Dependencies:** A.3 (evidence API), E.1 (report page)

**Acceptance criteria:**

- [ ] Drawer opens/closes smoothly
- [ ] Evidence displays correctly
- [ ] Copy button works
- [ ] Links are correct

**Testing:**

- Click Evidence button ✓
- Copy quote ✓
- Verify Reddit links ✓

### E.3: Build Export Menu (Week 3)

**Goal:** Download report as PDF/Markdown/Copy  
**Tasks in order:**

1. Create ExportMenu component
2. Add PDF download button
3. Add Markdown download button
4. Add Copy-to-Clipboard button
5. Show loading state while generating
6. Handle errors gracefully

**Files to change:**

- `packages/web/src/components/report/ExportMenu.tsx` (new)

**Dependencies:** A.4 (export API)

**Acceptance criteria:**

- [ ] PDF downloads successfully
- [ ] Markdown downloads successfully
- [ ] Copy works
- [ ] Loading state visible

**Testing:**

- Download PDF ✓
- Download Markdown ✓
- Copy to clipboard ✓

### E.4: Build Dashboard (Week 4)

**Goal:** List of user's past reports  
**Tasks in order:**

1. Create dashboard page
2. Fetch projects list from API
3. Display as cards or table
4. Show: date, mention count, status
5. Add "View" button (links to report)
6. Add "Delete" button
7. Add "New Report" button (prominent)
8. Responsive grid layout

**Files to change:**

- `packages/web/src/app/dashboard/page.tsx` (enhance)
- `packages/web/src/components/ProjectCard.tsx` (new if card-based)

**Dependencies:** A.2 (projects endpoint)

**Acceptance criteria:**

- [ ] Lists all projects
- [ ] Can click to view
- [ ] Can delete
- [ ] Responsive design

**Testing:**

- Create multiple reports ✓
- Dashboard shows all ✓
- Delete works ✓

### E.5: Build Create Form & Loading (Week 4)

**Goal:** Entry point + progress indicator  
**Tasks in order:**

1. Create /dashboard/new page
2. Build form: search_query input
3. Add category dropdown (optional)
4. Submit button
5. After submit: show loading state
6. Poll for job progress (every 5s)
7. Show step-by-step progress
8. Auto-redirect to report when complete
9. Handle errors

**Files to change:**

- `packages/web/src/app/dashboard/new/page.tsx` (new)
- `packages/web/src/components/CreateReportForm.tsx` (new)
- `packages/web/src/components/ReportLoadingState.tsx` (new)

**Dependencies:** A.5 (create endpoint)

**Acceptance criteria:**

- [ ] Form submits successfully
- [ ] Loading state shows progress
- [ ] Auto-redirects to report
- [ ] Error handling works

**Testing:**

- Create report ✓
- Watch progress indicator ✓
- Verify redirect ✓

### E.6: Mobile Responsiveness (Week 4)

**Goal:** Report readable on phone  
**Tasks in order:**

1. Test report page on mobile (Chrome DevTools)
2. Fix layout for <600px width
3. Adjust font sizes
4. Ensure buttons are touch-friendly
5. Test on actual phone (if possible)

**Files to change:**

- CSS/Tailwind classes in all E components

**Dependencies:** E.1-5

**Acceptance criteria:**

- [ ] Readable on mobile
- [ ] No horizontal scroll
- [ ] Buttons clickable (44px+ height)

---

## Track F: Production Readiness

**Goal:** Secure, monitorable, reliable system  
**Owner:** DevOps/Backend engineer  
**Can start:** Week 3 (in parallel), deploy at Week 5  
**Dependencies:** All other tracks (for holistic setup)

### F.1: Secrets Management (Week 3)

**Goal:** No secrets in git, all in env vars  
**Tasks in order:**

1. Remove any hardcoded secrets
2. Verify .env.local in .gitignore
3. Create .env.example with placeholders only
4. Document which secrets go where
5. Set up Vercel environment variables (staging + prod)
6. Set up Railway environment variables
7. Test that app boots with env vars

**Files to change:**

- `.env.example` (update)
- `packages/api/.env.example` (if separate)
- Documentation (internal)

**Dependencies:** None

**Acceptance criteria:**

- [ ] No secrets in git history
- [ ] App boots in staging with env vars
- [ ] App boots in production with env vars
- [ ] All required secrets present

### F.2: Logging Setup (Week 3)

**Goal:** Structured JSON logging for debugging  
**Tasks in order:**

1. Configure Pino for JSON output
2. Add request ID logging
3. Log all API requests (INFO level)
4. Log all errors (ERROR level)
5. Log job events (INFO level)
6. Add context to logs (userId, projectId, etc.)
7. Test log output format

**Files to change:**

- `packages/api/src/logger.ts` (enhance or new)
- `packages/api/src/app.ts` (middleware)

**Dependencies:** None

**Acceptance criteria:**

- [ ] Logs in JSON format
- [ ] Can grep/filter logs
- [ ] All errors logged
- [ ] Context present

### F.3: Health Check Endpoint (Week 3)

**Goal:** Know when things are broken  
**Tasks in order:**

1. Create GET /health endpoint
2. Check database connectivity
3. Check Redis connectivity
4. Check Claude API reachability
5. Return status + details
6. Return 200 if all good, 503 if degraded

**Files to change:**

- `packages/api/src/routes/health.ts` (new)

**Dependencies:** None

**Acceptance criteria:**

- [ ] Endpoint responds
- [ ] Returns correct status
- [ ] All checks work

### F.4: Error Handling (Week 3-4)

**Goal:** Graceful failures, not 500s  
**Tasks in order:**

1. Wrap all API routes in try/catch
2. Log errors with full context
3. Return user-friendly error messages (no stack traces)
4. Distinguish: 400 (user error) vs 500 (server error)
5. Rate limit errors (too many requests → 429)
6. Handle missing reports → 404
7. Handle LLM timeouts → return partial data or queue retry

**Files to change:**

- `packages/api/src/routes/*.ts` (all routes)
- `packages/api/src/middleware/error-handler.ts` (new if centralized)

**Dependencies:** F.2 (logging)

**Acceptance criteria:**

- [ ] No unhandled errors
- [ ] Error messages clear
- [ ] Errors logged with context
- [ ] Rate limiting works

### F.5: Stripe Integration (Week 4-5)

**Goal:** Payment processing for paid reports  
**Tasks in order:**

1. Create Stripe account
2. Install Stripe package
3. Create checkout session endpoint
4. Handle Stripe webhooks
5. Mark project as paid on success
6. Send receipt email
7. Test with Stripe test cards

**Files to change:**

- `packages/api/src/services/stripe.service.ts` (new)
- `packages/api/src/routes/payments.ts` (new)
- `packages/api/src/routes/webhooks.ts` (enhance)

**Dependencies:** A.6 (payment endpoint)

**Acceptance criteria:**

- [ ] Can create Stripe session
- [ ] Payment processes
- [ ] Webhook received
- [ ] Project marked paid
- [ ] Email sent

### F.6: Production Environment (Week 4-5)

**Goal:** Set up production database, Redis, monitoring  
**Tasks in order:**

1. Create Supabase project (production)
2. Create Upstash Redis (production)
3. Configure backups (daily)
4. Test backup restore
5. Set DATABASE_URL + REDIS_URL
6. Document recovery procedure
7. Set up basic monitoring/alerts

**Files to change:** (None, operations only)

**Dependencies:** All other tracks (for schema)

**Acceptance criteria:**

- [ ] Production DB accessible
- [ ] Redis accessible
- [ ] Backups configured
- [ ] Restore tested

### F.7: Deployment Pipeline (Week 5)

**Goal:** Safe deployments with rollback capability  
**Tasks in order:**

1. Set up Vercel for web (auto-deploy main branch)
2. Set up Railway for API (auto-deploy main branch)
3. Test deployment on staging first
4. Document rollback procedure
5. Create smoke test script
6. Run smoke test post-deploy

**Files to change:**

- `vercel.json` (if custom config)
- `railway.json` (if custom config)
- Deployment docs (internal)

**Dependencies:** All other tracks + F.1-6

**Acceptance criteria:**

- [ ] Deployments happen automatically
- [ ] Smoke tests pass
- [ ] Can rollback if needed
- [ ] Zero downtime

---

## Track G: Go-to-Market & Launch

**Goal:** Users signing up, paying for reports  
**Owner:** Growth/Operations (can be same as backend if solo)  
**Can start:** Week 4 (pre-launch prep)  
**Dependencies:** All product tracks complete

### G.1: Landing Page (Week 4-5)

**Goal:** Sell the product  
**Tasks in order:**

1. Write headline + subheadline
2. Describe problem (what users currently do)
3. Describe solution (what RivalEye does)
4. Show sample report (beautiful mockup or real report)
5. Add signup CTA
6. Add testimonials section (populate after beta)
7. Design + build with Next.js
8. Mobile responsive

**Files to change:**

- `packages/web/src/app/page.tsx` (enhance)
- New landing page sections/components

**Dependencies:** E.1 (so we have a real report to show)

**Acceptance criteria:**

- [ ] Compelling copy
- [ ] Sample report visible
- [ ] CTAs prominent
- [ ] Mobile friendly

### G.2: Privacy Policy & Terms (Week 4-5)

**Goal:** Legal compliance  
**Tasks in order:**

1. Write privacy policy (data collection, usage, retention)
2. Write terms of service (payment, user obligations)
3. Publish at /privacy + /terms
4. Add links to footer
5. Have lawyer review (optional for MVP)

**Files to change:**

- `packages/web/src/app/privacy/page.tsx` (new)
- `packages/web/src/app/terms/page.tsx` (new)

**Dependencies:** None (can do anytime)

**Acceptance criteria:**

- [ ] Policies written
- [ ] Published and accessible
- [ ] Links in footer

### G.3: Beta Outreach List (Week 4)

**Goal:** Line up first 10-20 users  
**Tasks in order:**

1. Identify 50+ potential beta users
   - Founders in Slack communities you're in
   - Twitter/X founders + makers
   - Reddit r/Entrepreneur
   - Indie Hackers community
2. Create outreach message
3. Prepare sample report (manually created)
4. Test message with 2-3 people first
5. Send mass outreach

**Files to change:** (No code, external list)

**Dependencies:** G.1 (landing page)

**Acceptance criteria:**

- [ ] 50+ targets identified
- [ ] Message written
- [ ] Sample report ready
- [ ] Ready to send

### G.4: Sample Reports (Week 5)

**Goal:** Public proof-of-product  
**Tasks in order:**

1. Create 2-3 manually-generated reports
   - Notion pain report
   - Slack pain report
   - One more (Copilot, Linear, etc.)
2. Polish them to be perfect examples
3. Publish as blog posts or landing page features
4. Get 5-10 testimonials from beta users
5. Add to social media (Twitter threads)

**Files to change:**

- Blog post markdown files
- Social media content (external)

**Dependencies:** C.4 (report generation), beta users (testimonials)

**Acceptance criteria:**

- [ ] 2-3 sample reports published
- [ ] Testimonials collected
- [ ] Shared on Twitter + community

---

## Master Execution Order (6 Phases)

### PHASE 1: Fix Foundation (Week 1)

**Critical path:** C.1 (Switch to Claude)

**Parallel work:**

- D.1: Schema planning
- B.1-2: Source discovery enhancement
- F.1-2: Secrets + logging setup

**By end of Phase 1:**

- [ ] Claude API working (classification runs, ~30% accurate)
- [ ] New schema designed (no migrations yet)
- [ ] Source configs table planned
- [ ] Logging structured
- [ ] Secrets not in git

**Team:**

- 1 backend eng: C.1 (2 days)
- 1 database eng: D.1 (1 day) + F.1-2 (2 days)
- 1 backend eng (if 3-person team): B.1-2 (2 days)

**Success criteria:**

- [ ] Discovery endpoint calls Claude successfully
- [ ] JSON parsing works
- [ ] Token usage logged
- [ ] Can classify 10 mentions (even if not perfect)

---

### PHASE 2: End-to-End Report (Week 2-3)

**Critical path:** C.2 (Batch classification) → C.3 (Clustering) → C.4 (Report gen)

**Parallel work:**

- D.2-3: Apply schema migrations
- A.1-2: Update API endpoints
- E.1: Build report page
- B.3: Tune ingestion volume

**By end of Phase 2:**

- [ ] Can create report end-to-end
- [ ] Classification works (80%+ accuracy target)
- [ ] Clustering creates 8-12 themes
- [ ] Report JSON well-structured
- [ ] Report page displays beautifully

**Team:**

- 1 backend: C.2 (2 days) + C.3 (2 days) + C.4 (2 days)
- 1 database: D.2-3 (2 days) + A.1 (1 day)
- 1 frontend: E.1 (2-3 days)

**Success criteria:**

- [ ] Create report for Notion → Get 8-12 insight clusters
- [ ] Open report page → See all sections readable
- [ ] Evidence shows real Reddit quotes with links
- [ ] No crashes, graceful error handling

**Manual test:** Run on 3-5 competitors, read reports for sense-check

---

### PHASE 3: Quality Improvement (Week 3)

**Parallel work:**

- C.5: Prompt engineering (better LLM outputs)
- E.2-3: Evidence drawer + export
- A.3-4: Add export endpoints
- F.3-4: Health check + error handling

**By end of Phase 3:**

- [ ] Reports are "brutally useful" (actionable insights)
- [ ] Evidence drawer works smoothly
- [ ] Export to PDF/Markdown/Copy functional
- [ ] System gracefully handles errors

**Team:**

- 1 backend: C.5 (2 days) + A.3-4 (2 days) + F.3-4 (2 days)
- 1 frontend: E.2-3 (2 days)

**Success criteria:**

- [ ] 3-5 users read report and say "that's useful"
- [ ] Evidence correctly attributes Reddit posts
- [ ] Export works without errors
- [ ] No unhandled errors in logs

---

### PHASE 4: UI Complete & Mobile (Week 4)

**Parallel work:**

- E.4-5: Dashboard + create form
- E.6: Mobile responsiveness
- A.5: Create endpoint handler
- F.5: Stripe integration

**By end of Phase 4:**

- [ ] Dashboard lists past reports
- [ ] Create form queues job
- [ ] Loading state shows progress
- [ ] Report readable on phone
- [ ] Payment flow wired up (not tested yet)

**Team:**

- 1 frontend: E.4-6 (3 days)
- 1 backend: A.5 (1 day) + F.5 (2 days)

**Success criteria:**

- [ ] Create report flow is smooth
- [ ] Dashboard shows all projects
- [ ] Mobile viewport works
- [ ] Stripe session created (test mode)

**Manual test:** Full user flow on desktop + mobile

---

### PHASE 5: Production Basics (Week 4-5)

**Parallel work:**

- F.6: Production environment setup
- F.7: Deployment pipeline
- D.4: Job queueing
- A.6: Payment webhook

**By end of Phase 5:**

- [ ] Production database ready (with backups)
- [ ] Production Redis ready
- [ ] Deployments automated
- [ ] Payment webhook working
- [ ] Can safely deploy

**Team:**

- 1 backend/devops: F.6-7 (3 days) + D.4 (1 day) + A.6 (1 day)

**Success criteria:**

- [ ] Smoke test passes on production
- [ ] Backups verified
- [ ] Rollback procedure documented
- [ ] Test payment succeeds → project marked paid

---

### PHASE 6: Deploy & Launch (Week 5-6)

**Parallel work:**

- G.1-4: Landing page, privacy, outreach, sample reports
- Final testing + polish
- Deploy to production

**By end of Phase 6:**

- [ ] Live at production domain
- [ ] Landing page published
- [ ] Beta users invited + signing up
- [ ] First 5 reports created (manually if needed)
- [ ] Payment working
- [ ] Monitoring + alerts active

**Team:**

- Everyone: Final QA + deployment (1 day)
- Growth/operations: G.1-4 (3-4 days in parallel)

**Success criteria:**

- [ ] Beta users can sign up
- [ ] First report created successfully
- [ ] Payment processed
- [ ] Monitoring shows no errors
- [ ] Response times acceptable

---

## The Exact First 5 Implementation Tasks

**Start TODAY.** These unlock everything else.

### Task 1: Switch to Claude API (C.1)

**What:** Update discovery service to use Claude instead of Llama  
**Why:** Classification is completely broken. Claude has 200K context window vs Llama's 8K  
**How:**

```
1. Open packages/api/src/services/discovery.service.ts
2. Find the LLM call (currently using Groq or local Llama)
3. Replace with:
   const response = await anthropic.messages.create({
     model: 'claude-3-5-sonnet-20241022',
     max_tokens: 1000,
     messages: [{role: 'user', content: prompt}]
   })
4. Update .env to have ANTHROPIC_API_KEY
5. Test with 3 competitors, verify JSON output
```

**Files to change:**

- `packages/api/src/services/discovery.service.ts`
- `.env.local` (add/verify ANTHROPIC_API_KEY)

**Time:** 2 hours  
**Blocker for:** Everything else (C.2, C.3, C.4)

---

### Task 2: Build Batch Classification (C.2)

**What:** Classify 500+ mentions using Claude in batches of 50  
**Why:** Unblocks clustering, report generation, entire pipeline  
**How:**

```
1. Create packages/workers/src/llm/classification.ts
2. Function: classifyBatch(mentions[50]) → [classifications]
3. In classification processor:
   - Fetch unclassified mentions
   - Split into batches of 50
   - For each batch, call classifyBatch()
   - Save classifications to DB
   - Log progress
4. Handle batch failures gracefully (retry, log, continue)
5. Test with 500 real mentions, verify 99%+ map correctly
```

**Files to change:**

- `packages/workers/src/llm/classification.ts` (new)
- `packages/workers/src/processors/classification.processor.ts` (major rewrite)

**Time:** 6 hours  
**Blocker for:** C.3, C.4, entire pipeline

---

### Task 3: Implement Clustering (C.3)

**What:** Group 500 classified mentions into 8-12 pain themes  
**Why:** Transforms raw mentions into structured insights  
**How:**

```
1. Create packages/workers/src/llm/clustering.ts
2. Function: clusterMentions(mentions[], classifications[])
3. Logic:
   - Group by category (complaint, request, etc)
   - Within each category, cluster by semantic similarity
   - Generate summary per cluster via LLM
   - Rank by strength (mention count + sentiment)
4. Save clusters to database
5. Test with 3 competitors, verify 8-12 clusters of quality
```

**Files to change:**

- `packages/workers/src/llm/clustering.ts` (new)
- `packages/workers/src/processors/clustering.processor.ts` (enhance)

**Time:** 4 hours  
**Blocker for:** C.4, report generation, entire pipeline

---

### Task 4: Build Report Generation (C.4)

**What:** Convert clusters → founder-friendly report structure  
**Why:** This is the core product  
**How:**

```
1. Create packages/api/src/services/report.service.ts
2. Class: ReportService
3. Methods:
   - generate(projectId) → report JSON
   - getExecutiveSummary() (LLM call)
   - extractPainThemes(clusters[])
   - extractFeatureRequests()
   - generateOpportunities() (LLM call)
   - generateValidationSteps()
4. Save to reports table
5. Test with 3 competitors, manually read reports
   - Are they useful?
   - Are insights backed by evidence?
   - Is language founder-friendly?
```

**Files to change:**

- `packages/api/src/services/report.service.ts` (new)
- `packages/workers/src/processors/report-generation.processor.ts` (new)

**Time:** 6 hours  
**Blocker for:** Report UI, entire product

---

### Task 5: Build Report Page (E.1)

**What:** Display report beautifully  
**Why:** This is what users see. Must be great.  
**How:**

```
1. Create pages/web/src/app/report/[id]/page.tsx
2. Fetch report JSON from API
3. Build ReportView component with sections:
   - Executive Summary
   - Pain Themes (with expandable evidence)
   - Feature Requests
   - Opportunities
   - Validation Steps
4. Use Tailwind for beautiful layout:
   - Clear typography
   - Good spacing
   - Readable on phone
5. Add evidence snippets (truncated to 150 chars)
6. Add Reddit links (clickable)
7. Test on desktop + mobile
```

**Files to change:**

- `packages/web/src/app/report/[id]/page.tsx` (new)
- `packages/web/src/components/report/ReportView.tsx` (new)

**Time:** 6 hours  
**Blocker for:** Nothing (but needed for launch)

---

## Start Here (Next 2 Days)

**Day 1:**

- [ ] Task 1: Switch to Claude API (2 hrs)
- [ ] Task 2: Batch classification (4 hrs)
- [ ] Test with Zerodha (2 hrs discovery, 2 hrs classification)
- [ ] Read what we've built so far

**Day 2:**

- [ ] Task 3: Clustering (4 hrs)
- [ ] Task 4: Report generation (3 hrs)
- [ ] Test with 3 competitors (2 hrs)
- [ ] Manually read 3 reports, iterate prompts (1 hr)

**By end of Day 2:** You'll have a working end-to-end system that generates real, useful founder reports.

---

## After Phase 1: Priority Decision

Once C.1-C.4 work:

- **If solo:** Do Tracks D, A, E sequentially (1-2 per week)
- **If 2 people:** One does Track D+A (backend), one does Track E (frontend)
- **If 3 people:** Parallelize all non-dependent tracks

---

## Success Definition

**MVP is ready when:**

✅ User enters "Notion"  
✅ System searches Reddit + discovers subreddits  
✅ System fetches 500+ mentions in <2 min  
✅ System classifies into 8-12 pain themes  
✅ System generates report  
✅ User sees beautiful report with evidence  
✅ User can export PDF/Markdown  
✅ User can pay $29  
✅ Zero critical bugs

**That's it. Everything else is nice-to-have.**
