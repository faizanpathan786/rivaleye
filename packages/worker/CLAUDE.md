# @rivaleye/worker — Background Job Guide

Long-running Bun process. Consumes jobs from `pg-boss` (Postgres-backed queue on the same Supabase DB). Runs scrapers and report generation.

Never serves HTTP. Never imported by `@rivaleye/api`. Api enqueues; worker consumes.

---

## 1. Stack

- **Runtime**: Bun.
- **Queue**: [Inngest](https://www.inngest.com/) (self-hosted dev server locally via `npx inngest-cli@latest dev`). No Redis, no pg-boss.
- **Process model**: three independent Bun processes — `scrape`, `llm`, `synth` — each serving its own Inngest endpoint.
- **DB**: same Drizzle client as api (via shared schema). Worker reads + writes mentions, briefs, jobs, events.
- **Scrapers**: `@rivaleye/scrapers` — `getScraper(platformId)`.
- **Logging**: pino, JSON to stdout.

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

Inngest events (defined in `@rivaleye/shared/inngest-events`):

| Event           | Worker        | Concurrency               | Next                                |
|-----------------|---------------|---------------------------|-------------------------------------|
| `scrape.fetch`  | worker-scrape | 8 global, 1 per (rid,plat) | sends `llm.stage-a`                |
| `llm.stage-a`   | worker-llm    | 4 global                  | sends `llm.stage-b`                 |
| `llm.stage-b`   | worker-llm    | 4 global                  | fan-in check → may send `synth.run` |
| `synth.run`     | worker-synth  | 1 per `reportId`          | marks report complete               |

Fan-in uses `pg_advisory_xact_lock(hashtext(reportId))` to guarantee single enqueue.

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
