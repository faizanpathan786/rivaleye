# @rivaleye/worker — Background Job Guide

Two long-running Bun processes (`scrape`, `synth`). No HTTP server. No Inngest. No Redis. Queue is Postgres (`report_platform_jobs` + `synthesis_jobs`) polled via `SELECT FOR UPDATE SKIP LOCKED`.

Never serves HTTP. Never imported by `@rivaleye/api`. Api inserts jobs; worker polls and consumes them.

---

## 1. Stack

- **Runtime**: Bun.
- **Queue**: Postgres (`report_platform_jobs`, `synthesis_jobs`) polled by `pg-runner`. No Redis, no pg-boss, no Inngest.
- **Process model**: two independent Bun processes:
  - `scrape` (`src/scrape/index.ts`) — polls source jobs, runs scrapers + Stage A/B, triggers fan-in.
  - `synth` (`src/synth/index.ts`) — polls synthesis jobs, runs Stage C/D/E + persist.
- **DB**: same Drizzle client as api (schema in `packages/api/src/db/schema/`). Worker imports it directly.
- **Scrapers**: `@rivaleye/scrapers` — `getScraper(platformId)`.
- **Logging**: pino, JSON to stdout.

---

## 2. Folder structure

```
packages/worker/
  src/
    scrape/index.ts            ← entry point, calls mainScrapeOnly()
    synth/index.ts             ← entry point, calls mainSynthOnly()
    pg-runner/
      index.ts                 ← pollSourceJobs, pollSynthesisJobs, recoverStaleJobs,
                                  mainScrapeOnly(), mainSynthOnly()
      source-worker.ts         ← claims + processes one source job (scrape → Stage A/B → fan-in)
      synthesis-worker.ts      ← claims + processes one synthesis job (Stage C/D/E → persist)
      fan-in.ts                ← advisory-lock fan-in: creates synthesis job when all sources done
      recovery.ts              ← resets stale locked jobs; fail-forward if synthesis already started
      claim.ts                 ← SELECT FOR UPDATE SKIP LOCKED helpers
      types.ts                 ← WorkerConfig type
    pipeline/
      run.ts                   ← orchestrates Stage C → D → E → persist
      stage-a-extract.ts       ← per-platform Stage A LLM calls
      stage-b-summarize.ts     ← per-platform Stage B LLM calls
      stage-c-merge.ts         ← Stage C merge call
      stage-d-synth.ts         ← Stage D synth call
      stage-d-role.ts          ← Stage D role synthesis (5 parallel LLM calls)
      stage-e-refine.ts        ← Stage E refine call
      persist.ts               ← writes all sub-tables + report completion
      derive-stats.ts          ← platform stats + subreddit stats from mentions
    prompts/
      platform/<platform>/     ← per-platform extract + summarize prompt builders
      cross/                   ← merge-signals, refine, synth prompt builders
      role-sections/           ← founder/product/marketing/growth/overview prompts + schema
    events/emit.ts             ← writes pipeline_events rows
    db.ts                      ← Drizzle client (pool: max 5, idle 20s, connect 10s)
```

---

## 3. Job flow

```
API inserts report + N report_platform_jobs (one per selected platform)
  ↓
scrape worker polls report_platform_jobs (SELECT FOR UPDATE SKIP LOCKED)
  → runs scraper → Stage A (LLM extract) → Stage B (LLM summarize)
  → marks job completed → calls fanInCheck()

fanInCheck() (advisory lock on reportId):
  → if all platform jobs terminal AND at least one completed:
      INSERT synthesis_jobs ON CONFLICT DO NOTHING
  → if all failed: marks report failed

synth worker polls synthesis_jobs (SELECT FOR UPDATE SKIP LOCKED)
  → runs Stage C (merge) → Stage D (synth + role sections) → Stage E (refine)
  → persist to sub-tables → marks report completed
```

---

## 4. Concurrency + recovery

- Source jobs: max 8 concurrent per process by default (`WORKER_MAX_CONCURRENT_SOURCE`, clamped 1–20). Synthesis jobs: max 2 concurrent per process by default (`WORKER_MAX_CONCURRENT_SYNTHESIS`, clamped 1–5). Worker DB pool size via `WORKER_DB_POOL_MAX` (default 10, clamped 5–20).
- `recoverStaleJobs` runs every 30s in both workers.
  - Source jobs stale after 15 min → retry up to max_attempts; if synthesis already started, mark failed (fail-forward).
  - Synthesis jobs stale after 30 min → retry up to max_attempts.
- Advisory lock (`pg_advisory_xact_lock(hashtext(reportId))`) prevents duplicate synthesis job creation.

---

## 5. Hard rules

1. **Worker is the only thing that calls scrapers.** Api enqueues, worker runs.
2. **Idempotent.** Stage A/B results cached in `report_platform_briefs` — re-running skips LLM if brief exists. Stages C/D/E checkpointed in `report_pipeline_checkpoints`.
3. **Same DB schema as api.** Drizzle schema in `packages/api/src/db/schema/`. Never duplicate here.
4. **Env vars at boot.** Read `process.env.*` at module top level, not inside handlers.
5. **Log() uses global db outside transactions.** Never call `log()` inside a Drizzle transaction — it uses a separate connection and creates ghost entries if the transaction rolls back.

---

## 6. Dev commands

```sh
bun --watch --env-file=.env packages/worker/src/scrape/index.ts   # scrape worker
bun --watch --env-file=.env packages/worker/src/synth/index.ts    # synth worker
```

Both must run simultaneously for the full pipeline.

---

## 7. Open TODOs

- [ ] Move Drizzle schema into `packages/shared/` so worker doesn't import from `packages/api/`.
- [ ] Deploy: Railway (2 services) or Cloud Run Jobs. Set `PIPELINE_ENGINE=postgres`.
