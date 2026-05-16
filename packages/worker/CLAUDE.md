# @rivaleye/worker — Background Job Guide

Three long-running Bun processes (`scrape`, `llm`, `synth`). Each serves an Inngest endpoint; the Inngest dev server (local) routes events to them. Runs scrapers and report generation.

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
    inngest/client.ts    ← shared Inngest client
    scrape/index.ts      ← Bun.serve, registers scrape.fetch
    scrape/fetch.ts      ← scrape.fetch function
    llm/index.ts         ← Bun.serve, registers stage-a + stage-b
    llm/stage-a.ts       ← llm.stage-a function
    llm/stage-b.ts       ← llm.stage-b function
    llm/fan-in.ts        ← advisory-lock fan-in helper
    synth/index.ts       ← Bun.serve, registers synth.run
    synth/run.ts         ← synth.run function
    pipeline/            ← unchanged stage code (stage-a-extract.ts, ...)
    events/emit.ts       ← pipeline_events writer + pino mirror
    errors.ts            ← TransientError / PermanentError / RateLimitError
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
2. **Idempotent handlers.** Inngest retries. Every step must be safe to re-run — wrap side effects in `step.run`, upsert by `(platform, external_id)`, check terminal state before transitioning.
3. **Never block the event loop on a single big scrape.** Use per-function concurrency limits + per-step timeouts.
4. **Classify errors.** Throw `PermanentError` for non-retriable failures (Inngest converts to `NonRetriableError`); throw anything else for normal retries. Don't swallow.
5. **Same DB schema as api.** Drizzle schema lives in `packages/api/src/db/schema/`. Worker imports it. Never duplicate schema here.
6. **Env vars at boot, not mid-handler.** Read `process.env.*` once at module top level.

---

## 5. Open TODOs

- [ ] Move Drizzle schema into a shared spot so worker imports without depending on api's HTTP code.
- [ ] Production hosting story for Inngest (currently local-only via `inngest-cli dev`).
