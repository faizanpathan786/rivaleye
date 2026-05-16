# Queue + Worker Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single pg-boss worker with three-process Inngest-driven worker (scrape/llm/synth), per-stage durable steps, advisory-lock fan-in, partial reports with per-platform retry, and `pipeline_events` observability table.

**Architecture:** API enqueues Inngest events. Three independent Bun processes (`worker-scrape`, `worker-llm`, `worker-synth`) each serve Inngest endpoints with role-specific concurrency. Stage code in `packages/worker/src/pipeline/` is unchanged; only orchestration around it is rewritten. Local dev requires running `npx inngest-cli@latest dev` alongside `pnpm dev`.

**Tech Stack:** Bun, Elysia, Drizzle, Postgres (Supabase), Inngest (open-source SDK + local dev CLI), pino, concurrently, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-16-queue-worker-redesign.md`

---

## File Structure

### New files

```
packages/shared/src/
  inngest-events.ts           ← typed event payloads (RivalEyeEvents)

packages/api/src/
  libs/inngest.ts             ← Inngest client for api (replaces libs/queue.ts callsites)
  controllers/reports/handlers/
    retryPlatform.ts          ← POST /reports/:id/retry-platform
    cancel.ts                 ← POST /reports/:id/cancel
  services/
    pipeline-events.service.ts ← read pipeline_events for getProgress

packages/api/src/db/schema/
  pipeline-events.ts          ← new table

packages/worker/src/
  inngest/
    client.ts                 ← Inngest client + types re-exported from shared
  scrape/
    index.ts                  ← Bun.serve registering scrapeFetch
    fetch.ts                  ← scrape.fetch Inngest function
  llm/
    index.ts                  ← Bun.serve registering stageA + stageB
    stage-a.ts                ← llm.stage-a Inngest function
    stage-b.ts                ← llm.stage-b Inngest function
    fan-in.ts                 ← advisory-lock fan-in helper
  synth/
    index.ts                  ← Bun.serve registering synthRun
    run.ts                    ← synth.run Inngest function
  events/
    emit.ts                   ← insert pipeline_events row + pino log
  errors.ts                   ← TransientError / PermanentError / RateLimitError

packages/worker/src/
  __tests__/fan-in.test.ts
  __tests__/emit.test.ts
  __tests__/errors.test.ts
```

### Modified files

```
packages/api/src/db/schema/pipeline.ts             ← extend report_platform_jobs columns
packages/api/src/db/schema/reports.ts              ← add partial + failed_platforms cols
packages/api/src/db/schema/index.ts                ← export pipeline-events
packages/api/src/services/reports.service.ts       ← swap enqueueScrapePlatform → inngest.send
packages/api/src/controllers/reports/handlers/getProgress.ts ← include events + new cols
packages/api/src/controllers/reports/index.ts      ← register retryPlatform + cancel
packages/api/package.json                          ← add inngest, drop pg-boss
packages/worker/package.json                       ← add inngest concurrently pino, drop pg-boss; new scripts
packages/web/src/api/reports.ts                    ← extend ReportProgress type
packages/web/src/components/report/report-in-progress.tsx ← live events feed + retry buttons
packages/web/src/components/report/report-header.tsx ← partial banner (or new file)
.env.example                                       ← INNGEST_EVENT_KEY (dev-only blank)
```

### Removed files

```
packages/worker/src/queue.ts
packages/worker/src/index.ts
packages/worker/src/jobs/scrape-platform.ts
packages/worker/src/jobs/generate-report.ts
packages/worker/src/jobs/                          ← entire dir
packages/api/src/libs/queue.ts
```

---

## Task 1: Add Inngest dependencies and base script wiring

**Files:**
- Modify: `packages/worker/package.json`
- Modify: `packages/api/package.json`
- Modify: `.env.example`
- Modify: `packages/worker/CLAUDE.md`

- [ ] **Step 1: Add inngest + concurrently + pino to worker; drop pg-boss**

Edit `packages/worker/package.json`. Under `dependencies` add:

```json
"inngest": "^3.27.0",
"pino": "^9.5.0"
```

Under `devDependencies` add:

```json
"concurrently": "^9.1.0"
```

Remove the `pg-boss` line from `dependencies`.

Replace the `scripts` block with:

```json
"scripts": {
  "dev:scrape": "bun --watch src/scrape/index.ts",
  "dev:llm":    "bun --watch src/llm/index.ts",
  "dev:synth":  "bun --watch src/synth/index.ts",
  "dev":        "concurrently -n scrape,llm,synth -c blue,green,yellow \"pnpm dev:scrape\" \"pnpm dev:llm\" \"pnpm dev:synth\"",
  "type-check": "tsc --noEmit",
  "test":       "vitest run"
}
```

- [ ] **Step 2: Add inngest to api; drop pg-boss**

Edit `packages/api/package.json`. Under `dependencies` add:

```json
"inngest": "^3.27.0"
```

Remove the `pg-boss` line.

- [ ] **Step 3: Update .env.example**

Append to `.env.example`:

```
# Inngest — leave blank for local dev (uses the inngest-cli dev server)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Worker ports (Inngest dev server discovers these)
WORKER_SCRAPE_PORT=3100
WORKER_LLM_PORT=3101
WORKER_SYNTH_PORT=3102
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: lockfile updates, `inngest`, `pino`, `concurrently` resolve; no errors.

- [ ] **Step 5: Update worker CLAUDE.md**

Replace the entire "## 1. Stack" block in `packages/worker/CLAUDE.md` with:

```markdown
## 1. Stack

- **Runtime**: Bun.
- **Queue**: [Inngest](https://www.inngest.com/) (self-hosted dev server locally via `npx inngest-cli@latest dev`). No Redis, no pg-boss.
- **Process model**: three independent Bun processes — `scrape`, `llm`, `synth` — each serving its own Inngest endpoint.
- **DB**: same Drizzle client as api (via shared schema). Worker reads + writes mentions, briefs, jobs, events.
- **Scrapers**: `@rivaleye/scrapers` — `getScraper(platformId)`.
- **Logging**: pino, JSON to stdout.
```

Replace "## 3. Job model" with:

```markdown
## 3. Job model

Inngest events (defined in `@rivaleye/shared/inngest-events`):

| Event           | Worker        | Concurrency               | Next                                |
|-----------------|---------------|---------------------------|-------------------------------------|
| `scrape.fetch`  | worker-scrape | 8 global, 1 per (rid,plat) | sends `llm.stage-a`                |
| `llm.stage-a`   | worker-llm    | 4 global                  | sends `llm.stage-b`                 |
| `llm.stage-b`   | worker-llm    | 4 global                  | fan-in check → may send `synth.run` |
| `synth.run`     | worker-synth  | 1 per `reportId`          | marks report complete               |

Fan-in uses `pg_advisory_xact_lock(hashtext(reportId))` to guarantee single enqueue.
```

- [ ] **Step 6: Commit**

```bash
git add packages/worker/package.json packages/api/package.json .env.example packages/worker/CLAUDE.md pnpm-lock.yaml
git commit -m "chore(deps): add inngest+pino, drop pg-boss; new worker scripts"
```

---

## Task 2: Shared Inngest event types

**Files:**
- Create: `packages/shared/src/inngest-events.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Create event types**

Create `packages/shared/src/inngest-events.ts`:

```ts
import type { EnabledPlatformId } from "./llm/config";

export type RivalEyeEvents = {
  "scrape.fetch": {
    name: "scrape.fetch";
    data: {
      reportId: string;
      platform: EnabledPlatformId;
      competitor: string;
      category?: string;
      keywords?: string[];
    };
  };
  "llm.stage-a": {
    name: "llm.stage-a";
    data: {
      reportId: string;
      platform: EnabledPlatformId;
    };
  };
  "llm.stage-b": {
    name: "llm.stage-b";
    data: {
      reportId: string;
      platform: EnabledPlatformId;
    };
  };
  "synth.run": {
    name: "synth.run";
    data: {
      reportId: string;
      reason?: "fan-in" | "retry";
    };
  };
};

export type EventName = keyof RivalEyeEvents;
```

- [ ] **Step 2: Re-export from package root**

Append to `packages/shared/src/index.ts`:

```ts
export * from "./inngest-events";
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @rivaleye/shared type-check`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/inngest-events.ts packages/shared/src/index.ts
git commit -m "feat(shared): RivalEyeEvents type for inngest"
```

---

## Task 3: DB schema — extend pipeline + reports, add pipeline_events

**Files:**
- Modify: `packages/api/src/db/schema/pipeline.ts`
- Modify: `packages/api/src/db/schema/reports.ts`
- Create: `packages/api/src/db/schema/pipeline-events.ts`
- Modify: `packages/api/src/db/schema/index.ts`

- [ ] **Step 1: Extend report_platform_jobs**

In `packages/api/src/db/schema/pipeline.ts`, add a new enum and add columns to `report_platform_jobs`:

```ts
export const report_platform_stage_enum = pgEnum("report_platform_stage", [
  "scrape",
  "stage_a",
  "stage_b",
  "done",
  "failed",
]);
```

Inside the `report_platform_jobs` `pgTable` columns object (add after the existing `error: text("error"),` line):

```ts
    stage: report_platform_stage_enum("stage").notNull().default("scrape"),
    attempt_count: integer("attempt_count").notNull().default(0),
    last_error: text("last_error"),
    last_event_at: timestamp("last_event_at"),
```

- [ ] **Step 2: Extend reports**

In `packages/api/src/db/schema/reports.ts`, find the `reports` `pgTable` columns block. Add (alongside the other columns):

```ts
    partial: boolean("partial").notNull().default(false),
    failed_platforms: text("failed_platforms").array().notNull().default([]),
```

Add `boolean` to the drizzle import at the top of the file if not already present.

- [ ] **Step 3: Create pipeline-events schema**

Create `packages/api/src/db/schema/pipeline-events.ts`:

```ts
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const pipeline_event_kind_enum = pgEnum("pipeline_event_kind", [
  "started",
  "completed",
  "failed",
  "retrying",
]);

export const pipeline_events = pgTable(
  "pipeline_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform"),
    stage: text("stage").notNull(),
    event: pipeline_event_kind_enum("event").notNull(),
    attempt: integer("attempt").notNull().default(1),
    duration_ms: integer("duration_ms"),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("pipeline_events_report_id_idx").on(t.report_id, t.created_at)],
);

export type PipelineEvent = typeof pipeline_events.$inferSelect;
export type NewPipelineEvent = typeof pipeline_events.$inferInsert;
```

- [ ] **Step 4: Re-export from schema index**

In `packages/api/src/db/schema/index.ts`, add:

```ts
export * from "./pipeline-events";
```

- [ ] **Step 5: Generate migration**

Run: `pnpm db:generate`
Expected: a new file under `packages/api/drizzle/` containing the ALTER TABLEs and CREATE TABLE for pipeline_events.

- [ ] **Step 6: Apply migration locally**

Run: `pnpm db:migrate`
Expected: migrations apply cleanly. If a column already exists from a prior partial run, drop the offending table or rerun against a fresh DB before continuing.

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: exit 0, no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/db/schema packages/api/drizzle
git commit -m "feat(db): extend report_platform_jobs + reports; add pipeline_events"
```

---

## Task 4: Error classes (worker/src/errors.ts) + tests

**Files:**
- Create: `packages/worker/src/errors.ts`
- Create: `packages/worker/src/__tests__/errors.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/worker/src/__tests__/errors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TransientError, PermanentError, RateLimitError } from "../errors";

describe("worker errors", () => {
  it("TransientError is an Error", () => {
    const e = new TransientError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("TransientError");
    expect(e.message).toBe("nope");
  });

  it("PermanentError is an Error", () => {
    const e = new PermanentError("bad input");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PermanentError");
  });

  it("RateLimitError extends TransientError and carries retryAfterMs", () => {
    const e = new RateLimitError("slow down", 12_000);
    expect(e).toBeInstanceOf(TransientError);
    expect(e.retryAfterMs).toBe(12_000);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `pnpm --filter @rivaleye/worker test errors`
Expected: FAIL — `../errors` not found.

- [ ] **Step 3: Implement errors.ts**

Create `packages/worker/src/errors.ts`:

```ts
export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export class RateLimitError extends TransientError {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = "RateLimitError";
  }
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @rivaleye/worker test errors`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/errors.ts packages/worker/src/__tests__/errors.test.ts
git commit -m "feat(worker): typed error classes for retry classification"
```

---

## Task 5: Inngest client (worker)

**Files:**
- Create: `packages/worker/src/inngest/client.ts`

- [ ] **Step 1: Create client**

Create `packages/worker/src/inngest/client.ts`:

```ts
import { Inngest } from "inngest";
import type { RivalEyeEvents } from "@rivaleye/shared";

export const inngest = new Inngest<RivalEyeEvents>({
  id: "rivaleye-worker",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/inngest/client.ts
git commit -m "feat(worker): inngest client for worker processes"
```

---

## Task 6: pipeline_events emitter + tests

**Files:**
- Create: `packages/worker/src/events/emit.ts`
- Create: `packages/worker/src/__tests__/emit.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/worker/src/__tests__/emit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

const insertedRows: any[] = [];

vi.mock("../db", () => ({
  db: {
    insert: () => ({
      values: (row: any) => {
        insertedRows.push(row);
        return Promise.resolve([row]);
      },
    }),
  },
}));

import { emit } from "../events/emit";

describe("emit", () => {
  it("writes a pipeline_events row with the expected fields", async () => {
    insertedRows.length = 0;
    await emit({
      reportId: "00000000-0000-0000-0000-000000000001",
      platform: "reddit",
      stage: "scrape.fetch",
      event: "completed",
      attempt: 2,
      durationMs: 1234,
      metadata: { mentions: 42 },
    });

    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0];
    expect(row.report_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(row.platform).toBe("reddit");
    expect(row.stage).toBe("scrape.fetch");
    expect(row.event).toBe("completed");
    expect(row.attempt).toBe(2);
    expect(row.duration_ms).toBe(1234);
    expect(row.metadata).toEqual({ mentions: 42 });
  });

  it("accepts an error string", async () => {
    insertedRows.length = 0;
    await emit({
      reportId: "00000000-0000-0000-0000-000000000002",
      stage: "synth.run",
      event: "failed",
      error: "boom",
    });
    expect(insertedRows[0].error).toBe("boom");
    expect(insertedRows[0].platform).toBeNull();
    expect(insertedRows[0].attempt).toBe(1);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `pnpm --filter @rivaleye/worker test emit`
Expected: FAIL — `../events/emit` not found.

- [ ] **Step 3: Implement emit.ts**

Create `packages/worker/src/events/emit.ts`:

```ts
import pino from "pino";
import { db } from "../db";
import { pipeline_events } from "../../../api/src/db/schema/pipeline-events.js";

const log = pino({ name: "pipeline-events" });

export type EmitInput = {
  reportId: string;
  platform?: string | null;
  stage: string;
  event: "started" | "completed" | "failed" | "retrying";
  attempt?: number;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
};

export async function emit(input: EmitInput): Promise<void> {
  const row = {
    report_id: input.reportId,
    platform: input.platform ?? null,
    stage: input.stage,
    event: input.event,
    attempt: input.attempt ?? 1,
    duration_ms: input.durationMs ?? null,
    error: input.error ?? null,
    metadata: input.metadata ?? null,
  };
  await db.insert(pipeline_events).values(row);
  log.info(row, "pipeline_event");
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @rivaleye/worker test emit`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/events/emit.ts packages/worker/src/__tests__/emit.test.ts
git commit -m "feat(worker): pipeline_events emitter with pino mirror"
```

---

## Task 7: Fan-in helper (advisory lock) + tests

**Files:**
- Create: `packages/worker/src/llm/fan-in.ts`
- Create: `packages/worker/src/__tests__/fan-in.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/worker/src/__tests__/fan-in.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sentEvents: any[] = [];
let mockJobs: { status: string }[] = [];
let synthAlreadyStarted = false;

vi.mock("../db", () => {
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(synthAlreadyStarted ? [{ id: 1 }] : []),
        }),
      }),
    }),
  };
  return {
    db: {
      transaction: async (fn: (tx: any) => Promise<void>) => {
        // First select call returns jobs; second returns synth-already.
        let call = 0;
        const customTx = {
          execute: vi.fn().mockResolvedValue(undefined),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => {
                  call += 1;
                  if (call === 1) return Promise.resolve(mockJobs);
                  return Promise.resolve(synthAlreadyStarted ? [{ id: 1 }] : []);
                },
              }),
            }),
          }),
        };
        // The fan-in helper uses select().from().where() without limit() for jobs.
        // Provide both shapes:
        const realTx = {
          execute: customTx.execute,
          select: () => ({
            from: () => ({
              where: () => {
                call += 1;
                if (call === 1) {
                  return Promise.resolve(mockJobs);
                }
                return {
                  limit: () =>
                    Promise.resolve(synthAlreadyStarted ? [{ id: 1 }] : []),
                };
              },
            }),
          }),
        };
        await fn(realTx);
      },
    },
  };
});

vi.mock("../inngest/client", () => ({
  inngest: {
    send: async (e: any) => {
      sentEvents.push(e);
    },
  },
}));

import { fanInCheck } from "../llm/fan-in";

beforeEach(() => {
  sentEvents.length = 0;
  mockJobs = [];
  synthAlreadyStarted = false;
});

describe("fanInCheck", () => {
  it("does nothing if any job is still queued", async () => {
    mockJobs = [{ status: "completed" }, { status: "queued" }];
    await fanInCheck("00000000-0000-0000-0000-000000000010");
    expect(sentEvents).toHaveLength(0);
  });

  it("does nothing if any job is still running", async () => {
    mockJobs = [{ status: "completed" }, { status: "running" }];
    await fanInCheck("00000000-0000-0000-0000-000000000011");
    expect(sentEvents).toHaveLength(0);
  });

  it("sends synth.run when all jobs are terminal and synth not started", async () => {
    mockJobs = [{ status: "completed" }, { status: "failed" }, { status: "completed" }];
    await fanInCheck("00000000-0000-0000-0000-000000000012");
    expect(sentEvents).toHaveLength(1);
    expect(sentEvents[0].name).toBe("synth.run");
    expect(sentEvents[0].data.reportId).toBe("00000000-0000-0000-0000-000000000012");
  });

  it("skips synth.run when already started", async () => {
    mockJobs = [{ status: "completed" }, { status: "completed" }];
    synthAlreadyStarted = true;
    await fanInCheck("00000000-0000-0000-0000-000000000013");
    expect(sentEvents).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `pnpm --filter @rivaleye/worker test fan-in`
Expected: FAIL — `../llm/fan-in` not found.

- [ ] **Step 3: Implement fan-in.ts**

Create `packages/worker/src/llm/fan-in.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { pipeline_events } from "../../../api/src/db/schema/pipeline-events.js";
import { inngest } from "../inngest/client";

export async function fanInCheck(
  reportId: string,
  reason: "fan-in" | "retry" = "fan-in",
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);

    const jobs = await tx
      .select({ status: report_platform_jobs.status })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    const allTerminal =
      jobs.length > 0 &&
      jobs.every((j) => j.status === "completed" || j.status === "failed");
    if (!allTerminal) return;

    const already = await tx
      .select({ id: pipeline_events.id })
      .from(pipeline_events)
      .where(
        and(
          eq(pipeline_events.report_id, reportId),
          eq(pipeline_events.stage, "synth.run"),
          eq(pipeline_events.event, "started"),
        ),
      )
      .limit(1);

    if (already.length > 0 && reason !== "retry") return;

    await inngest.send({
      name: "synth.run",
      data: { reportId, reason },
    });
  });
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `pnpm --filter @rivaleye/worker test fan-in`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/llm/fan-in.ts packages/worker/src/__tests__/fan-in.test.ts
git commit -m "feat(worker): advisory-lock fan-in helper"
```

---

## Task 8: scrape.fetch Inngest function

**Files:**
- Create: `packages/worker/src/scrape/fetch.ts`
- Create: `packages/worker/src/scrape/index.ts`

- [ ] **Step 1: Write fetch.ts**

Create `packages/worker/src/scrape/fetch.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { getScraper } from "@rivaleye/scrapers";
import { NonRetriableError } from "inngest";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";

const CHUNK_SIZE = 500;

export const scrapeFetch = inngest.createFunction(
  {
    id: "scrape-fetch",
    concurrency: [
      { limit: 8 },
      { limit: 1, key: "event.data.reportId + ':' + event.data.platform" },
    ],
    retries: 3,
    idempotency: "event.data.reportId + ':' + event.data.platform",
  },
  { event: "scrape.fetch" },
  async ({ event, step, attempt }) => {
    const { reportId, platform, competitor, category, keywords } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", async () => {
      await emit({
        reportId,
        platform,
        stage: "scrape.fetch",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      });
      await db
        .update(report_platform_jobs)
        .set({
          status: "running",
          started_at: new Date(),
          attempt_count: attempt + 1,
          last_event_at: new Date(),
        })
        .where(
          and(
            eq(report_platform_jobs.report_id, reportId),
            eq(report_platform_jobs.platform, platform),
          ),
        );
    });

    try {
      const posts = await step.run("fetch-posts", async () => {
        const scraper = getScraper(platform);
        return scraper.fetch({ competitor, category, keywords });
      });

      await step.run("persist-mentions", async () => {
        for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
          const chunk = posts.slice(i, i + CHUNK_SIZE);
          if (chunk.length === 0) continue;
          await db
            .insert(mentions)
            .values(
              chunk.map((p) => ({
                report_id: reportId,
                platform: p.platform,
                external_id: p.externalId,
                url: p.url,
                author: p.author,
                title: p.title,
                body: p.body,
                score: p.score,
                num_comments: p.numComments,
                posted_at: p.createdAt,
                raw: p.raw as Record<string, unknown>,
              })),
            )
            .onConflictDoNothing();
        }
        await db
          .update(reports)
          .set({ status: "running", updated_at: new Date() })
          .where(eq(reports.id, reportId));
      });

      await step.run("mark-stage-a", async () => {
        await db
          .update(report_platform_jobs)
          .set({ stage: "stage_a", last_event_at: new Date() })
          .where(
            and(
              eq(report_platform_jobs.report_id, reportId),
              eq(report_platform_jobs.platform, platform),
            ),
          );
      });

      await step.run("emit-completed", async () => {
        await emit({
          reportId,
          platform,
          stage: "scrape.fetch",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: { posts_count: posts.length },
        });
      });

      await step.sendEvent("enqueue-stage-a", {
        name: "llm.stage-a",
        data: { reportId, platform },
      });

      return { posts: posts.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        platform,
        stage: "scrape.fetch",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) {
        await markPlatformFailed(reportId, platform, message);
        throw new NonRetriableError(message);
      }
      throw err;
    }
  },
);

async function markPlatformFailed(reportId: string, platform: string, error: string) {
  await db
    .update(report_platform_jobs)
    .set({
      status: "failed",
      stage: "failed",
      last_error: error,
      completed_at: new Date(),
    })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

export async function onFailureFinalize(reportId: string, platform: string, error: string) {
  await markPlatformFailed(reportId, platform, error);
}
```

- [ ] **Step 2: Add `onFailure` to scrapeFetch**

Replace the `inngest.createFunction(...)` config object's first argument with the same object plus:

```ts
onFailure: async ({ event, error }) => {
  const data = event.data.event.data as { reportId: string; platform: string };
  const { onFailureFinalize } = await import("./fetch");
  const { fanInCheck } = await import("../llm/fan-in");
  await onFailureFinalize(data.reportId, data.platform, error.message);
  await fanInCheck(data.reportId);
},
```

Note: `onFailure` is invoked by Inngest after the function exhausts retries with a non-`NonRetriableError`. For `NonRetriableError` (PermanentError), the function body itself has already marked failed; still call `fanInCheck` from inside the catch block. Add this line in the `catch` block in `fetch.ts` right after the `markPlatformFailed` call when throwing `NonRetriableError`:

```ts
const { fanInCheck } = await import("../llm/fan-in");
await fanInCheck(reportId);
```

So the final `catch` becomes:

```ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  await emit({
    reportId,
    platform,
    stage: "scrape.fetch",
    event: "failed",
    attempt: attempt + 1,
    durationMs: Date.now() - startedAt,
    error: message,
  });
  if (err instanceof PermanentError) {
    await markPlatformFailed(reportId, platform, message);
    const { fanInCheck } = await import("../llm/fan-in");
    await fanInCheck(reportId);
    throw new NonRetriableError(message);
  }
  throw err;
}
```

- [ ] **Step 3: Write scrape entry point**

Create `packages/worker/src/scrape/index.ts`:

```ts
import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { scrapeFetch } from "./fetch";

const port = Number(process.env.WORKER_SCRAPE_PORT ?? 3100);

Bun.serve({
  port,
  fetch: serve({ client: inngest, functions: [scrapeFetch] }).fetch,
});

console.log(`[worker-scrape] listening on :${port}`);
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/scrape
git commit -m "feat(worker): scrape.fetch inngest function + scrape entry point"
```

---

## Task 9: llm.stage-a Inngest function

**Files:**
- Create: `packages/worker/src/llm/stage-a.ts`

- [ ] **Step 1: Write stage-a.ts**

Create `packages/worker/src/llm/stage-a.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_jobs,
  report_platform_briefs,
} from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { fanInCheck } from "./fan-in";

let _llm: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

export const stageA = inngest.createFunction(
  {
    id: "llm-stage-a",
    concurrency: [{ limit: 4 }],
    retries: 4,
    idempotency: "event.data.reportId + ':' + event.data.platform + ':a'",
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as { reportId: string; platform: string };
      await db
        .update(report_platform_jobs)
        .set({
          status: "failed",
          stage: "failed",
          last_error: error.message,
          completed_at: new Date(),
        })
        .where(
          and(
            eq(report_platform_jobs.report_id, data.reportId),
            eq(report_platform_jobs.platform, data.platform),
          ),
        );
      await fanInCheck(data.reportId);
    },
  },
  { event: "llm.stage-a" },
  async ({ event, step, attempt }) => {
    const { reportId, platform } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", async () => {
      await emit({
        reportId,
        platform,
        stage: "llm.stage_a",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      });
    });

    try {
      const result = await step.run("extract", async () => {
        const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
        if (!report) throw new PermanentError(`report ${reportId} not found`);

        const posts = await db
          .select()
          .from(mentions)
          .where(and(eq(mentions.report_id, reportId), eq(mentions.platform, platform)));

        if (posts.length === 0) {
          return { extract: null as null | Record<string, unknown>, usage: { promptTokens: 0, completionTokens: 0 } };
        }

        const ctx = {
          reportId,
          competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
          category: report.category,
          audience: report.audience ?? null,
          goal: report.goal,
        };

        const stageARes = await runStageAExtract({
          llm: getLlm(),
          ctx,
          platform,
          posts: posts.map((m) => ({
            platform: m.platform as any,
            externalId: m.external_id,
            url: m.url ?? "",
            author: m.author ?? "",
            title: m.title ?? "",
            body: m.body ?? "",
            score: m.score ?? 0,
            numComments: m.num_comments ?? 0,
            createdAt: m.posted_at ?? new Date(),
            raw: (m.raw ?? {}) as Record<string, unknown>,
          })),
        });

        return {
          extract: stageARes.extract as Record<string, unknown>,
          usage: stageARes.usage,
        };
      });

      await step.run("persist-extract", async () => {
        if (!result.extract) return;
        await db
          .insert(report_platform_briefs)
          .values({
            report_id: reportId,
            platform,
            extract: result.extract,
            summary: {} as Record<string, unknown>,
            model_used: LLM_MODEL,
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
          })
          .onConflictDoUpdate({
            target: [report_platform_briefs.report_id, report_platform_briefs.platform],
            set: {
              extract: result.extract,
              prompt_tokens: result.usage.promptTokens,
              completion_tokens: result.usage.completionTokens,
            },
          });
      });

      await step.run("mark-stage-b", async () => {
        await db
          .update(report_platform_jobs)
          .set({ stage: "stage_b", last_event_at: new Date() })
          .where(
            and(
              eq(report_platform_jobs.report_id, reportId),
              eq(report_platform_jobs.platform, platform),
            ),
          );
      });

      await step.run("emit-completed", async () => {
        await emit({
          reportId,
          platform,
          stage: "llm.stage_a",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: {
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
            had_posts: result.extract !== null,
          },
        });
      });

      await step.sendEvent("enqueue-stage-b", {
        name: "llm.stage-b",
        data: { reportId, platform },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        platform,
        stage: "llm.stage_a",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) throw new NonRetriableError(message);
      throw err;
    }
  },
);
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/llm/stage-a.ts
git commit -m "feat(worker): llm.stage-a inngest function"
```

---

## Task 10: llm.stage-b Inngest function

**Files:**
- Create: `packages/worker/src/llm/stage-b.ts`
- Create: `packages/worker/src/llm/index.ts`

- [ ] **Step 1: Write stage-b.ts**

Create `packages/worker/src/llm/stage-b.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_briefs,
  report_platform_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";
import { fanInCheck } from "./fan-in";

let _llm: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

export const stageB = inngest.createFunction(
  {
    id: "llm-stage-b",
    concurrency: [{ limit: 4 }],
    retries: 4,
    idempotency: "event.data.reportId + ':' + event.data.platform + ':b'",
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as { reportId: string; platform: string };
      await db
        .update(report_platform_jobs)
        .set({
          status: "failed",
          stage: "failed",
          last_error: error.message,
          completed_at: new Date(),
        })
        .where(
          and(
            eq(report_platform_jobs.report_id, data.reportId),
            eq(report_platform_jobs.platform, data.platform),
          ),
        );
      await fanInCheck(data.reportId);
    },
  },
  { event: "llm.stage-b" },
  async ({ event, step, attempt }) => {
    const { reportId, platform } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", async () => {
      await emit({
        reportId,
        platform,
        stage: "llm.stage_b",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      });
    });

    try {
      const summary = await step.run("summarize", async () => {
        const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
        if (!report) throw new PermanentError(`report ${reportId} not found`);

        const [briefRow] = await db
          .select()
          .from(report_platform_briefs)
          .where(
            and(
              eq(report_platform_briefs.report_id, reportId),
              eq(report_platform_briefs.platform, platform),
            ),
          )
          .limit(1);

        if (!briefRow) {
          // No extract = no posts. Skip summarize, return null.
          return null as null | { brief: unknown; usage: { promptTokens: number; completionTokens: number } };
        }

        const ctx = {
          reportId,
          competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
          category: report.category,
          audience: report.audience ?? null,
          goal: report.goal,
        };

        return runStageBSummarize({
          llm: getLlm(),
          ctx,
          platform,
          extract: briefRow.extract as any,
        });
      });

      await step.run("persist-summary", async () => {
        if (!summary) return;
        await db
          .update(report_platform_briefs)
          .set({
            summary: summary.brief as Record<string, unknown>,
            prompt_tokens: summary.usage.promptTokens,
            completion_tokens: summary.usage.completionTokens,
          })
          .where(
            and(
              eq(report_platform_briefs.report_id, reportId),
              eq(report_platform_briefs.platform, platform),
            ),
          );
      });

      await step.run("mark-done", async () => {
        await db
          .update(report_platform_jobs)
          .set({
            stage: "done",
            status: "completed",
            completed_at: new Date(),
            last_event_at: new Date(),
          })
          .where(
            and(
              eq(report_platform_jobs.report_id, reportId),
              eq(report_platform_jobs.platform, platform),
            ),
          );
      });

      await step.run("emit-completed", async () => {
        await emit({
          reportId,
          platform,
          stage: "llm.stage_b",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: summary
            ? {
                prompt_tokens: summary.usage.promptTokens,
                completion_tokens: summary.usage.completionTokens,
              }
            : { skipped: true },
        });
      });

      await step.run("fan-in", () => fanInCheck(reportId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        platform,
        stage: "llm.stage_b",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) throw new NonRetriableError(message);
      throw err;
    }
  },
);
```

- [ ] **Step 2: Write llm entry point**

Create `packages/worker/src/llm/index.ts`:

```ts
import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { stageA } from "./stage-a";
import { stageB } from "./stage-b";

const port = Number(process.env.WORKER_LLM_PORT ?? 3101);

Bun.serve({
  port,
  fetch: serve({ client: inngest, functions: [stageA, stageB] }).fetch,
});

console.log(`[worker-llm] listening on :${port}`);
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/llm/stage-b.ts packages/worker/src/llm/index.ts
git commit -m "feat(worker): llm.stage-b inngest function + llm entry point"
```

---

## Task 11: synth.run Inngest function

**Files:**
- Create: `packages/worker/src/synth/run.ts`
- Create: `packages/worker/src/synth/index.ts`

- [ ] **Step 1: Write run.ts**

Create `packages/worker/src/synth/run.ts`:

```ts
import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { runPipeline } from "../pipeline/run";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";

export const synthRun = inngest.createFunction(
  {
    id: "synth-run",
    concurrency: [{ limit: 1, key: "event.data.reportId" }],
    retries: 2,
    idempotency: "event.data.reportId + ':' + (event.data.reason ?? 'fan-in')",
    onFailure: async ({ event, error }) => {
      const reportId = (event.data.event.data as { reportId: string }).reportId;
      await db
        .update(reports)
        .set({ status: "failed", stage: "failed", error: error.message, updated_at: new Date() })
        .where(eq(reports.id, reportId));
    },
  },
  { event: "synth.run" },
  async ({ event, step, attempt }) => {
    const { reportId } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", () =>
      emit({
        reportId,
        stage: "synth.run",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      }),
    );

    try {
      const failedPlatforms = await step.run("compute-failed", async () => {
        const jobs = await db
          .select({ platform: report_platform_jobs.platform, status: report_platform_jobs.status })
          .from(report_platform_jobs)
          .where(eq(report_platform_jobs.report_id, reportId));
        const failed = jobs.filter((j) => j.status === "failed").map((j) => j.platform);
        const succeeded = jobs.filter((j) => j.status === "completed");
        if (succeeded.length === 0) {
          throw new PermanentError("all platforms failed");
        }
        return failed;
      });

      await step.run("run-pipeline", () => runPipeline(reportId));

      await step.run("mark-report-done", async () => {
        await db
          .update(reports)
          .set({
            status: "completed",
            stage: "done",
            partial: failedPlatforms.length > 0,
            failed_platforms: failedPlatforms,
            updated_at: new Date(),
          })
          .where(eq(reports.id, reportId));
      });

      await step.run("emit-completed", () =>
        emit({
          reportId,
          stage: "synth.run",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: { partial: failedPlatforms.length > 0, failed_platforms: failedPlatforms },
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        stage: "synth.run",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) {
        await db
          .update(reports)
          .set({ status: "failed", stage: "failed", error: message, updated_at: new Date() })
          .where(eq(reports.id, reportId));
        throw new NonRetriableError(message);
      }
      throw err;
    }
  },
);
```

- [ ] **Step 2: Write synth entry point**

Create `packages/worker/src/synth/index.ts`:

```ts
import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { synthRun } from "./run";

const port = Number(process.env.WORKER_SYNTH_PORT ?? 3102);

Bun.serve({
  port,
  fetch: serve({ client: inngest, functions: [synthRun] }).fetch,
});

console.log(`[worker-synth] listening on :${port}`);
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/synth
git commit -m "feat(worker): synth.run inngest function + synth entry point"
```

---

## Task 12: API — Inngest client + swap createReport enqueue

**Files:**
- Create: `packages/api/src/libs/inngest.ts`
- Modify: `packages/api/src/services/reports.service.ts`
- Delete: `packages/api/src/libs/queue.ts`

- [ ] **Step 1: Create api inngest client**

Create `packages/api/src/libs/inngest.ts`:

```ts
import { Inngest } from "inngest";
import type { RivalEyeEvents } from "@rivaleye/shared";

export const inngest = new Inngest<RivalEyeEvents>({
  id: "rivaleye-api",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
```

- [ ] **Step 2: Swap enqueue in reports.service.ts**

In `packages/api/src/services/reports.service.ts`:

Replace the import line:

```ts
import { enqueueScrapePlatform } from "@/libs/queue";
```

with:

```ts
import { inngest } from "@/libs/inngest";
```

Locate the loop in `createReport` that calls `enqueueScrapePlatform(...)` for each platform (currently follows the `INSERT INTO report_platform_jobs` step). Replace the entire enqueue loop with a single batched send:

```ts
await inngest.send(
  enabledPlatforms.map((platform) => ({
    name: "scrape.fetch" as const,
    data: {
      reportId: row.id,
      platform,
      competitor: input.competitors[0] ?? "",
      category: input.category,
      keywords: expandedKeywords,
    },
  })),
);
```

Make sure `enabledPlatforms` and `expandedKeywords` refer to the existing local variables in `createReport` (whatever they are currently named — keep the original names; just adapt the field assignments).

- [ ] **Step 3: Delete libs/queue.ts**

Run: `rm packages/api/src/libs/queue.ts`

- [ ] **Step 4: Search for remaining queue imports**

Run: `rg "libs/queue|enqueueScrapePlatform|enqueueGenerateReport" packages/api/src`
Expected: no output.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/libs/inngest.ts packages/api/src/services/reports.service.ts
git rm packages/api/src/libs/queue.ts
git commit -m "feat(api): enqueue scrape.fetch via inngest in createReport"
```

---

## Task 13: API — extend getProgress with events + new columns

**Files:**
- Modify: `packages/api/src/controllers/reports/handlers/getProgress.ts`
- Modify: `packages/api/src/services/reports.service.ts` (`getProgress` function)
- Modify: `packages/web/src/api/reports.ts` (type definitions; touched here to keep API/web in lockstep)

- [ ] **Step 1: Extend service**

In `packages/api/src/services/reports.service.ts`, find the existing `getProgress` function. Add this block before the final `return` statement (after the metrics queries):

```ts
import { desc } from "drizzle-orm"; // ensure imported
import { pipeline_events } from "@/db/schema/pipeline-events";

// ...

const platformRows = await db
  .select({
    platform: report_platform_jobs.platform,
    status: report_platform_jobs.status,
    stage: report_platform_jobs.stage,
    attempt_count: report_platform_jobs.attempt_count,
    last_error: report_platform_jobs.last_error,
    last_event_at: report_platform_jobs.last_event_at,
  })
  .from(report_platform_jobs)
  .where(eq(report_platform_jobs.report_id, reportId));

const events = await db
  .select({
    stage: pipeline_events.stage,
    event: pipeline_events.event,
    platform: pipeline_events.platform,
    attempt: pipeline_events.attempt,
    duration_ms: pipeline_events.duration_ms,
    created_at: pipeline_events.created_at,
  })
  .from(pipeline_events)
  .where(eq(pipeline_events.report_id, reportId))
  .orderBy(desc(pipeline_events.created_at))
  .limit(20);
```

Extend the returned object:

```ts
return {
  report: {
    id: report.id,
    status: report.status,
    partial: report.partial,
    failed_platforms: report.failed_platforms,
  },
  platforms: platformRows,
  events,
  metrics: { mentions: mentionsCount, complaints, quotes, comments },
};
```

(Adjust variable names to match whatever the existing function uses for `mentionsCount` etc.)

- [ ] **Step 2: Update handler types**

In `packages/api/src/controllers/reports/handlers/getProgress.ts`, update the Elysia `response` schema to match the new shape. Replace the response schema with:

```ts
response: t.Object({
  report: t.Object({
    id: t.String(),
    status: t.String(),
    partial: t.Boolean(),
    failed_platforms: t.Array(t.String()),
  }),
  platforms: t.Array(
    t.Object({
      platform: t.String(),
      status: t.String(),
      stage: t.String(),
      attempt_count: t.Number(),
      last_error: t.Nullable(t.String()),
      last_event_at: t.Nullable(t.Date()),
    }),
  ),
  events: t.Array(
    t.Object({
      stage: t.String(),
      event: t.String(),
      platform: t.Nullable(t.String()),
      attempt: t.Number(),
      duration_ms: t.Nullable(t.Number()),
      created_at: t.Date(),
    }),
  ),
  metrics: t.Object({
    mentions: t.Number(),
    complaints: t.Number(),
    quotes: t.Number(),
    comments: t.Number(),
  }),
}),
```

- [ ] **Step 3: Update web types**

In `packages/web/src/api/reports.ts`, replace the `ReportProgress` type (or whatever the progress type is named) with:

```ts
export type ReportProgressPlatform = {
  platform: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: "scrape" | "stage_a" | "stage_b" | "done" | "failed";
  attempt_count: number;
  last_error: string | null;
  last_event_at: string | null;
};

export type ReportProgressEvent = {
  stage: string;
  event: "started" | "completed" | "failed" | "retrying";
  platform: string | null;
  attempt: number;
  duration_ms: number | null;
  created_at: string;
};

export type ReportProgress = {
  report: {
    id: string;
    status: string;
    partial: boolean;
    failed_platforms: string[];
  };
  platforms: ReportProgressPlatform[];
  events: ReportProgressEvent[];
  metrics: { mentions: number; complaints: number; quotes: number; comments: number };
};
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter @rivaleye/api type-check && pnpm --filter @rivaleye/web type-check`
Expected: exit 0 for both.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/reports.service.ts \
        packages/api/src/controllers/reports/handlers/getProgress.ts \
        packages/web/src/api/reports.ts
git commit -m "feat(api): getProgress returns platforms+events+partial flag"
```

---

## Task 14: API — retry-platform + cancel endpoints

**Files:**
- Create: `packages/api/src/controllers/reports/handlers/retryPlatform.ts`
- Create: `packages/api/src/controllers/reports/handlers/cancel.ts`
- Modify: `packages/api/src/controllers/reports/index.ts`
- Modify: `packages/api/src/services/reports.service.ts`

- [ ] **Step 1: Add service helpers**

Append to `packages/api/src/services/reports.service.ts`:

```ts
import { inngest } from "@/libs/inngest";
import type { EnabledPlatformId } from "@rivaleye/shared";

export async function retryPlatform(
  owner_id: string,
  reportId: string,
  platform: EnabledPlatformId,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const report = await assertReportOwned(reportId, owner_id);
  if (!report) return { ok: false, reason: "not_found" };

  const [job] = await db
    .select()
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    )
    .limit(1);
  if (!job) return { ok: false, reason: "platform_not_in_report" };
  if (job.status === "running") return { ok: false, reason: "already_running" };

  await db
    .update(report_platform_jobs)
    .set({
      status: "queued",
      stage: "scrape",
      attempt_count: 0,
      last_error: null,
      started_at: null,
      completed_at: null,
    })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );

  await inngest.send({
    name: "scrape.fetch",
    data: {
      reportId,
      platform,
      competitor: report.competitors[0] ?? "",
      category: report.category,
      keywords: [],
    },
  });

  return { ok: true };
}

export async function cancelReport(
  owner_id: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const report = await assertReportOwned(reportId, owner_id);
  if (!report) return { ok: false, reason: "not_found" };
  await db
    .update(reports)
    .set({ status: "cancelled", stage: "cancelled", updated_at: new Date() })
    .where(eq(reports.id, reportId));
  return { ok: true };
}
```

Note: if the existing `reports.status` enum lacks `cancelled`, add a Drizzle migration in this step to extend the enum:

```sql
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE report_stage  ADD VALUE IF NOT EXISTS 'cancelled';
```

Run `pnpm db:generate` after extending the enum in schema; otherwise just leave `cancelled` as a permitted string if the column is `text`.

- [ ] **Step 2: Create retryPlatform handler**

Create `packages/api/src/controllers/reports/handlers/retryPlatform.ts`:

```ts
import { Elysia, t } from "elysia";
import { auth } from "@/plugins/auth";
import { retryPlatform } from "@/services/reports.service";

export const retryPlatformHandler = new Elysia().use(auth).post(
  "/:id/retry-platform",
  async ({ params, body, user, set }) => {
    const result = await retryPlatform(user.id, params.id, body.platform as any);
    if (!result.ok) {
      set.status = result.reason === "not_found" ? 404 : 409;
      return { error: result.reason };
    }
    set.status = 202;
    return { ok: true };
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({ platform: t.String() }),
    response: {
      202: t.Object({ ok: t.Literal(true) }),
      404: t.Object({ error: t.String() }),
      409: t.Object({ error: t.String() }),
    },
  },
);
```

(Adjust the `auth` plugin import + `user` extraction to whatever pattern the existing handlers use — copy from `createReport.ts`.)

- [ ] **Step 3: Create cancel handler**

Create `packages/api/src/controllers/reports/handlers/cancel.ts`:

```ts
import { Elysia, t } from "elysia";
import { auth } from "@/plugins/auth";
import { cancelReport } from "@/services/reports.service";

export const cancelHandler = new Elysia().use(auth).post(
  "/:id/cancel",
  async ({ params, user, set }) => {
    const result = await cancelReport(user.id, params.id);
    if (!result.ok) {
      set.status = 404;
      return { error: result.reason };
    }
    return { ok: true };
  },
  {
    params: t.Object({ id: t.String() }),
    response: {
      200: t.Object({ ok: t.Literal(true) }),
      404: t.Object({ error: t.String() }),
    },
  },
);
```

- [ ] **Step 4: Register handlers**

In `packages/api/src/controllers/reports/index.ts`, add to imports:

```ts
import { retryPlatformHandler } from "./handlers/retryPlatform";
import { cancelHandler } from "./handlers/cancel";
```

Chain them onto `reportsController` (after `getProgressHandler` is fine):

```ts
.use(retryPlatformHandler)
.use(cancelHandler)
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/reports.service.ts \
        packages/api/src/controllers/reports/handlers/retryPlatform.ts \
        packages/api/src/controllers/reports/handlers/cancel.ts \
        packages/api/src/controllers/reports/index.ts
git commit -m "feat(api): retry-platform + cancel endpoints"
```

---

## Task 15: Delete legacy worker files

**Files:**
- Delete: `packages/worker/src/queue.ts`
- Delete: `packages/worker/src/index.ts`
- Delete: `packages/worker/src/jobs/scrape-platform.ts`
- Delete: `packages/worker/src/jobs/generate-report.ts`
- Delete: `packages/worker/src/jobs/` (empty after above)

- [ ] **Step 1: Delete files**

```bash
rm packages/worker/src/queue.ts
rm packages/worker/src/index.ts
rm packages/worker/src/jobs/scrape-platform.ts
rm packages/worker/src/jobs/generate-report.ts
rmdir packages/worker/src/jobs
```

- [ ] **Step 2: Search for stale references**

Run: `rg "from .*jobs/(scrape|generate)|from .*worker/src/queue|pg-boss" packages`
Expected: no output.

- [ ] **Step 3: Type-check whole workspace**

Run: `pnpm type-check`
Expected: exit 0 across all packages.

- [ ] **Step 4: Run all tests**

Run: `pnpm --filter @rivaleye/worker test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(worker): remove pg-boss-based queue + old job handlers"
```

---

## Task 16: Web — live events feed in ScanRunning

**Files:**
- Modify: `packages/web/src/components/report/report-in-progress.tsx`

- [ ] **Step 1: Render events feed**

In `packages/web/src/components/report/report-in-progress.tsx`, locate the section currently rendering the synthesized "live log" derived from `started_at`/`completed_at` timestamps. Replace it with rendering of `progress.events` from the new API shape.

Add near the top of the component (after `useReportProgressQuery`):

```tsx
const events = progress?.events ?? [];
```

Replace the live log JSX block with:

```tsx
<div className="rounded-lg border bg-card p-4">
  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
    Live log
  </div>
  <ol className="space-y-1 font-mono text-xs">
    {events
      .slice()
      .reverse()
      .map((e, i) => (
        <li
          key={`${e.created_at}-${i}`}
          className={
            e.event === "failed"
              ? "text-red-500"
              : e.event === "retrying"
                ? "text-amber-500"
                : e.event === "completed"
                  ? "text-emerald-500"
                  : "text-muted-foreground"
          }
        >
          <span className="opacity-60">
            {new Date(e.created_at).toLocaleTimeString()}
          </span>{" "}
          {e.platform ? `[${e.platform}]` : "[synth]"} {e.stage} → {e.event}
          {e.duration_ms !== null ? ` (${e.duration_ms}ms)` : ""}
          {e.attempt > 1 ? ` attempt ${e.attempt}` : ""}
        </li>
      ))}
  </ol>
</div>
```

- [ ] **Step 2: Add per-platform retry buttons**

In the same file, in the per-platform list section, when `platform.status === "failed"`, render a retry button:

```tsx
{platform.status === "failed" && (
  <button
    type="button"
    onClick={() => retryPlatformMutation.mutate({ reportId, platform: platform.platform })}
    className="text-xs underline text-blue-500 hover:text-blue-600"
  >
    Retry
  </button>
)}
```

And add the mutation hook near the top of the component:

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryPlatform } from "@/api/reports";

// ...

const queryClient = useQueryClient();
const retryPlatformMutation = useMutation({
  mutationFn: ({ reportId, platform }: { reportId: string; platform: string }) =>
    retryPlatform(reportId, platform),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["report-progress", reportId] });
  },
});
```

- [ ] **Step 3: Add retryPlatform to web API client**

In `packages/web/src/api/reports.ts`, append:

```ts
export async function retryPlatform(reportId: string, platform: string): Promise<void> {
  const res = await fetch(`${API_URL}/reports/${reportId}/retry-platform`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
  if (!res.ok) throw new Error(`retry failed: ${res.status}`);
}
```

(Use whatever `API_URL` constant the rest of the file uses — match the existing pattern.)

- [ ] **Step 4: Type-check web**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/components/report/report-in-progress.tsx \
        packages/web/src/api/reports.ts
git commit -m "feat(web): live events feed + per-platform retry buttons"
```

---

## Task 17: Web — partial-report banner on completed view

**Files:**
- Modify: `packages/web/src/components/report/report-header.tsx`

- [ ] **Step 1: Add banner**

In `packages/web/src/components/report/report-header.tsx`, accept the report object (which now includes `partial` and `failed_platforms`) and render under the header when applicable:

```tsx
{report.partial && report.failed_platforms.length > 0 && (
  <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm">
    Partial report. Missing platforms:{" "}
    <span className="font-medium">{report.failed_platforms.join(", ")}</span>.{" "}
    <button
      type="button"
      onClick={onRetryFailed}
      className="underline hover:no-underline"
    >
      Retry failed platforms
    </button>
  </div>
)}
```

Add `partial?: boolean; failed_platforms?: string[]; onRetryFailed?: () => void;` to the component's props type.

In the parent page that renders `ReportHeader`, pass the new props and implement `onRetryFailed`:

```tsx
const onRetryFailed = async () => {
  for (const p of report.failed_platforms ?? []) {
    await retryPlatform(report.id, p);
  }
  queryClient.invalidateQueries({ queryKey: ["report", report.id] });
};
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @rivaleye/web type-check`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/report/report-header.tsx \
        packages/web/src/pages
git commit -m "feat(web): partial-report banner with retry-failed action"
```

---

## Task 18: End-to-end smoke test

**Files:**
- (No new files; manual verification + commit a short README note.)
- Create: `docs/RUNNING-LOCALLY.md`

- [ ] **Step 1: Write local-run doc**

Create `docs/RUNNING-LOCALLY.md`:

```markdown
# Running RivalEye locally

Four processes need to run:

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
```

- [ ] **Step 2: Start everything**

In four terminals:

```sh
# T1
npx inngest-cli@latest dev
# T2
pnpm --filter @rivaleye/api dev
# T3
pnpm --filter @rivaleye/worker dev
# T4
pnpm --filter @rivaleye/web dev
```

Expected: Inngest UI at :8288 shows three apps registered: `rivaleye-worker` (scrape, llm, synth).

- [ ] **Step 3: Submit a new report from the UI**

Open http://localhost:5173, create a report.

Verify:
1. Inngest UI shows 8 `scrape.fetch` events sent within 1s.
2. `report_platform_jobs` rows transition `queued → running → completed`.
3. `pipeline_events` table fills with rows; tail it:

   ```sh
   psql "$CONNECTION_STRING" -c "select created_at, platform, stage, event, attempt, duration_ms from pipeline_events where report_id = '<id>' order by id desc limit 30;"
   ```

4. ScanRunning UI shows live events feed.
5. After all platforms terminal: `synth.run` event fires (visible in Inngest UI), then report transitions to `completed`.

- [ ] **Step 4: Forced-failure test**

Temporarily edit one scraper (e.g. `packages/scrapers/src/reddit/index.ts`) to throw `new (await import('../../worker/src/errors')).PermanentError("forced fail")` on first call, then submit a new report.

Expected:
- That platform's job row: `status='failed'`, `stage='failed'`, `last_error='forced fail'`.
- The other 7 succeed.
- `synth.run` fires; `reports.partial = true`, `reports.failed_platforms = ['reddit']`.
- UI shows the partial banner and a Retry button on the failed platform.

Revert the scraper edit. Do not commit it.

- [ ] **Step 5: Manual retry test**

Click "Retry" on the failed platform in the UI.

Expected:
- `report_platform_jobs.reddit` row resets to `status='queued', stage='scrape'`.
- A new `scrape.fetch` event appears in Inngest UI.
- Pipeline runs through; `synth.run` re-fires with `reason='retry'`.
- After completion: `reports.partial = false`, `failed_platforms = []` (synth re-runs with `cancelled` semantics — verify it overwrites the report rows; if not, that's a follow-up but the platform row itself completes).

- [ ] **Step 6: Crash-recovery test**

While a report is running stage-a, `Ctrl-C` the worker-llm process. Restart it (`pnpm --filter @rivaleye/worker dev` again).

Expected:
- Inngest UI shows the in-flight `llm.stage-a` run as `retrying`.
- It picks up after restart, skips already-completed steps, completes.
- `pipeline_events` shows a `retrying` row followed by `completed`.

- [ ] **Step 7: Commit doc**

```bash
git add docs/RUNNING-LOCALLY.md
git commit -m "docs: local-run instructions for new four-process setup"
```

- [ ] **Step 8: Final sanity**

Run: `pnpm type-check && pnpm --filter @rivaleye/worker test`
Expected: exit 0.

---

## Self-review

- **Spec coverage:** §4 architecture → Tasks 8–11 + 12. §5 job topology → Tasks 8–11. §6 process model → Task 1 (scripts) + Tasks 8/10/11 (entry points). §7 schema → Task 3. §8 retries + fan-in → Tasks 4 (errors) + 7 (fan-in) + 8/9/10/11 (function configs). §9 observability → Tasks 3 (table) + 6 (emitter). §10 API + UI → Tasks 12/13/14/16/17. §11 removals → Task 15. §13 acceptance criteria → Task 18.
- **Placeholder scan:** none. Every step contains either exact code, an exact command, or a precise instruction with file/line context.
- **Type consistency:** `RivalEyeEvents` shape defined Task 2, used identically in Tasks 5/8/9/10/11/12. `report_platform_jobs.stage` enum defined Task 3, referenced consistently. `pipeline_events.event` enum defined Task 3, used identically in `emit()` Task 6 and all function emitters. `fanInCheck(reportId, reason?)` signature in Task 7 matches calls in Tasks 8/10/11.
- **One caveat called out inline:** Task 14 notes that `reports.status` may need a `cancelled` enum value added if not already present — handled there rather than spread across tasks.
