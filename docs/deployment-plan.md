# RivalEye — Deployment Plan

**Audience:** DevOps engineer unfamiliar with the codebase.
**Purpose:** Evaluate and validate before any production infrastructure is provisioned.
**Last updated:** 2026-05-21

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Architecture diagram](#2-architecture-diagram)
3. [Process model](#3-process-model)
4. [Environment variables](#4-environment-variables)
5. [Dockerfile](#5-dockerfile)
6. [Option A — Railway (MVP)](#6-option-a--railway-mvp)
7. [Option B — GCP (scale)](#7-option-b--gcp-scale)
8. [Option C — AWS](#8-option-c--aws)
9. [Comparison matrix](#9-comparison-matrix)
10. [Database considerations](#10-database-considerations)
11. [CI/CD pipeline](#11-cicd-pipeline)
12. [Pre-launch checklist](#12-pre-launch-checklist)

---

## 1. System overview

RivalEye is a monorepo under `rivaleye-v3/` managed with pnpm workspaces and Turborepo. It ships three deployable processes:

| Process | Package | Role |
|---------|---------|------|
| **API** | `packages/api` | Bun + Elysia HTTP server on port 3001. Handles auth, report creation, job enqueueing, status polling. |
| **Worker** | `packages/worker` | Bun long-running background process. Polls Postgres for jobs using `SELECT FOR UPDATE SKIP LOCKED`. Runs scrapers and the LLM pipeline. No public port. |
| **Web** | `packages/web` | Vite + React SPA. Built to static files at deploy time. Served from a CDN or static host. |

Internal libraries (`packages/shared`, `packages/scrapers`) are not deployed independently — they are compiled into the API and worker builds.

**Database:** Supabase managed Postgres. Used for application data, the job queue, and auth. No Redis. No separate message broker. Postgres IS the queue.

**Job queue mechanism:** The worker runs three concurrent polling loops (`pollSourceJobs`, `pollSynthesisJobs`, `recoverStaleJobs`). Jobs are claimed with `SELECT FOR UPDATE SKIP LOCKED` inside a transaction, giving atomic assignment without a separate queue service.

**Auth:** better-auth on the same Postgres instance. Session signing key is `BETTER_AUTH_SECRET`.

**LLM:** OpenRouter API (DeepSeek by default). Anthropic Claude as a fallback. All LLM calls happen exclusively in the worker.

---

## 2. Architecture diagram

```
                          ┌───────────────────────────────┐
                          │        User's Browser          │
                          └──────────────┬────────────────┘
                                         │ HTTPS
                                         ▼
                          ┌───────────────────────────────┐
                          │         Web (SPA)              │
                          │   Vite + React, static files   │
                          │   CDN / static host            │
                          └──────────────┬────────────────┘
                                         │ HTTPS (VITE_API_URL)
                                         ▼
                          ┌───────────────────────────────┐
                          │         API (port 3001)        │
                          │   Bun + Elysia                 │
                          │   better-auth, Drizzle ORM     │
                          │   GET /health  ← health check  │
                          └──────┬───────────┬────────────┘
                                 │           │
                    reads/writes │           │ enqueues jobs
                                 ▼           ▼
                          ┌───────────────────────────────┐
                          │   Supabase Postgres            │
                          │   port 6543 (pgBouncer tx mode)│
                          │   schema managed by Drizzle    │
                          │   queue: report_platform_jobs  │
                          │          synthesis_jobs        │
                          └──────────────┬────────────────┘
                                         │ SELECT FOR UPDATE SKIP LOCKED
                                         ▼
                          ┌───────────────────────────────┐
                          │         Worker                 │
                          │   Bun, no public port          │
                          │   3 polling loops:             │
                          │    • pollSourceJobs (scrapers) │
                          │    • pollSynthesisJobs (LLM)   │
                          │    • recoverStaleJobs           │
                          └──────┬────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────────────┐
              │                  │                          │
              ▼                  ▼                          ▼
     ┌────────────────┐ ┌─────────────────┐    ┌────────────────────┐
     │ DIY scrapers   │ │ Apify (hostile) │    │ OpenRouter / Claude │
     │ Reddit         │ │ G2, Capterra    │    │ LLM clustering     │
     │ ProductHunt    │ │ LinkedIn, GMaps │    │ insight generation  │
     │ HackerNews     │ └─────────────────┘    └────────────────────┘
     │ Dev.to         │
     │ App Store      │
     │ Play Store     │
     └────────────────┘
```

---

## 3. Process model

### API

- Entry point: `packages/api/src/server.ts`
- Start command: `bun packages/api/src/server.ts`
- Port: `3001` (override with `PORT` env var)
- Health check: `GET /health` → `{"ok": true}`
- Responsibilities: validate HTTP input, read/write DB via Drizzle, enqueue jobs, return report status. Never calls scrapers or LLM directly.

### Worker

- Entry point: `packages/worker/src/pg-runner/index.ts`
- Start command: `bun packages/worker/src/pg-runner/index.ts`
- No HTTP port. Must run as a perpetual process.
- Worker identity: `hostname:pid:random` — stamped on every claimed job. Used for stale job recovery.
- Restart policy: must auto-restart immediately on crash (job lock expires via stale-job recovery loop; worker claiming the same job again is safe).
- Responsibilities: claim source jobs → run platform scrapers → write mentions to DB → trigger LLM pipeline → write report output.

### Web

- Built with: `pnpm --filter @rivaleye/web build`
- Output: `packages/web/dist/` — a directory of static HTML/CSS/JS
- `VITE_API_URL` must be set at build time (it is inlined into the JS bundle)
- Serve the `dist/` directory from any static host or CDN

---

## 4. Environment variables

All secrets are read from `process.env` at runtime. Never hardcode. Never commit `.env` files.

| Variable | Used by | Required | Purpose |
|----------|---------|----------|---------|
| `CONNECTION_STRING` | api, worker | Yes | Supabase Postgres. **Must use port 6543** (pgBouncer transaction mode). Example: `postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres?pgbouncer=true` |
| `BETTER_AUTH_SECRET` | api | Yes | Signing secret for better-auth sessions. Generate with `openssl rand -hex 32`. |
| `BETTER_AUTH_URL` | api | Yes | Public HTTPS URL of the API, e.g. `https://api.rivaleye.com`. Must match exactly — used for OAuth redirects. |
| `GOOGLE_CLIENT_ID` | api | Yes (for OAuth) | Google OAuth application client ID |
| `GOOGLE_CLIENT_SECRET` | api | Yes (for OAuth) | Google OAuth application client secret |
| `REPORT_PIPELINE_ENGINE` | api, worker | Yes | Set to `postgres` for production. The `inngest` value is for local development only. |
| `REDDIT_CLIENT_ID` | worker | Yes | Reddit OAuth application ID |
| `REDDIT_CLIENT_SECRET` | worker | Yes | Reddit OAuth application secret |
| `REDDIT_USER_AGENT` | worker | Yes | Reddit API user-agent string, e.g. `rivaleye/1.0` |
| `REDDIT_MAX_TERMS` | worker | No | Cap on search terms per report (default: 9). Use 2–3 in staging. |
| `REDDIT_MAX_POSTS_PER_TERM` | worker | No | Cap on posts per search term (default: 50). Use 10–15 in staging. |
| `PRODUCTHUNT_TOKEN` | worker | Yes | ProductHunt GraphQL API token |
| `X_API_BEARER` | worker | No | X (Twitter) API bearer token (Basic tier or above) |
| `APIFY_TOKEN` | worker | Yes | Apify API token — required for G2, Capterra, LinkedIn, GMaps scrapers |
| `GOOGLE_PLACES_API_KEY` | worker | No | Alternative to Apify for Google Maps reviews |
| `TRUSTPILOT_API_KEY` | worker | No | Trustpilot API key |
| `OPENROUTER_API_KEY` | worker | Yes | OpenRouter API key for LLM calls |
| `OPENROUTER_MODEL` | worker | No | Model slug. Defaults to `deepseek/deepseek-chat` |
| `ANTHROPIC_API_KEY` | worker | No | Fallback LLM key (Claude via Anthropic API) |
| `VITE_API_URL` | web (build time) | Yes | API base URL baked into the SPA bundle. E.g. `https://api.rivaleye.com` |

> **pgBouncer note:** Drizzle requires `?pgbouncer=true` appended to the connection string when using transaction-mode pgBouncer (port 6543). Prepared statements must be disabled — the pgBouncer transaction mode does not support them. Drizzle handles this correctly when the flag is present.

---

## 5. Dockerfile

One base image is shared between the API and worker. The web package produces static files and does not need a container runtime — it is built in CI and uploaded to the static host directly.

```dockerfile
# syntax=docker/dockerfile:1

# ── Base: install all workspace dependencies ─────────────────────────────────
FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace manifests first so Docker layer-caches the install step
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/api/package.json       packages/api/
COPY packages/worker/package.json    packages/worker/
COPY packages/scrapers/package.json  packages/scrapers/
COPY packages/shared/package.json    packages/shared/

# Install pnpm and all workspace dependencies
RUN npm install -g pnpm@9 && pnpm install --frozen-lockfile

# Copy source after install to avoid busting the cache on every code change
COPY packages/ packages/

# ── API image ─────────────────────────────────────────────────────────────────
FROM base AS api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
CMD ["bun", "packages/api/src/server.ts"]

# ── Worker image ──────────────────────────────────────────────────────────────
FROM base AS worker
# No EXPOSE — worker has no public port
# Restart on crash is handled by the platform (Railway restart policy /
# Cloud Run --min-instances / ECS restart policy)
CMD ["bun", "packages/worker/src/pg-runner/index.ts"]
```

**Build commands:**

```sh
# Build API image
docker build --target api -t rivaleye-api:latest .

# Build Worker image
docker build --target worker -t rivaleye-worker:latest .
```

> The web SPA is not containerized. Run `pnpm --filter @rivaleye/web build` in CI and deploy the resulting `packages/web/dist/` directory to your static host.

---

## 6. Option A — Railway (MVP)

**Recommended starting point.** Lowest ops overhead. Suitable until the team exceeds ~500 reports/day.

### Service layout

| Service name | Type | Image source | Public port |
|---|---|---|---|
| `rivaleye-api` | Web service | Dockerfile target `api` | 443 → 3001 |
| `rivaleye-worker` | Worker service | Dockerfile target `worker` | None |
| `rivaleye-web` | Static site | `packages/web/dist/` | 443 |

### Setup steps

1. Create a new Railway project.
2. Add a **shared variable group** containing all env vars from §4. Link it to both `rivaleye-api` and `rivaleye-worker`.
3. Deploy `rivaleye-api` from the GitHub repo, Dockerfile target `api`. Set:
   - **Pre-deploy command:** `pnpm db:migrate` — runs Drizzle migrations before the new API container starts accepting traffic.
   - **Health check path:** `GET /health`
   - **Restart policy:** Always restart on crash.
4. Deploy `rivaleye-worker` from the same repo, Dockerfile target `worker`. Set:
   - **Service type:** Worker (no public port, no health check path needed).
   - **Restart policy:** Always restart on crash — critical for the polling loop.
5. Deploy `rivaleye-web` as a static site. Configure the build command `pnpm --filter @rivaleye/web build` and the publish directory `packages/web/dist`. Set `VITE_API_URL` in the web service's env vars before the build runs.
6. Point your domain: `api.rivaleye.com` → `rivaleye-api`, `app.rivaleye.com` → `rivaleye-web`.

### Pros

- Single dashboard for all three services
- Automatic HTTPS, built-in deploy previews
- Shared env groups avoid variable drift between api and worker
- Pre-deploy command makes migration ordering explicit
- No Docker registry to manage

### Cons

- Less control over networking and egress IPs (matters if any upstream API whitelists IPs)
- Vertical scaling only — no horizontal pod autoscaling
- Railway's cold-start behaviour on the worker service must be validated
- Vendor lock-in at the platform layer

**Estimated cost:** $20–40/month at MVP scale.

---

## 7. Option B — GCP (scale)

**Recommended path when Railway becomes a bottleneck.** Keeps the database latency low by co-locating compute in the same region as Supabase.

Supabase defaults to `us-east-1`. If your project is in a different region, choose the matching Cloud Run region. Tokyo (`asia-northeast1`) is listed here as an example — confirm your Supabase project region first.

### Service layout

| Component | GCP product | Notes |
|---|---|---|
| Web | Firebase Hosting | Free global CDN, instant cache invalidation on deploy |
| API | Cloud Run | Region: match Supabase. Min instances: 1 to avoid auth cold starts. |
| Worker | Cloud Run Jobs (always-on) | Min instances: 1. Polling process — never exits normally. |
| Secrets | Secret Manager | One secret per env var. Mounted as env vars at container startup. |
| Container registry | Artifact Registry | `us-docker.pkg.dev/[project]/rivaleye/[image]:[sha]` |
| CI/CD | Cloud Build | Triggered on push to `main` |

### Cloud Run configuration — API

```yaml
# cloud-run-api.yaml (reference — adapt to gcloud CLI or Terraform)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: rivaleye-api
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/execution-environment: gen2
    spec:
      timeoutSeconds: 3600
      containers:
        - image: REGION-docker.pkg.dev/PROJECT/rivaleye/api:SHA
          ports:
            - containerPort: 4000
          resources:
            limits:
              memory: 512Mi
              cpu: "1"
          env:
            - name: PORT
              value: "4000"
          # Remaining env vars injected from Secret Manager via gcloud run deploy --set-secrets
      serviceAccountName: rivaleye-api-sa@PROJECT.iam.gserviceaccount.com
```

### Cloud Run Job configuration — Worker

```yaml
# worker runs as a Cloud Run Job with --min-instances 1
# It is not a request-serving service — it polls the DB continuously
gcloud run jobs create rivaleye-worker \
  --image REGION-docker.pkg.dev/PROJECT/rivaleye/worker:SHA \
  --region REGION \
  --min-instances 1 \
  --memory 512Mi \
  --cpu 0.5 \
  --parallelism 1 \
  --set-secrets CONNECTION_STRING=rivaleye-connection-string:latest,...
```

> Cloud Run Jobs with `--min-instances 1` keep the container warm. Because the worker's polling loop never exits on its own, the container runs indefinitely — equivalent to a background service.

### Pre-deploy migration

In Cloud Build, run migrations as a build step before deploying the API image:

```yaml
# cloudbuild.yaml (abbreviated)
steps:
  - name: oven/bun:1
    entrypoint: sh
    args:
      - -c
      - pnpm install --frozen-lockfile && pnpm db:migrate
    secretEnv: [CONNECTION_STRING]

  - name: gcr.io/cloud-builders/docker
    args: [build, --target, api, -t, "$_IMAGE_API", .]

  - name: gcr.io/cloud-builders/gcloud
    args: [run, deploy, rivaleye-api, --image, "$_IMAGE_API", ...]

  # Worker deploy follows ...
```

### Firebase Hosting — Web

```sh
# In CI after building the SPA:
pnpm --filter @rivaleye/web build
firebase deploy --only hosting
```

Configure `firebase.json` to serve `packages/web/dist` and add a catch-all rewrite to `index.html` for client-side routing.

### Pros

- Regional co-location with Supabase minimises DB round-trip latency
- Cloud Run auto-scales the API under load; worker stays at one instance
- Firebase Hosting is free for static files with global CDN
- Secret Manager provides centralised, auditable secret rotation
- Full observability via Cloud Logging and Cloud Monitoring

### Cons

- Higher setup complexity (IAM roles, service accounts, Artifact Registry)
- Cloud Run Jobs' always-on model is a less common pattern — validate restart behaviour on container crash
- Firebase Hosting adds a second deployment target

**Estimated cost:** $20–40/month at MVP scale. Increases predictably with Cloud Run request volume.

---

## 8. Option C — AWS

**Viable alternative if the team already has AWS infrastructure or credits.**

### Service layout

| Component | AWS product | Notes |
|---|---|---|
| Web | S3 + CloudFront | S3 bucket (static website mode), CloudFront distribution in front |
| API | App Runner | Managed container runtime, auto-scales from source image in ECR |
| Worker | ECS Fargate | Long-running task definition, 0.25 vCPU / 512 MB, desired count: 1 |
| Secrets | AWS Secrets Manager | Injected into tasks as env vars via task role |
| Container registry | Amazon ECR | One repo per image (`rivaleye-api`, `rivaleye-worker`) |
| CI/CD | GitHub Actions | Build → push to ECR → trigger App Runner + ECS deploy |

### ECS Fargate — Worker task definition (excerpt)

```json
{
  "family": "rivaleye-worker",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "networkMode": "awsvpc",
  "containerDefinitions": [{
    "name": "worker",
    "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/rivaleye-worker:latest",
    "essential": true,
    "secrets": [
      { "name": "CONNECTION_STRING", "valueFrom": "arn:aws:secretsmanager:..." }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/rivaleye-worker",
        "awslogs-region": "REGION",
        "awslogs-stream-prefix": "worker"
      }
    }
  }],
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/rivaleye-worker-task-role"
}
```

Set the ECS service's `desiredCount` to 1 and enable ECS Service Connect for internal networking if needed. Set the ECS deployment circuit breaker so that failed deployments roll back automatically.

### Pros

- App Runner is the simplest managed container runtime on AWS
- ECS Fargate with desired count 1 is a straightforward long-running worker model
- Tight integration with existing AWS infrastructure (VPCs, IAM, etc.)
- CloudFront provides a mature global CDN

### Cons

- Highest setup complexity of the three options
- App Runner has less fine-grained scaling control than Cloud Run
- ECR + ECS + App Runner means three separate deployment pipelines to maintain
- AWS Secrets Manager costs $0.40/secret/month — adds up with many variables

**Estimated cost:** $40–70/month at MVP scale.

---

## 9. Comparison matrix

| Criterion | Railway | GCP | AWS |
|-----------|---------|-----|-----|
| Setup time | ~2 hours | ~1 day | ~1–2 days |
| Ops overhead | Minimal | Medium | Medium–High |
| Monthly cost (MVP) | $20–40 | $20–40 | $40–70 |
| Horizontal scale | No | Yes (Cloud Run) | Yes (ECS) |
| DB region co-location | Depends on plan | Explicit | Depends on region |
| Secret management | Env groups | Secret Manager | Secrets Manager |
| Static CDN | Built-in | Firebase Hosting | S3 + CloudFront |
| Worker restart on crash | Platform restart policy | Cloud Run Job min-instances | ECS restart policy |
| CI/CD complexity | Low | Medium | High |
| Recommended for | MVP / < 6 months | Growth / team scale | Existing AWS shops |

**Recommendation:** Start with Railway (Option A). Migrate to GCP (Option B) if you need horizontal scaling of the API, multi-region reads, or granular IAM for a larger team.

---

## 10. Database considerations

### pgBouncer transaction mode

The `CONNECTION_STRING` must point to Supabase's pgBouncer endpoint on **port 6543**, not the direct Postgres port 5432. Append `?pgbouncer=true` to the connection string to disable prepared statements, which are not supported in pgBouncer transaction mode.

```
postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres?pgbouncer=true
```

### Connection pool sizing

The worker runs three polling loops. The API serves concurrent HTTP requests. Drizzle opens a connection pool per process. With default pool sizes, two processes may attempt to open 20–30 connections. Supabase free-tier allows 60; paid plans allow more.

Set `max` on each Drizzle pool instance to 15 to stay within budget:

```ts
// packages/api/src/db/client.ts and packages/worker/src/db.ts
const pool = new Pool({ connectionString, max: 15 });
```

### Drizzle migrations

Migrations live in `packages/api/drizzle/`. They are plain SQL files generated by `pnpm db:generate` and applied by `pnpm db:migrate`.

**Rule:** Run `pnpm db:migrate` as a pre-deploy step on the API service before the new API container starts. Never run migrations from the worker. If both processes start simultaneously after a deploy, the API container must be healthy (migrations applied) before traffic is routed to it, and the worker must not start processing jobs until the schema is current.

On Railway: use the pre-deploy command field.
On GCP: use a Cloud Build step that runs before the Cloud Run deploy step.
On AWS: run as a CodeBuild step or a one-off Fargate task before the service deploy.

### Backups

Supabase managed Postgres includes automated daily backups on paid plans. Enable Point-in-Time Recovery (PITR) before go-live.

---

## 11. CI/CD pipeline

The following describes the recommended GitHub Actions pipeline for any of the three platforms. Adapt the deploy step to the target platform.

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Build web SPA
        run: pnpm --filter @rivaleye/web build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

      # --- Platform-specific steps below ---
      # Railway: push triggers auto-deploy via Railway GitHub integration
      # GCP: docker build, push to Artifact Registry, gcloud run deploy
      # AWS: docker build, push to ECR, App Runner + ECS deploy
```

**Key ordering constraint:** The migration step must always complete before any new API container receives traffic. Use a deployment strategy (rolling with health check gate, or blue/green) that holds old pods live until the new API passes its `/health` check.

---

## 12. Pre-launch checklist

Work through this list top to bottom. Do not launch with any unchecked item in the first section.

### Blocking — must be resolved before go-live

- [ ] **CORS locked to production domain.** The API currently has CORS open. Set `origin` in `packages/api/src/config/cors.ts` to `https://app.rivaleye.com` (and remove `*`). Confirm no other origin is needed.
- [ ] **`BETTER_AUTH_URL` matches the production API domain exactly.** A mismatch causes OAuth redirect failures that are hard to debug in production. Verify by completing a Google OAuth flow end-to-end in staging.
- [ ] **`CONNECTION_STRING` uses port 6543 with `?pgbouncer=true`.** Using port 5432 directly under load will exhaust connections. Verify with a load test against staging.
- [ ] **Drizzle migration runs before API starts on every deploy.** Validate the pre-deploy command fires and completes successfully in the first staging deploy. Check logs for migration output.
- [ ] **Worker restart policy is configured.** The worker's polling loop must auto-restart immediately on crash. Validate by `kill -9`-ing the worker process in staging and confirming it comes back within 10 seconds.
- [ ] **`REPORT_PIPELINE_ENGINE=postgres` is set in production.** The `inngest` engine is for local development only. Deploying without this set will cause jobs to be silently skipped.
- [ ] **Supabase connection pool: max 15 per process.** Confirm pool size is configured in both `packages/api/src/db/client.ts` and `packages/worker/src/db.ts` before provisioning.
- [ ] **Secrets are stored in the platform secret manager, not in plain env vars checked into the repository.** Audit all `.env*` files — none should be committed.

### High priority — resolve in first week after launch

- [ ] **Rate limiting on `POST /reports`.** No rate limiting exists today. Add per-user limits (e.g. 5 reports per 10 minutes) to prevent runaway Apify and OpenRouter spend.
- [ ] **Error alerting.** Configure Sentry (preferred) or a log drain (Logtail, Datadog) before the first real user. Unhandled errors in the worker are currently logged to stdout only.
- [ ] **Supabase Point-in-Time Recovery enabled.** Enable PITR on the Supabase project before any user data is written.
- [ ] **GitHub → platform auto-deploy on push to `main`.** Confirm the pipeline completes end-to-end in staging before treating it as trusted.

### Operational hygiene — resolve within first month

- [ ] **Health check endpoint validated under load.** `GET /health` exists and returns `{"ok": true}`. Confirm the platform's health check is configured to hit this path and that unhealthy containers are replaced automatically.
- [ ] **Staging environment is isolated from production DB.** Do not share a Supabase project between staging and production.
- [ ] **Worker stale-job recovery interval tuned.** The `recoverStaleJobs` loop has a configurable timeout. Review the default and set it to a value that balances recovery speed against false-positive reclaims.
- [ ] **Log retention policy set.** Ensure logs are retained for at least 30 days for debugging support issues.
- [ ] **API Swagger UI disabled in production.** `@elysiajs/swagger` is enabled in the API. Disable it or restrict access in the production build to avoid exposing the internal API surface.
- [ ] **Apify and OpenRouter spend limits configured.** Both services have configurable spend caps in their dashboards. Set monthly limits before real users are onboarded.
- [ ] **Google OAuth redirect URIs updated.** Add `https://api.rivaleye.com/v1/auth/callback/google` to the allowed redirect URIs in the Google Cloud Console for the production OAuth app.

---

*Questions or corrections: open a GitHub issue tagged `infra` or update this file directly with a PR.*
