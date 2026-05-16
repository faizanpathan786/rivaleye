# Running RivalEye locally

Four processes need to run.

```sh
# Terminal 1 — Inngest dev server (queue + dev UI)
npx inngest-cli@latest dev

# Terminal 2 — everything via turbo
pnpm dev
```

`pnpm dev` boots:
- `@rivaleye/api`     on :3001
- `@rivaleye/web`     on :5173
- `@rivaleye/worker`  spawns three processes (scrape:3100, llm:3101, synth:3102) via concurrently

Open:
- App:           http://localhost:5173
- Inngest UI:    http://localhost:8288

Inngest auto-discovers the three worker endpoints on `/api/inngest` on each port.

## First-time setup

1. `pnpm install`
2. Copy `.env.example` to `.env` in each package and fill secrets (`CONNECTION_STRING`, `OPENROUTER_API_KEY`, scraper keys).
3. `pnpm db:migrate` to apply pending migrations (queue redesign added `0002_pipeline_events_and_extensions.sql` and `0003_cancelled_enum_values.sql`).

## Worker process model

| Process       | Port | Functions registered    | Concurrency       |
|---------------|------|-------------------------|-------------------|
| worker-scrape | 3100 | scrape.fetch            | 8 global          |
| worker-llm    | 3101 | llm.stage-a, llm.stage-b | 4 global          |
| worker-synth  | 3102 | synth.run               | 1 per reportId    |

## Smoke test

1. Create a report from the UI. Inngest UI shows 8 `scrape.fetch` events.
2. Tail events: `psql "$CONNECTION_STRING" -c "select created_at, platform, stage, event, attempt, duration_ms from pipeline_events where report_id = '<id>' order by id desc limit 30;"`
3. ScanRunning UI shows live events feed.
4. After all platforms terminal → `synth.run` fires → report completes.

## Forced failure / retry / crash recovery

See `docs/superpowers/specs/2026-05-16-queue-worker-redesign.md` §13 (Acceptance criteria) for the full matrix.
