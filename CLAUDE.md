# RivalEye — Project Guide for Agents

Source of truth for repo layout, conventions, and hard rules. Read before non-trivial changes. Update when conventions change.

---

## 1. What this repo is

The RivalEye monorepo. RivalEye is the **user-perception layer of competitor research** — it helps SaaS teams understand what a competitor's users actually say in public, and turn that into product, positioning, and growth decisions.

**One-liner:** See what users really think about your competitors — what they love, what they hate, what they want next, and who may be ready to switch.

**MVP scope:** a user enters a competitor → workers pull public discussions from multiple platforms in parallel → LLM clusters them into four core signal types — **Love, Pain, Gap, Switch** — → user gets a Competitor Perception Report with quotes, source links, and recommended actions. The first goal is one genuinely useful report, not a big dashboard or every-platform monitoring.

> **Read `docs/product-goal.md` before any non-trivial product, scope, or roadmap decision.** It is the canonical product vision and north star. Note the framing is four signal types — older code/docs may use pain-only ("Competitor Pain Report") language.

---

## 2. Stack

- **Package manager**: [pnpm](https://pnpm.io/) workspaces (>=9). Never use `npm` or `yarn`.
- **Monorepo runner**: [Turborepo](https://turbo.build/). Use `pnpm dev`, `pnpm build`, etc. — never run package commands from root without `turbo`/`pnpm --filter`.
- **Backend runtime**: [Bun](https://bun.sh/). Use `bun` for `apps/api` scripts.
- **Backend framework**: [Elysia](https://elysiajs.com/).
- **Database**: PostgreSQL on **Supabase** (managed Postgres only — no Supabase Auth, no supabase-js, no RLS magic).
- **Migrations**: [Drizzle ORM](https://orm.drizzle.team/) — **non-negotiable**. All schema lives in `packages/api/src/db/`. Never modify DB schema by hand.
- **Auth**: [better-auth](https://www.better-auth.com/) on the same Supabase Postgres. No Supabase Auth.
- **Frontend**: Vite + React + TypeScript + Tailwind + shadcn/ui (Radix primitives). No Next.js, no MUI, no Minimals template.
- **Background jobs**: a **custom Postgres-table queue** (`pg-runner`, `packages/worker/src/pg-runner/`) on the same Supabase Postgres — NOT pg-boss, NOT Redis, NOT Inngest (those are legacy/removed). Jobs live in `report_platform_jobs` (fan-out, one per platform×competitor), `synthesis_jobs` (fan-in), and `report_pdf_jobs` (PDF export), claimed via `SELECT … FOR UPDATE SKIP LOCKED`. Workers are horizontally scalable (SKIP LOCKED means N instances never double-claim); graceful SIGTERM shutdown drains in-flight jobs and releases locks; a stale-recovery loop (`recovery.ts`, respects `max_attempts`, fail-forward, lock-guarded) re-queues jobs abandoned by a hard crash. See `packages/worker/CLAUDE.md`.
- **Scrapers**: per-platform implementations in `packages/scrapers/`. Hostile platforms (LinkedIn, G2, Capterra, Twitter, Gmaps) wrap 3rd-party providers (Apify, X API, Places API). DIY scrapers (Reddit, ProductHunt, AppStore, PlayStore) live fully in-repo.

---

## 3. Repo layout

```
rivaleye-v3/
  CLAUDE.md                  ← this file (monorepo-wide rules)
  package.json               ← root scripts (turbo wrappers)
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json         ← shared compiler options
  .env.example
  .gitignore
  docs/                      ← PRD, architecture notes (port from legacy as needed)
  packages/
    api/                     ← Bun + Elysia + Drizzle + better-auth. HTTP only; enqueues jobs.
      CLAUDE.md
      src/
      drizzle/               ← generated migrations
      drizzle.config.ts
    worker/                  ← Bun process. Consumes pg-boss queues. Runs scrapers + LLM.
      CLAUDE.md
      src/
    scrapers/                ← One Scraper interface, one impl per platform.
      CLAUDE.md
      src/
        reddit/ g2/ capterra/ twitter/ linkedin/ producthunt/ appstore/ playstore/ gmaps/
    web/                     ← Vite + React + Tailwind + shadcn.
      CLAUDE.md
      src/
    shared/                  ← Zod schemas, types, constants. Used by api+worker+web.
      src/
```

**Adding a package**: create folder under `packages/`, add `package.json` with name `@rivaleye/<name>`, mirror an existing package's `tsconfig.json` extending `../../tsconfig.base.json`. Add to relevant `turbo.json` task list if it has new task names.

---

## 4. Workspace dependency rules

- Internal packages reference each other via `"@rivaleye/<name>": "workspace:*"` in `dependencies`.
- Never duplicate a dependency across packages when one can live in `shared/` and be re-exported.
- Keep `devDependencies` (TS, eslint, prettier) at the **root** when shared. Only put a dev dep in a package when it's package-specific (e.g. `drizzle-kit` in `api/`, `vite` in `web/`).
- Never add a package-level lockfile. The repo has **one** `pnpm-lock.yaml` at the root.

---

## 5. Legacy code

The previous implementation is preserved on the `archive/legacy-v1` branch and **not merged back**. Treat it as read-only reference. When porting code from legacy:

1. Cherry-pick logic (Reddit normalization, LLM prompts, schema ideas) — never the file structure.
2. Every port must be a rewrite that matches current conventions in this CLAUDE.md.
3. Add a one-line PR description: "ported from archive/legacy-v1: <file>".
4. Never `git checkout archive/legacy-v1 -- <path>` to copy verbatim.

---

## 6. Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `CONNECTION_STRING` | api | Supabase Postgres connection string |
| `BETTER_AUTH_SECRET` | api | better-auth signing secret |
| `BETTER_AUTH_URL` | api | better-auth base URL (e.g. `http://localhost:4000`) |
| `REDDIT_CLIENT_ID` | worker (scrapers/reddit) | Reddit app id |
| `REDDIT_CLIENT_SECRET` | worker (scrapers/reddit) | Reddit app secret |
| `REDDIT_USER_AGENT` | worker (scrapers/reddit) | Reddit API user-agent |
| `PRODUCTHUNT_TOKEN` | worker (scrapers/producthunt) | Product Hunt GraphQL API token |
| `X_API_BEARER` | worker (scrapers/twitter) | X (Twitter) API bearer (Basic tier or higher) |
| `APIFY_TOKEN` | worker (scrapers/g2, capterra, linkedin, gmaps) | Apify API token for hostile platforms |
| `GOOGLE_PLACES_API_KEY` | worker (scrapers/gmaps) | Optional alternative to Apify for gmaps |
| `ANTHROPIC_API_KEY` | worker | Claude API key for clustering/insight LLM calls |
| `OPENAI_API_KEY` | worker | Fallback / embedding model key |
| `OPENROUTER_API_KEY` | api + worker (shared/llm) | OpenRouter API key for LLM calls |
| `OPENROUTER_MODEL` | api + worker (shared/llm) | OpenRouter model slug, defaults to `deepseek/deepseek-chat` |
| `TRUSTPILOT_API_KEY` | worker (scrapers/trustpilot) | Trustpilot API key |
| `VITE_API_URL` | web | Base URL of the api server |

Always read from `process.env` / `import.meta.env`. Never hardcode. Never commit `.env*` files. Keep `.env.example` synced when adding new vars.

> **`.env.example` is the source of truth for the full variable list**, including worker tuning (`WORKER_MAX_CONCURRENT_*`, `WORKER_DB_POOL_MAX`, `WORKER_SHUTDOWN_DRAIN_MS`, `WORKER_HEARTBEAT_INTERVAL_MS`, `SCRAPER_FETCH_TIMEOUT_MS`), cost controls (`LLM_PROVIDER`, `MAX_LLM_TOKENS_PER_REPORT`, `MAX_CLUSTERS_PER_TYPE`), rate limits (`REPORT_RETRY_MAX_PER_HOUR`, `PDF_EXPORT_MAX_PER_HOUR`), observability (`METRICS_TOKEN`, `WORKER_DEAD_THRESHOLD_SECONDS`, `ENABLE_ALERTS`, `ALERT_*`, `SMTP_*`), the zero-cost path (`SCRAPER_PROVIDER`, `LLM_FIXTURES_DIR`, `SCRAPER_FIXTURES_DIR`, `MOCK_*_LATENCY_MS`), and retention (`RETENTION_*_DAYS`). The table above lists only the core secrets.

---

## 6b. Operations: verification, cost, observability, deploy

**Zero-cost verification path.** The entire pipeline runs end-to-end with no OpenRouter or paid-scraper spend:
- `LLM_PROVIDER=mock` → deterministic `MockLlmClient` (`packages/shared/src/llm/`) that replays fixtures (`LLM_FIXTURES_DIR`) or generates schema-valid output from the request's Zod schema. `LLM_PROVIDER=openrouter` (default) hits the real API.
- `SCRAPER_PROVIDER=fixtures` → `FixtureScraper` (`packages/scrapers/src/fixtures/`) replays recorded posts (`SCRAPER_FIXTURES_DIR`) or synthesizes deterministic ones. `SCRAPER_PROVIDER=real` (default) uses the live scrapers.
- Local e2e: `packages/worker/src/scripts/e2e-local.ts` (seed a report → poll to completion). Load test: `packages/worker/src/scripts/load-test.ts`. Both run against a local Postgres, never the prod/Supabase DB. ALWAYS use the mock path for tests/load — real-provider runs cost money.

**Cost controls.** Every LLM call goes through `createLlmClient()` → `CostTrackingLlmClient`, which records usage to the `llm_usage` table (attributed to the report via AsyncLocalStorage — no per-call-site wiring) and enforces `MAX_LLM_TOKENS_PER_REPORT` (throws `LlmBudgetError`, treated as permanent). `assembleSignalPool` caps clusters per signal type (`MAX_CLUSTERS_PER_TYPE`) to bound prompt size. In production a missing `OPENROUTER_MODEL` throws at boot (no silent free-tier fallback). Per-scan cost is visible in `llm_usage` and `/v1/metrics`.

**Observability.** Workers upsert `worker_heartbeats` every ~10s. The API exposes `GET /v1/metrics` (JSON) and `/v1/metrics/prometheus` (queue depth by status/age, worker liveness, LLM cost/tokens 1h/24h). `/health` reports DB reachability + real dead-worker detection (heartbeat age, not job-activity inference) and 503s when a role's queue has a backlog but zero live workers. `alerting.service.ts` (enable with `ENABLE_ALERTS=true`) emails `ALERT_EMAIL` on dead-worker-with-backlog, stale queue, high LLM cost, or DB-down. **Compute timestamp ages in SQL** (`extract(epoch from now() - col)`), never JS `Date.now()` vs a tz-naive `timestamp` column — that drift silently broke dead-worker detection once.

**Deploy.** Atomic releases: build a new release dir out-of-line, health-gate the `pm2 reload`, auto-rollback the `current` symlink on failure. `deploy.sh` + `cloudbuild.yaml` + `scripts/` + `docs/deploy-runbook.md`. Migrations run pre-flip and must stay backward-compatible with the still-running old release during the flip window (expand/contract). Retention: `packages/worker/src/scripts/prune-retention.ts` (cron) bounds `report_logs`, `pipeline_events`, `report_pdf_jobs`, `llm_usage`.

**Safe operating envelope (measured, single VM, mock path).** With `WORKER_MAX_CONCURRENT_SOURCE=16` / `WORKER_MAX_CONCURRENT_SYNTHESIS=8` / `WORKER_DB_POOL_MAX=18`: ~45 reports/min sustained, 100 concurrent scans (500 queued jobs) drain in ~2.2 min with p95 ≈ 130s, zero failures. Throughput is bounded by worker concurrency (the tuning lever), not the DB pool — jobs hold a connection only briefly (I/O-bound on LLM/scraper waits), so even a pool of 5 didn't saturate. Scale past this by raising concurrency or adding a second worker VM (SKIP LOCKED makes multi-instance safe). Watch `/v1/metrics` `running` vs pool size to find the DB ceiling.

---

## 7. Dev commands

```sh
pnpm install                          # install all workspace deps
pnpm dev                              # run all packages in dev (turbo)
pnpm --filter @rivaleye/api dev       # api only
pnpm --filter @rivaleye/worker dev    # worker only
pnpm --filter @rivaleye/web dev       # frontend only
pnpm db:generate                      # drizzle migration from schema diff
pnpm db:migrate                       # apply pending migrations
pnpm db:studio                        # drizzle studio (DB browser)
pnpm build                            # build all packages
pnpm type-check                       # tsc --noEmit across workspace
pnpm lint                             # eslint across workspace
```

---

## 8. Coding conventions (repo-wide)

- **TypeScript strict mode**. Never disable strict checks. `noUncheckedIndexedAccess` is on.
- **Named exports** everywhere. No default exports except where a framework requires one (Vite entry, etc).
- **File naming**: kebab-case (`pain-report.ts`, `reddit-client.ts`).
- **No comments** unless the *why* is non-obvious. Good names explain the *what*.
- **Imports**: relative within a package (`./services/foo`); cross-package via `@rivaleye/<name>`.
- **Errors**: throw typed errors at boundaries; never swallow.
- **Validation**: validate at system boundaries (HTTP body, external API responses). Trust internal calls.
- **No `any`**. Use `unknown` + narrowing.

---

## 9. Hard rules for agents

1. **All DB schema changes go through Drizzle migrations.** No raw `ALTER TABLE` against any environment.
2. **Never touch `archive/legacy-v1`.** Port-by-rewrite, never copy.
3. **Never hardcode secrets, connection strings, or API keys.** Always env.
4. **Never put business logic in a route handler.** Controllers/routes call services. (See `packages/api/CLAUDE.md`.)
5. **Never put HTTP-level logic in a service.** Services return data; controllers shape responses.
6. **Elysia's type system is the API contract** — use `t.*` schemas on routes. Don't bypass with `any`.
7. **One lockfile.** No package-level `pnpm-lock.yaml`.
8. **No Supabase client.** Talk to Postgres via Drizzle only. Supabase is just managed Postgres for us.
9. **Permission-first** — before any new CRUD feature, define permission codes (e.g. `REPORTS_CREATE`, `REPORTS_VIEW`), seed them, and guard handlers with them. Never check role names in handlers.
10. **Api never runs scrapers or heavy LLM calls.** Api validates input, inserts job rows (`report_platform_jobs` etc.), and reads report status/output. All long work happens in `@rivaleye/worker`. If you're tempted to call a scraper from an api handler, stop — insert a job. (The one allowed API-path LLM call is bounded keyword expansion — 8s timeout, 1 attempt, falls back — never add unbounded LLM/scraper work to a handler.)
11. **`@rivaleye/scrapers` outputs `NormalizedPost` only.** No platform-specific fields leak past the scraper boundary. See `packages/scrapers/CLAUDE.md`.
12. **Hostile platforms = buy, never DIY.** LinkedIn, G2, Capterra, Gmaps reviews are routed through 3rd-party providers (Apify et al.) inside the scraper class. No headless-browser farms in this repo.
13. **CRITICAL: Never run a script or command that deletes or overwrites database data — in any environment, local or production — without asking first.** Before running ANY command that could delete, truncate, or modify database data (especially seed scripts, migrations, truncates), **STOP and ask the user explicitly**. Never assume, and never run it "just to check" or as a side effect of testing something else. This includes: database resets, seed scripts (e.g. `packages/api/src/scripts/seed.ts`, which truncates and reseeds core tables), truncate commands, schema migrations on live data. **Always warn about consequences first, then ask: "Do you want me to proceed? YES/NO"** — wait for explicit permission before executing.
14. **Before pushing to `main` or any shared branch, verify the code actually works and is conflict-free.** Run the relevant checks (`pnpm type-check`, `pnpm lint`, `pnpm build`, and/or the affected package's tests) and confirm the branch merges cleanly against the target (`git fetch` + check for conflicts) before pushing. Never push on the assumption that a change "should" work — verify it first.

---

## 10. Open questions / TODO

- [ ] Decide on tRPC vs plain REST between `web` and `api`. Default: REST with Elysia's type-exported client until a concrete need pushes us to tRPC.
- [ ] Choose LLM provider as primary (Claude vs OpenAI). Wire both via a small `llm-client` abstraction in `shared/`.
- [ ] Pick a Reddit access strategy (OAuth app vs public JSON endpoints). Document rate-limit budget in `packages/reddit-client/CLAUDE.md`.
- [ ] Test runner — Bun ships with `bun test`. Adopt once the first non-trivial service lands.

Update this section as decisions land.
