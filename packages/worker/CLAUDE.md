# @rivaleye/worker — Background Job Guide

Long-running Bun process. Consumes jobs from `pg-boss` (Postgres-backed queue on the same Supabase DB). Runs scrapers and report generation.

Never serves HTTP. Never imported by `@rivaleye/api`. Api enqueues; worker consumes.

---

## 1. Stack

- **Runtime**: Bun.
- **Queue**: [pg-boss](https://github.com/timgit/pg-boss) on Supabase Postgres. No Redis.
- **DB**: same Drizzle client as api (via shared schema). Worker reads + writes mentions, updates report status.
- **Scrapers**: `@rivaleye/scrapers` — `getScraper(platformId)`.

---

## 2. Folder structure

```
packages/worker/
  src/
    index.ts             ← Entry. Boots pg-boss, registers handlers.
    queue.ts             ← pg-boss client + queue names + job type defs.
    jobs/
      scrape-platform.ts ← One (platform, query) scrape.
      generate-report.ts ← Fan-in: aggregate posts → LLM → save output.
    db/                  ← Worker-side DB helpers (mentions persist, report update).
    llm/                 ← LLM client wrappers (Claude/OpenAI).
```

---

## 3. Job model

Two queue types:

| Queue | Trigger | Work |
|---|---|---|
| `scrape-platform` | api enqueues N per report (one per platform) | Run one scraper, persist posts, mark sub-job done. |
| `generate-report` | enqueued after all `scrape-platform` jobs for the report complete | Load all posts, LLM cluster, write `reports.output`, set status. |

Fan-in pattern: track per-report scrape completion via `report_platform_jobs` table (status enum). When all `completed`, enqueue `generate-report`.

---

## 4. Hard rules

1. **Worker is the only thing that calls scrapers.** Api enqueues, worker runs.
2. **Idempotent handlers.** pg-boss retries. Every job must be safe to re-run — check before insert, upsert by `(platform, external_id)`.
3. **Never block the event loop on a single big scrape.** Use `batchSize` + per-job timeouts.
4. **Failures throw.** pg-boss handles retry + dead-letter. Don't swallow.
5. **Same DB schema as api.** Drizzle schema lives in `packages/api/src/db/schema/`. Worker imports it. Never duplicate schema here.
6. **Env vars at boot, not mid-handler.** Read `process.env.*` once in `queue.ts` / handler-module top level.

---

## 5. Open TODOs

- [ ] Move Drizzle schema into a shared spot (`packages/api/src/db/schema/` re-exported, or extract to `packages/db-schema`) so worker imports without depending on api's HTTP code.
- [ ] Add `report_platform_jobs` table to track fan-in completion.
- [ ] Wire LLM client (`packages/worker/src/llm/`) — Claude primary, OpenAI fallback.
- [ ] Decide retry policy per scraper (transient HTTP error vs auth failure vs banned).
- [ ] Add structured logging (pino) with `reportId` + `platform` in every log line.
