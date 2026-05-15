# RivalEye Prioritized Backlog

**Total P0 tasks:** 18  
**Estimated effort:** 6-8 weeks for 1 engineer  
**Parallel tracks:** 4 (can be split across team)

---

## Backlog Overview

### P0: Must Ship (MVP Blocker)
18 tasks split across 4 tracks. Estimated 6-8 weeks.

### P1: Strongly Needed (Week after launch)
8 tasks. Estimated 1-2 weeks.

### P2: Nice to Have (Post-MVP)
10 tasks. Lower priority, adds polish.

### P3: Later (Months 2-3)
15+ tasks. Roadmap items.

---

## Execution Strategy

**Recommended:** 1 engineer can do P0 in 6-8 weeks working full-time.

**Or:** Split across 2-3 engineers in parallel:
- Backend engineer (fixes LLM, builds report gen, export)
- Frontend engineer (report UI, evidence drawer)
- Database/Ops engineer (schema migration, monitoring)

---

## P0 Track 1: Fix LLM Pipeline (Weeks 1-2)

These must be done first. Everything else depends on classification working.

### Task 1.1: Switch from Llama to Claude API
**Impact:** Unblocks entire classification pipeline  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** None

```
What: Replace local Llama with Claude API (Anthropic SDK)
Why: Llama 3.1 8B context (8K) insufficient, Claude has 200K
How:
  1. Remove Groq + Llama config
  2. Update discovery service to use Claude (already using Anthropic SDK)
  3. Test with 10 sample mentions
  4. Verify JSON parsing
  5. Monitor token usage + cost
Files:
  - packages/api/src/services/discovery.service.ts
  - packages/workers/src/processors/classification.processor.ts
  - .env.example (remove Groq keys)
Acceptance:
  - [ ] Classification request works
  - [ ] JSON response parsed correctly
  - [ ] Token usage logged
  - [ ] Cost tracking shows <$1 per 500 mentions
```

### Task 1.2: Fix Classification Batch Processing
**Impact:** Enable classifying 500+ mentions per competitor  
**Effort:** L (Large - 6-8 hours)  
**Dependencies:** Task 1.1

```
What: Batch 50 mentions per Claude API call (vs 1-10 currently)
Why: Too expensive + slow to call API for each mention
How:
  1. Split unclassified mentions into batches of 50
  2. Build batch classification prompt
  3. Implement retry logic for failed batches
  4. Map LLM response back to mention IDs
  5. Handle edge cases (mention missing from response)
Files:
  - packages/workers/src/processors/classification.processor.ts
  - packages/workers/src/llm/classification.ts (new)
Acceptance:
  - [ ] Can classify 500 mentions in <3 min
  - [ ] 99%+ mention IDs match correctly
  - [ ] Failed batches retry and eventually succeed
  - [ ] Job status updates in real-time
```

### Task 1.3: Implement Clustering from Classifications
**Impact:** Enable grouping pain themes  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** Task 1.2

```
What: Take classified mentions and group into pain clusters
Why: Raw classifications are noise; clusters are insights
How:
  1. Fetch classified mentions for project
  2. Group by category (complaint, request, etc)
  3. Within each category, cluster by semantic similarity
  4. Generate cluster summaries
  5. Save to clusters table
Files:
  - packages/workers/src/processors/clustering.processor.ts (enhance)
  - packages/workers/src/llm/clustering.ts (new)
Acceptance:
  - [ ] Clustering processor runs after classification
  - [ ] 8-12 clusters created per competitor
  - [ ] Cluster summaries sensible
  - [ ] Mention counts accurate
```

### Task 1.4: Build Report Generation Service
**Impact:** Convert data into founder-ready report JSON  
**Effort:** L (Large - 6-8 hours)  
**Dependencies:** Task 1.3

```
What: Service that takes clusters + mentions → report structure
Why: Need structured data before UI can render it
How:
  1. Build ReportService class
  2. Generate executive summary (LLM)
  3. Extract pain themes from clusters
  4. Extract feature requests
  5. Generate opportunities (LLM)
  6. Generate validation recommendations
  7. Save to reports table
Files:
  - packages/api/src/services/report.service.ts (new)
  - packages/workers/src/processors/report-generation.processor.ts (new)
Acceptance:
  - [ ] Report JSON well-structured
  - [ ] Summary is 2-3 sentences
  - [ ] Pain themes have evidence quotes
  - [ ] Opportunities are actionable
  - [ ] Validation steps are specific
```

---

## P0 Track 2: Database Schema & API (Weeks 1-3)

Parallelize with Track 1. These are mostly independent.

### Task 2.1: Rename competitors → projects (Schema Migration)
**Impact:** Align data model with MVP product concept  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** None

```
What: Migrate from 'competitors' to 'projects' table
Why: "Competitor" doesn't fit (could be topic, company, feature)
How:
  1. Create new projects table with search_query field
  2. Add source_types ARRAY
  3. Migrate data from competitors → projects
  4. Add uniqueness constraint on (workspace_id, search_query)
  5. Keep competitors table 14 days for safety, then drop
Files:
  - packages/db/src/schema/projects.ts (new)
  - packages/db/migrations/ (new migration files)
Acceptance:
  - [ ] New projects table created
  - [ ] All data migrated correctly
  - [ ] API routes updated to use projects
  - [ ] Rollback tested
```

### Task 2.2: Create Reports Table
**Impact:** Store generated reports  
**Effort:** S (Small - 1-2 hours)  
**Dependencies:** Task 2.1

```
What: Add reports table to store generated report JSON
Why: Need to save reports for viewing/exporting later
How:
  1. Create reports table with JSONB report_data column
  2. Add index on project_id
  3. Drizzle schema
Files:
  - packages/db/src/schema/reports.ts
Acceptance:
  - [ ] Table created
  - [ ] Sample report JSON inserted and retrieved
```

### Task 2.3: Create Job Tracking Tables
**Impact:** Track progress of ingestion, classification, report gen  
**Effort:** S (Small - 2 hours)  
**Dependencies:** Task 2.1

```
What: Add classification_jobs and report_generation_jobs tables
Why: Track job progress, find failures
How:
  1. Create classification_jobs table
  2. Create report_generation_jobs table
  3. Add status enum (pending/running/completed/failed)
Files:
  - packages/db/src/schema/job-tables.ts (or integrate)
Acceptance:
  - [ ] Tables created
  - [ ] Sample jobs inserted
```

### Task 2.4: Update Competitor Service to Project Service
**Impact:** Unify business logic for projects  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** Task 2.1

```
What: Rename CompetitorService → ProjectService
Why: Terminology alignment
How:
  1. Rename class and file
  2. Update all imports
  3. Update CRUD operations (search_query field)
  4. Update API routes
Files:
  - packages/api/src/services/project.service.ts (was competitor.service.ts)
  - packages/api/src/routes/projects.ts (was competitors.ts)
Acceptance:
  - [ ] All CRUD operations work
  - [ ] API tests pass
  - [ ] No broken imports
```

### Task 2.5: Add Report API Endpoints
**Impact:** Frontend can fetch reports  
**Effort:** M (Medium - 3-4 hours)  
**Dependencies:** Task 2.4

```
What: Add GET /projects/{id}/report endpoint
Why: Frontend needs to load report JSON
How:
  1. Add GET /projects/{id}/report (returns report JSON)
  2. Add GET /projects/{id}/evidence/{evidenceId} (returns single Reddit quote + context)
  3. Add caching (5 min)
  4. Error handling if report not found
Files:
  - packages/api/src/routes/reports.ts (new)
Acceptance:
  - [ ] Endpoint returns valid JSON
  - [ ] Evidence endpoint returns quote + context
  - [ ] 404 if not found
  - [ ] Response time <500ms
```

### Task 2.6: Add Export API Endpoint
**Impact:** Enable PDF/markdown download  
**Effort:** L (Large - 6-8 hours)  
**Dependencies:** Task 2.5

```
What: Implement POST /projects/{id}/export (format: pdf|markdown)
Why: Users need to download reports
How:
  1. Create ExportService class
  2. Implement PDF generation (use pdfkit or similar)
  3. Implement Markdown generation
  4. Queue export job
  5. Return file URL when ready
Files:
  - packages/api/src/services/export.service.ts (new)
  - packages/api/src/routes/exports.ts (new)
Acceptance:
  - [ ] Can export PDF (<10s generation)
  - [ ] Can export Markdown
  - [ ] File download works
  - [ ] Error handling for failed exports
```

---

## P0 Track 3: Frontend Report Experience (Weeks 2-4)

Can parallelize with Tracks 1 & 2.

### Task 3.1: Build Report Page Component
**Impact:** Main product UI  
**Effort:** L (Large - 8-10 hours)  
**Dependencies:** Task 2.5 (API endpoint)

```
What: Create /report/{id} page showing beautiful report
Why: This is the product
How:
  1. Create ReportPage component
  2. Build Executive Summary section
  3. Build Pain Themes section (with expandable evidence)
  4. Build Feature Requests section
  5. Build Opportunities section
  6. Build Validation Recommendations section
  7. Add proper typography + spacing
Files:
  - packages/web/src/app/report/[id]/page.tsx
  - packages/web/src/components/report/ReportView.tsx
  - packages/web/src/components/report/PainThemeCard.tsx
  - packages/web/src/components/report/EvidenceDrawer.tsx
Acceptance:
  - [ ] Report renders beautifully
  - [ ] All sections visible
  - [ ] Evidence drawer works
  - [ ] Mobile responsive
  - [ ] Typography clear and scannable
```

### Task 3.2: Build Evidence Drawer
**Impact:** Users can verify findings  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** Task 2.5

```
What: Expandable drawer showing Reddit quotes + links
Why: Proof of findings
How:
  1. Create EvidenceDrawer component
  2. Show 3-5 quotes per theme
  3. Display subreddit, score, author
  4. Make Reddit links clickable
  5. Add "Copy Quote" button
Files:
  - packages/web/src/components/report/EvidenceDrawer.tsx
Acceptance:
  - [ ] Drawer opens/closes
  - [ ] Quotes display correctly
  - [ ] Links work
  - [ ] Copy button copies to clipboard
```

### Task 3.3: Build Export Menu
**Impact:** Users can download report  
**Effort:** S (Small - 2-3 hours)  
**Dependencies:** Task 2.6

```
What: Menu with download options (PDF, Markdown, Copy)
Why: Users need to share reports
How:
  1. Create ExportMenu component
  2. Add PDF download button
  3. Add Markdown download button
  4. Add Copy-to-Clipboard button
  5. Show "Generating..." state
Files:
  - packages/web/src/components/report/ExportMenu.tsx
Acceptance:
  - [ ] PDF downloads successfully
  - [ ] Markdown downloads successfully
  - [ ] Copy-to-clipboard works
  - [ ] Loading state shows while generating
```

### Task 3.4: Build Create Report Form
**Impact:** Users can create new reports  
**Effort:** S (Small - 2-3 hours)  
**Dependencies:** Task 2.5

```
What: Form at /dashboard/new to create report
Why: Entry point to product
How:
  1. Create CreateReportPage
  2. Simple form: search_query input + optional category
  3. Submit button
  4. Redirect to report view after creation
Files:
  - packages/web/src/app/dashboard/new/page.tsx
Acceptance:
  - [ ] Form submits
  - [ ] Job queued on backend
  - [ ] Redirect to report page works
```

### Task 3.5: Build Dashboard / Project List
**Impact:** Users see their reports  
**Effort:** S (Small - 2-3 hours)  
**Dependencies:** Task 2.4

```
What: Page showing list of user's past reports
Why: Central hub for projects
How:
  1. Fetch list of projects via API
  2. Display as cards or list
  3. Show date, mention count, status
  4. Links to view/export/delete
Files:
  - packages/web/src/app/dashboard/page.tsx (enhance)
Acceptance:
  - [ ] Lists all user projects
  - [ ] Can click to view report
  - [ ] Can delete project
  - [ ] Responsive design
```

### Task 3.6: Build Progress / Loading State
**Impact:** Users know their report is generating  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** Task 2.5

```
What: Show progress while report is being generated
Why: 2-3 minute wait should be transparent
How:
  1. Create LoadingState component
  2. Poll API for job status
  3. Show step progress (discovering → ingesting → classifying → clustering → reporting)
  4. Show progress bar
  5. Auto-redirect when complete
Files:
  - packages/web/src/components/report/LoadingState.tsx
Acceptance:
  - [ ] Shows all 5 steps
  - [ ] Progress bar updates
  - [ ] Auto-redirects when done
  - [ ] Graceful error if fails
```

---

## P0 Track 4: Operations & Deployment (Weeks 3-4)

Can parallelize with other tracks.

### Task 4.1: Configure Production Database
**Impact:** Can deploy to production  
**Effort:** S (Small - 1-2 hours)  
**Dependencies:** Task 2.1

```
What: Set up Supabase production database + backups
Why: Need persistent data in production
How:
  1. Create Supabase project (production)
  2. Run migrations
  3. Test backup/restore
  4. Set DATABASE_URL env var
Files: (No code changes)
Acceptance:
  - [ ] Database accessible
  - [ ] Migrations ran successfully
  - [ ] Backups configured
```

### Task 4.2: Configure Production Redis
**Impact:** Job queue works in production  
**Effort:** S (Small - 1-2 hours)  
**Dependencies:** None

```
What: Set up Upstash or other Redis provider for production
Why: Need reliable job queue
How:
  1. Create Upstash Redis instance
  2. Set REDIS_URL env var
  3. Test connection
  4. Configure retention policies
Files: (No code changes)
Acceptance:
  - [ ] Redis accessible
  - [ ] Can enqueue and process jobs
```

### Task 4.3: Set Up Secrets Management
**Impact:** API keys secure, not in code  
**Effort:** S (Small - 1-2 hours)  
**Dependencies:** None

```
What: Store ANTHROPIC_API_KEY, Reddit creds, JWT secrets in env
Why: Never commit secrets to git
How:
  1. Remove any secrets from .env.example (leave placeholders)
  2. Document which secrets go where
  3. Set up Vercel env vars for production
  4. Test that app boots with env vars
Files:
  - .env.example (updated)
  - .claude/settings.json (document secrets approach)
Acceptance:
  - [ ] No secrets in git
  - [ ] App boots with env vars
  - [ ] Production secrets set
```

### Task 4.4: Set Up Monitoring & Logging
**Impact:** Can diagnose production issues  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** None

```
What: Configure Pino logging, error tracking, basic metrics
Why: Can't fix what we can't see
How:
  1. Configure Pino for JSON structured logging
  2. Add Sentry for error tracking (or simple email on 5xx)
  3. Add basic metrics logging (request count, latency)
  4. Set up Slack alerts for critical errors
Files:
  - packages/api/src/logger.ts (enhance)
  - packages/api/src/middleware/logging.ts (new if needed)
Acceptance:
  - [ ] Logs appear in console (JSON format)
  - [ ] Errors sent to Slack
  - [ ] Can see request latencies
```

### Task 4.5: Set Up Stripe Integration
**Impact:** Can charge users  
**Effort:** L (Large - 6-8 hours)  
**Dependencies:** Task 2.5

```
What: Implement Stripe payment processing
Why: Need to charge $29 per report (MVP pricing)
How:
  1. Create Stripe account
  2. Add Stripe package to API
  3. Create POST /checkout endpoint
  4. Handle webhook for payment success
  5. Mark project as "paid" when payment confirmed
  6. Email receipt to user
Files:
  - packages/api/src/services/stripe.service.ts (new)
  - packages/api/src/routes/payments.ts (new)
Acceptance:
  - [ ] Can create Stripe session
  - [ ] Payment processes
  - [ ] Webhook received
  - [ ] User marked as paid
  - [ ] Receipt emailed
```

### Task 4.6: Deploy to Production
**Impact:** Product live for beta users  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** All Tasks 1.x, 2.x, 3.x, 4.1-4.4

```
What: Deploy API to Railway/Render, Web to Vercel
Why: Need live product
How:
  1. Create Railway project for API
  2. Connect to production database + Redis
  3. Deploy web to Vercel
  4. Run smoke test (create report end-to-end)
  5. Monitor for errors
Files: (No code changes, deployment config)
Acceptance:
  - [ ] API accessible at production URL
  - [ ] Web accessible at production URL
  - [ ] Health check passes
  - [ ] Can create report end-to-end
```

---

## P1: Strongly Needed (Week 5-6)

Do these right after P0 ships. Not blocking beta launch, but needed quickly.

### P1 Task 1: Source Abstraction Layer
**Impact:** Make it easy to add App Store, G2, Twitter later  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** All P0 tasks

### P1 Task 2: Error Recovery & Retries
**Impact:** Failed jobs don't get stuck  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** All P0 tasks

### P1 Task 3: Email Notifications
**Impact:** Users get notified when report is ready  
**Effort:** S (Small - 2-3 hours)  
**Dependencies:** Task 2.5

### P1 Task 4: Privacy Policy & Terms
**Impact:** Legal compliance  
**Effort:** S (Small - 1-2 hours)  
**Dependencies:** None

### P1 Task 5: Landing Page
**Impact:** Public marketing site  
**Effort:** M (Medium - 4-6 hours)  
**Dependencies:** Task 3.5

### P1 Task 6: Demo Report
**Impact:** Marketing proof-of-product  
**Effort:** S (Small - 2-3 hours)  
**Dependencies:** All P0 tasks

### P1 Task 7: Rate Limiting Enhancement
**Impact:** Prevent abuse  
**Effort:** S (Small - 2 hours)  
**Dependencies:** None

### P1 Task 8: Analytics Basics
**Impact:** Track usage  
**Effort:** S (Small - 2-3 hours)  
**Dependencies:** None

---

## P2: Nice to Have

- Dark mode toggle
- Print-friendly CSS
- Keyboard navigation
- Accessibility audit (WCAG A)
- Search/filter in project list
- Report versioning
- Comparison reports (2 competitors)
- Team collaboration (comments on reports)
- Monthly digest
- Mobile app (iOS/Android)

---

## P3: Months 2-3

- Multiple sources (App Store, G2, Twitter, etc.)
- Advanced report customization
- API for integrations
- White-label offering
- Monthly subscription plan
- Historical trending
- Competitive intelligence alerts
- Content syndication (blog + API)

---

## Task Dependencies & Parallelization

### Track 1 Dependencies
```
1.1 (Switch LLM)
  ↓
1.2 (Batch Classification) ← depends on 1.1
  ↓
1.3 (Clustering) ← depends on 1.2
  ↓
1.4 (Report Generation) ← depends on 1.3
```

### Track 2 Dependencies
```
2.1 (Schema) → 2.2, 2.3, 2.4 (can run in parallel)
2.4 → 2.5, 2.6
```

### Track 3 Dependencies
```
2.5 → 3.1, 3.2, 3.3 (can run in parallel)
2.4 → 3.4
2.4 → 3.5
3.1 → 3.6
```

### Track 4
- 4.1, 4.2, 4.3 can run in parallel
- 4.4 can start anytime
- 4.5 can start after 2.5
- 4.6 depends on all P0 tasks

### Recommended Parallelization
```
Week 1:
  Engineer A: Task 1.1, 1.2
  Engineer B: Task 2.1, 2.2, 2.3
  Engineer C: Task 4.1, 4.2, 4.3

Week 2:
  Engineer A: Task 1.3, 1.4
  Engineer B: Task 2.4, 2.5
  Engineer C: Task 4.4, 4.5

Week 3:
  Engineer A: Task 3.1, 3.2, 3.3
  Engineer B: Task 2.6, 3.4, 3.5
  Engineer C: Polish, testing, bug fixes

Week 4:
  All: Task 4.6 (Deploy), testing, polish
```

---

## Effort Estimation

### Size Definitions
- **S (Small):** 1-2 hours, low risk
- **M (Medium):** 4-6 hours, medium risk
- **L (Large):** 6-10 hours, higher risk

### Total P0 Effort
- Track 1: 4.5 + 7 + 5 + 7 = 23.5 hours
- Track 2: 5 + 1.5 + 2 + 5 + 4 + 7 = 24.5 hours
- Track 3: 9 + 5 + 2.5 + 2.5 + 2.5 + 5 = 26.5 hours
- Track 4: 1.5 + 1.5 + 1.5 + 5 + 7 + 5 = 22 hours

**Total: ~96.5 hours = 12 engineer-days (@ 8 hrs/day)**

Or: **6-8 weeks for 1 engineer** (accounting for context switching, debugging)

---

## Risk & Mitigation

### High Risk Tasks
| Task | Risk | Mitigation |
|------|------|-----------|
| 1.2 (Classification batching) | LLM may not return correct format | Implement strict parsing + fallbacks |
| 1.4 (Report generation) | Insights may be mediocre | Draft with sample data first, iterate prompts |
| 2.1 (Schema migration) | Data loss if migration fails | Test rollback on staging first |
| 3.1 (Report UI) | May not be "beautiful" | Get feedback early from 2-3 users |
| 4.5 (Stripe) | Payment flow breaks | Test manually with Stripe test cards |
| 4.6 (Deploy) | Production environment differs from dev | Document differences, test in staging first |

---

## Definition of Done (Each Task)

All tasks must meet these criteria before "done":

- [ ] Code committed to main branch
- [ ] No TODO comments left
- [ ] Related tests pass (if applicable)
- [ ] Error handling for happy path
- [ ] Logged at INFO or ERROR level
- [ ] Documented in code (if complex)
- [ ] Code review passed (if pair programming)
- [ ] Acceptance criteria met
- [ ] No new security holes introduced
- [ ] Performance acceptable (no new slowness >2x)

---

## Success Criteria for MVP Launch

MVP is ready to ship when:

✅ **All P0 tasks complete**  
✅ **Zero critical bugs** (showstoppers)  
✅ **End-to-end test passes:** signup → create report → view report → export  
✅ **Performance acceptable:** Report generation <3 min, API <500ms p95  
✅ **Security basics in place:** No hardcoded secrets, HTTPS enforced  
✅ **Logging works:** Can diagnose production issues  
✅ **Stripe integration tested:** Successful payment → report marked paid  

---

## Conclusion

This backlog prioritizes ruthlessly:

1. **Fix LLM pipeline first** - Everything depends on it
2. **Build schema + API** - Data layer must be right
3. **Build report UI** - Main product
4. **Ship + monitor** - Get real users ASAP
5. **Iterate** - Everything after launch is validation

**Target:** Ship beta March 15, 2026
