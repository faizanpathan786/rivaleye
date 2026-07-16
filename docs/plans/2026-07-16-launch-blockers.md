# Launch Blockers Fix Plan

## Context

RivalEye deploys to a single GCP VM (`/home/faizan514pathan/rivaleye-v3`) via Cloud Build SSH. A launch audit found four blockers: (1) the worker processes are not managed by pm2 so deploys leave them running stale code and reboots may not restart them; (2) `cloudbuild.yaml` bypasses `deploy.sh`, skipping the type-check gate, and no migration step exists; (3) no way for an uptime monitor to detect a dead worker; (4) prod runs dev-mode processes (bun --watch, vite dev server) with no `NODE_ENV=production`. Additionally, scan throughput is capped at 5 concurrent platform jobs and strictly serial synthesis, so concurrent users queue for hours.

## Global Constraints

- **No product behavior changes.** API request/response shapes may only gain additive fields. The scan pipeline's state machine (statuses, retries, fan-in, recovery) must behave identically except where a task explicitly changes concurrency limits.
- **Linux target.** `ecosystem.config.cjs`, `deploy.sh`, `cloudbuild.yaml` run on the Linux VM with cwd `/home/faizan514pathan/rivaleye-v3`. Do not use Windows paths in them. The local dev machine is Windows — do not attempt to run pm2 or deploy scripts locally.
- **pnpm only**, no new production dependencies except what a task explicitly names.
- **Never run** seed scripts, migrations, or anything touching a database. Verification is `pnpm type-check` (per affected package) and existing unit tests (`vitest run`) only. Do not run `test:bun` / e2e tests (they need a live DB).
- Web app must remain reachable on port **4004**, landing on **3000**, api on **4000** — the VM's routing depends on these ports.
- Env files: api loads env via its start script (`bun --env-file=../../.env`); worker scripts must do the same. pm2 `env` blocks set only `NODE_ENV`.

## Task 1: Production process model in pm2 + worker start scripts

**Files:** `ecosystem.config.cjs`, `packages/worker/package.json`

1. In `packages/worker/package.json` add scripts (mirroring existing `dev:*` scripts but without `--watch`):
   - `"start:scrape": "bun --env-file=../../.env src/scrape/index.ts"`
   - `"start:synth": "bun --env-file=../../.env src/synth/index.ts"`
2. Rewrite `ecosystem.config.cjs` to define five apps, all with `cwd: '/home/faizan514pathan/rivaleye-v3'`, `watch: false`, `restart_delay: 4000`, `env: { NODE_ENV: 'production' }`, and **per-app log files** (`./logs/<name>-err.log`, `./logs/<name>-out.log` — currently all apps share one file, which interleaves logs):
   - `rivaleye-api`: `script: 'pnpm'`, `args: '--filter @rivaleye/api start'` (the existing `start` script runs plain `bun src/server.ts`, no watch), `max_memory_restart: '1G'`.
   - `rivaleye-web`: serve the **built** SPA instead of the vite dev server: `script: 'npx'`, `args: 'serve -s packages/web/dist -l 4004'`. `serve -s` provides the SPA fallback that react-router needs (http-server would 404 on deep links like `/reports/:id`). No memory cap needed.
   - `rivaleye-landing`: unchanged command (`npx http-server packages/landing/dist -p 3000 -c-1`), but give it its own log files.
   - `rivaleye-scrape`: `script: 'pnpm'`, `args: '--filter @rivaleye/worker start:scrape'`, `max_memory_restart: '1G'`.
   - `rivaleye-synth`: `script: 'pnpm'`, `args: '--filter @rivaleye/worker start:synth'`, `max_memory_restart: '1500M'` (it runs Puppeteer for PDF exports).
3. Keep the file valid CommonJS (`module.exports`). Do not add secrets or other env vars to the file — credentials live in the VM's `.env`.

**Verify:** `node -e "const c = require('./ecosystem.config.cjs'); console.log(c.apps.map(a => a.name))"` prints all five names; `pnpm --filter @rivaleye/worker type-check` still passes (package.json edit shouldn't affect it, but confirm no JSON syntax error via `pnpm install --lockfile-only` or simply `node -e "require('./packages/worker/package.json')"`).

## Task 2: Deploy pipeline goes through deploy.sh with migrations and log rotation

**Files:** `cloudbuild.yaml`, `deploy.sh`

1. `cloudbuild.yaml`: replace the inline build/restart command so the SSH command becomes exactly:
   `bash -lc 'cd /home/faizan514pathan/rivaleye-v3 && git reset --hard HEAD && git pull origin main && bash deploy.sh'`
   (keep `rm -f deploy-docker.sh` removal only if you like; it may be dropped — that file no longer exists). Keep the IAP tunnel flags and timeout unchanged.
2. `deploy.sh` additions, keeping existing order (install → type-check → build → reload):
   - After the build step and **before** `pm2 startOrReload`, add: `pnpm db:migrate` with a comment that Drizzle applies only committed migration files and is a no-op when none are pending.
   - After `pm2 save`, add idempotent log rotation setup:
     ```sh
     if ! pm2 describe pm2-logrotate > /dev/null 2>&1; then
       pm2 install pm2-logrotate
       pm2 set pm2-logrotate:max_size 50M
       pm2 set pm2-logrotate:retain 14
       pm2 set pm2-logrotate:compress true
     fi
     ```
3. Do not remove the type-check gate or the `NODE_OPTIONS` heap cap.

**Verify:** `bash -n deploy.sh` (syntax check). For cloudbuild.yaml, a YAML parse check (e.g. `node -e` with a YAML lib is NOT available — instead visually confirm indentation matches the existing structure, or use python if available: `python -c "import yaml,sys; yaml.safe_load(open('cloudbuild.yaml'))"`; if python is unavailable, `npx yaml-lint cloudbuild.yaml` or careful manual diff is acceptable).

## Task 3: Worker concurrency — parallel synthesis, env-tunable limits, bigger pool

**Files:** `packages/worker/src/pg-runner/index.ts`, `packages/worker/src/db.ts`

1. In `pg-runner/index.ts`:
   - Replace the hardcoded `const MAX_CONCURRENT_SOURCE = 5;` inside `pollSourceJobs` with a module-level `const MAX_CONCURRENT_SOURCE = clampInt(process.env.WORKER_MAX_CONCURRENT_SOURCE, 8, 1, 20);` where `clampInt(raw, def, min, max)` is a small helper: parse int, fall back to `def` on NaN, clamp to [min, max].
   - Convert `pollSynthesisJobs` to the same bounded fire-and-forget pattern `pollSourceJobs` already uses (an `activeJobs` counter, skip claiming when at limit, `.then/.catch/.finally` instead of `await`), with `const MAX_CONCURRENT_SYNTHESIS = clampInt(process.env.WORKER_MAX_CONCURRENT_SYNTHESIS, 2, 1, 5);`. Preserve ALL existing per-job semantics: the cancelled-report check, the "report not found → mark failed" branch, and the fact that `processSynthesisJob` handles its own retry/state transitions (errors are logged, never rethrown out of the loop). Preserve the `isConnectionError` backoff handling in the outer catch.
   - Log both limits in the startup log line.
2. In `db.ts`: `max: 5` → `max: clampedInt from process.env.WORKER_DB_POOL_MAX, default 10, min 5, max 20` (inline parse is fine; keep the existing `idle_timeout`, `connect_timeout`, `prepare: false` comments and values exactly).
3. **Do not** change claim.ts, recovery.ts, source-worker.ts, synthesis-worker.ts, or any state-machine logic.

**Verify:** `pnpm --filter @rivaleye/worker type-check` and `pnpm --filter @rivaleye/worker test` (vitest suite — must pass; it does not need a DB). Do NOT run `test:bun` or e2e tests.

## Task 4: Dead-worker detection on /health + loud warning on LLM model fallback

**Files:** `packages/api/src/server.ts`, `packages/shared/src/llm/config.ts`

1. Extend the `/health` endpoint in `server.ts`. Keep existing behavior (200 `{ ok: true, db: "up" }` / 503 on DB failure) and add a `queue` field computed in the same handler:
   - Query the oldest row in `report_platform_jobs` with `status = 'queued'` and `run_after <= now()` (import the table from `./db/schema/pipeline` — it is exported there; `synthesis_jobs` too). Same for `synthesis_jobs`. Use Drizzle (`min(created_at)` or order-by-limit-1).
   - If the oldest eligible queued job in either table is older than **15 minutes**, set `queue: "stalled"`, else `queue: "ok"`. Include `oldest_queued_seconds` (number | null).
   - Response stays HTTP 200 when the DB is up, even if stalled — the field is for keyword-matching uptime monitors (a stalled queue means the worker is dead, not the API). Final healthy shape: `{ ok: true, db: "up", queue: "ok" | "stalled", oldest_queued_seconds: number | null }`.
   - Wrap the queue queries in their own try/catch: if they fail, report `queue: "unknown"` — never let the queue check break the DB health signal.
2. In `packages/shared/src/llm/config.ts`: when `process.env.OPENROUTER_MODEL` is unset, emit `console.warn("[llm] OPENROUTER_MODEL is not set — falling back to free-tier model '...' which is heavily rate-limited. Set OPENROUTER_MODEL for production.")` at module load (only when unset). Keep the same fallback value so nothing breaks.

**Verify:** `pnpm --filter @rivaleye/api type-check` and `pnpm --filter @rivaleye/shared type-check` (if shared has no type-check script, `pnpm type-check` at root). Do not start the server or hit a DB.
