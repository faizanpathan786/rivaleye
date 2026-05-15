# RivalEye Production Readiness Checklist

**Status:** MVP launch readiness  
**Goal:** Ship with sane defaults, not enterprise-grade perfection

---

## Core Systems

### Authentication & Security

- [ ] JWT token expiry: 30 minutes (access), 7 days (refresh)
- [ ] Password hashing: bcryptjs with salt rounds 10+
- [ ] Rate limiting: Fastify rate-limit on all routes
- [ ] CORS: Configured for web origin only (not wildcard)
- [ ] HTTPS: Enforced in production (redirect HTTP → HTTPS)
- [ ] Security headers:
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] X-XSS-Protection: 1; mode=block
  - [ ] Strict-Transport-Security: max-age=31536000

**Implementation:**
```typescript
app.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
})
```

### Input Validation

- [ ] All POST/PUT bodies validated with Zod
- [ ] File uploads: Max 10MB, whitelist MIME types
- [ ] Query params: Validated before use
- [ ] Length limits: Max 500 chars for search query
- [ ] SQL injection prevention: Via Drizzle ORM (parameterized)
- [ ] XSS prevention: React escapes by default

**Validation Examples:**
```typescript
const createProjectSchema = z.object({
  search_query: z.string().min(2).max(500),
  industry: z.string().max(100).optional()
})
```

### Database

- [ ] Connection pooling: 10-20 connections max
- [ ] Timeouts: 30 second query timeout
- [ ] Backups: Daily automated (Supabase default)
- [ ] Backup restoration: Tested manually
- [ ] Migrations: Drizzle auto-generate, versioned
- [ ] Secrets: DATABASE_URL in env, never in code
- [ ] Read replicas: Not needed for MVP

**Implementation:**
```typescript
const db = drizzle(sql.postgres({
  database: process.env.DATABASE_URL,
  max: 15,  // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
}))
```

### Job Queue (Redis + BullMQ)

- [ ] Redis authentication: password set
- [ ] Job timeouts: 5 minutes max per job
- [ ] Retries: Exponential backoff (5s, 30s, 2m, 10m, 1h)
- [ ] Dead letter queue: Failed jobs after 5 retries
- [ ] Monitoring: Log all job failures
- [ ] Cleanup: Delete completed jobs after 7 days
- [ ] Max concurrency: 5 workers max (shared across processor types)

**Implementation:**
```typescript
const ingestionQueue = new Queue('ingestion', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: { age: 3600 }  // Keep failed jobs 1 hour for inspection
  }
})
```

### API Rate Limiting

- [ ] Global: 100 req/min per IP
- [ ] Per-user (later): 10 reports/day
- [ ] Per-endpoint:
  - [ ] POST /projects: 1 per 5 seconds (prevent spam)
  - [ ] POST /auth/signup: 5 per hour (prevent brute force)
  - [ ] GET /reports: 1000 per minute (generous)

**Implementation:**
```typescript
app.register(require('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute'
})

// Per-route override:
app.post('/projects', { config: { rateLimit: { max: 1, timeWindow: '5 seconds' } } }, ...)
```

---

## Observability

### Logging

- [ ] Structured logging: Pino with JSON format
- [ ] Log levels: INFO (normal), WARN (issues), ERROR (failures)
- [ ] Sampled logging: Log 1 in 100 successful requests (avoid spam)
- [ ] Async logging: Non-blocking writes

**Implementation:**
```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})

// In routes:
logger.info('Project created', { projectId, userId, duration })
logger.error('Classification failed', { projectId, error: e.message })
```

### Metrics & Monitoring

- [ ] Track API response times (histogram)
- [ ] Track job processing times (histogram)
- [ ] Track error rates (counter)
- [ ] Track queue depth (gauge)
- [ ] Track LLM token usage (counter)
- [ ] Export metrics: Prometheus format (later)

**Metrics to monitor:**
```
// Latency
api.request_duration_ms (histogram)
job.processing_duration_ms (histogram)

// Errors
api.errors_total (counter)
job.failures_total (counter)
llm.api_errors_total (counter)

// Throughput
api.requests_total (counter)
jobs.completed_total (counter)

// Resources
redis.queue_depth (gauge)
database.connections (gauge)
llm.tokens_used_total (counter)
llm.cost_dollars_total (gauge)
```

### Health Checks

- [ ] GET /health endpoint
- [ ] Checks: database, redis, llm connectivity
- [ ] Returns: { status: 'healthy', db: 'ok', redis: 'ok', llm: 'ok' }
- [ ] Timeout: 10 seconds max
- [ ] Use in: Kubernetes probes, load balancer checks

**Implementation:**
```typescript
app.get('/health', async () => {
  const checks = await Promise.allSettled([
    db.select().from(users).limit(1),
    redis.ping(),
    callLLMHealthCheck()
  ])
  
  return {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    db: checks[0].status === 'fulfilled' ? 'ok' : 'error',
    redis: checks[1].status === 'fulfilled' ? 'ok' : 'error',
    llm: checks[2].status === 'fulfilled' ? 'ok' : 'error'
  }
})
```

---

## Secrets & Environment

### Secret Management

- [ ] Never commit secrets to git
- [ ] Use `.env.local` for development (in `.gitignore`)
- [ ] Use environment variables for staging/production
- [ ] Secrets rotation: Every 90 days
- [ ] Backup secrets: Stored separately from code
- [ ] Audit log: Track who accessed secrets when (later)

**Secrets to manage:**
```
DATABASE_URL                 (Supabase connection)
REDIS_URL                    (Redis connection)
JWT_SECRET                   (Auth token signing)
JWT_REFRESH_SECRET           (Refresh token signing)
REDDIT_CLIENT_ID             (Reddit OAuth)
REDDIT_CLIENT_SECRET         (Reddit OAuth)
ANTHROPIC_API_KEY            (Claude API)
```

### Environment Configuration

- [ ] NODE_ENV: development / staging / production
- [ ] API_PORT: 3001 (development), 3001 (production)
- [ ] WEB_PORT: 3000 (development), via Vercel (production)
- [ ] LOG_LEVEL: debug (dev), info (prod)
- [ ] ENABLE_ANALYTICS: false (dev), true (prod)
- [ ] LLM_MAX_TOKENS: For safety guards

**Env example:**
```env
# .env.example (safe to commit)
NODE_ENV=development
API_PORT=3001
DATABASE_URL=postgresql://localhost/rivaleye_dev
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
```

---

## Error Handling

### Client Errors (4xx)

- [ ] 400 Bad Request: Invalid input
- [ ] 401 Unauthorized: Missing/invalid JWT
- [ ] 403 Forbidden: User lacks permission
- [ ] 404 Not Found: Resource missing
- [ ] 429 Too Many Requests: Rate limited

**Response format:**
```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Search query required",
  "details": {
    "field": "search_query",
    "reason": "required"
  }
}
```

### Server Errors (5xx)

- [ ] 500 Internal Server Error: Unexpected failure
- [ ] 503 Service Unavailable: Temporary downtime

**Log fully, don't expose internals:**
```json
{
  "success": false,
  "code": "INTERNAL_ERROR",
  "message": "Something went wrong. Please try again."
  // Don't expose: stack trace, SQL query, etc.
}
```

### Graceful Degradation

- [ ] If LLM API down: Return partial report (ingestion only, no classification)
- [ ] If Reddit API down: Queue job for retry later
- [ ] If Redis down: Use in-memory queue (accept data loss risk)
- [ ] If Database down: Return 503, retry with client

---

## Performance

### Frontend

- [ ] Lazy load routes (Next.js auto)
- [ ] Code split by page
- [ ] Image optimization
- [ ] Minification & compression
- [ ] Cache API responses (5 min in localStorage)
- [ ] Skeleton loaders for slow requests

**Lighthouse targets:**
- Performance: >80
- Accessibility: >80
- Best Practices: >80
- SEO: >90

### Backend

- [ ] Database query optimization (use indexes)
- [ ] Connection pooling (10-20 max)
- [ ] API response compression (gzip)
- [ ] Cache Redis responses (5 min)
- [ ] Batch LLM requests (50 mentions per call)
- [ ] Async job processing (don't block API)

**Response time targets:**
- API: <200ms p95
- Reports: <3s from cache
- Job processing: <2 min per competitor

---

## Cost Controls

### LLM API Spending

- [ ] Set monthly budget: $50 (development), $500 (production)
- [ ] Track daily spending
- [ ] Alert if daily spend >$20
- [ ] Alert if weekly spend >$100

**Implementation:**
```typescript
async function trackLLMCost(tokens: number, model: string) {
  const costPerToken = {
    'claude-3-haiku': 0.0000008,
    'claude-3-sonnet': 0.000003,
    'claude-3-opus': 0.000015
  }
  
  const cost = tokens * costPerToken[model]
  await db.insert(llmCosts).values({ tokens, cost, model, timestamp: now() })
  
  // Check daily budget
  const todaysCost = await getTodaysTotalCost()
  if (todaysCost > 20) {
    logger.warn('Daily LLM cost exceeded', { cost: todaysCost })
    // Alert to Slack or email
  }
}
```

### Storage Costs

- [ ] Estimate: 1000 reports × 1.5MB = 1.5GB
- [ ] Cost: Negligible (Supabase free tier includes storage)
- [ ] Archive old projects after 90 days (optional)

### API Costs

- [ ] Fastify: Free (open source)
- [ ] Next.js hosting: Vercel Pro ($20/mo) or free tier
- [ ] Redis: Upstash free tier (limited, upgrade to $7/mo if needed)
- [ ] Database: Supabase free tier (1GB, adequate)

---

## Deployment

### Staging Environment

- [ ] Staging database: Separate from production
- [ ] Staging Redis: Separate from production
- [ ] Staging API: Railway or Render
- [ ] Staging web: Vercel preview
- [ ] Test before production release

### Production Deployment

- [ ] Zero-downtime deployments
- [ ] Database migrations: Backward compatible
- [ ] Feature flags: For gradual rollout (later)
- [ ] Rollback procedure: Documented

**Deployment checklist:**
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Database migration tested on staging
- [ ] Performance tested on staging
- [ ] Staging data cleared (no secrets exposed)
- [ ] Secrets configured in production
- [ ] Deployment runs
- [ ] Health check passes
- [ ] Smoke test (create report end-to-end)

---

## Compliance & Privacy

### Data Retention

- [ ] User data: Keep indefinitely (they own it)
- [ ] Mention data: Keep indefinitely (or archive)
- [ ] Job logs: Keep 7 days, then delete
- [ ] API logs: Keep 30 days, then delete

### Privacy

- [ ] Privacy policy: Written and published
- [ ] Terms of service: Written and published
- [ ] GDPR: Comply with data deletion requests
- [ ] Right to be forgotten: User can delete their data + reports

**Implementation:**
```typescript
app.delete('/user/delete-everything', { preHandler: [requireAuth] }, async (req) => {
  const userId = req.user.id
  
  // Delete all user data
  await db.delete(users).where(eq(users.id, userId))
  // Cascade deletes: workspaces, projects, mentions, reports
  
  return { success: true }
})
```

### Reddit Data Attribution

- [ ] Always cite Reddit as source
- [ ] Include Reddit usernames in reports (if visible)
- [ ] Include post permalinks
- [ ] Comply with Reddit's ToS on data usage

---

## Testing

### Testing Strategy

**Unit tests (Optional for MVP, nice to have):**
- [ ] Services (auth, project, export)
- [ ] Utilities (normalization, dedup)

**Integration tests (Must have):**
- [ ] API endpoints (create project, get report)
- [ ] Database queries
- [ ] Job processing (at least one flow end-to-end)

**E2E tests (Must have):**
- [ ] Full user flow: signup → create report → view report → export
- [ ] Error cases: invalid input, network failure

**Manual testing (Must have):**
- [ ] 5+ reporters created successfully
- [ ] Evidence loaded and clickable
- [ ] Export functionality (PDF, markdown)
- [ ] Mobile view readable
- [ ] Dark mode (if implemented)

---

## Monitoring & Alerts

### What to Alert On

- [ ] API error rate >1% (5-minute window)
- [ ] Job failure rate >5% (hourly)
- [ ] API latency p95 >2 seconds
- [ ] Queue depth >100 jobs
- [ ] LLM API errors (classify immediately)
- [ ] Database connection failures
- [ ] Redis connection failures

### Alert Channels

- [ ] Critical: Phone call (not MVP)
- [ ] Errors: Slack #engineering
- [ ] Warnings: Email daily digest
- [ ] Metrics: Grafana dashboard (self-service)

---

## Documentation

- [ ] API routes documented (OpenAPI/Swagger)
- [ ] Database schema documented
- [ ] Deployment process documented
- [ ] Runbook: How to respond to common errors
- [ ] Incident log: Track downtime + resolution

---

## Launch Readiness Checklist

**Core:**
- [ ] All 5 steps of pipeline functional (discovery, ingestion, classification, clustering, report gen)
- [ ] Report UI beautiful and responsive
- [ ] Authentication working
- [ ] Payment working (Stripe integration)
- [ ] Database backed up and tested

**Production Hardening:**
- [ ] All security headers set
- [ ] Secrets in environment variables
- [ ] Logging configured
- [ ] Error handling graceful
- [ ] Rate limiting enabled
- [ ] Cost monitoring in place
- [ ] Health checks working
- [ ] Database connection pooling configured

**Testing:**
- [ ] 5+ end-to-end tests passed
- [ ] Mobile view tested
- [ ] Export functionality tested
- [ ] Error cases tested

**Documentation:**
- [ ] API docs written
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Runbook for common issues

**Operations:**
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] On-call rotation defined
- [ ] Incident response process documented

---

## Post-Launch Monitoring (Week 1)

- [ ] Monitor error rate (target: <0.5%)
- [ ] Monitor job failure rate (target: <1%)
- [ ] Monitor API latency (target: <500ms p95)
- [ ] Daily user feedback check
- [ ] Daily spend monitoring (LLM)
- [ ] Performance monitoring (Core Web Vitals)

**Rollback triggers:**
- Error rate >5%
- Job failure >10%
- Data corruption detected
- Security breach detected
- Database down >10 minutes
