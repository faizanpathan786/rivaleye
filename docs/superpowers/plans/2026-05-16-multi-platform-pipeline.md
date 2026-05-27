# Multi-platform pipeline implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the reddit-only LLM pipeline with an 8-platform parallel scrape + 5-stage iterative LLM pipeline (per-platform extract → summarize → cross-platform merge → synth → refine) that populates all 16 report sub-tables, plus ship a skill for onboarding future platforms.

**Architecture:** API enqueues 8 `scrape-platform` jobs after a one-shot LLM keyword expansion. Each scrape job runs its scraper, persists raw mentions, runs Stage A (extract) and Stage B (summarize) for its platform, writes a `report_platform_briefs` row, then checks fan-in. When all platform jobs finish, `generate-report` runs Stage C (merge), Stage D (synth, single mega-blob covering 16 sections), Stage E (refine), then persists every section in one transaction. Single OpenRouter LLM client lives in `@rivaleye/shared`. Model swappable via `OPENROUTER_MODEL` env. Temperature locked at 1.0.

**Tech Stack:** Bun + Elysia (api), Bun + pg-boss (worker), Drizzle ORM on Postgres, OpenRouter via `openai` SDK with `baseURL` override, Zod for canonical schema validation, `bun test`.

**Spec:** `docs/superpowers/specs/2026-05-16-multi-platform-pipeline-design.md`

---

## Conventions used throughout this plan

- **Package paths**: workspaces always rooted at `/Users/aymanparkar/Desktop/rivaleye-v3/`.
- **Commands**: run from repo root. `pnpm --filter <pkg>` for one package, plain `pnpm <script>` for root.
- **Commits**: small, frequent. After every passing test step. Format: `feat:`/`fix:`/`refactor:`/`chore:` + short subject. Body explains *why*. Include Claude co-author trailer.
- **No comments** in code unless the *why* is non-obvious. Good names explain *what*.
- **Snake_case columns + Drizzle property names** — `packages/api/CLAUDE.md` + memory note S753 confirm this. Drizzle is configured `casing: "snake_case"`.
- **TS strict, no `any`** — root rule.

---

## File structure (locked before coding)

### New files

```
packages/shared/src/llm/openrouter.ts             # LlmClient interface + impl
packages/shared/src/llm/errors.ts                 # LlmJsonParseError, LlmHttpError
packages/shared/src/llm/index.ts                  # barrel
packages/shared/src/llm/schemas.ts                # Zod canonical Stage shapes
packages/shared/src/llm/config.ts                 # LLM_MODEL, LLM_TEMPERATURE, ENABLED_PLATFORMS

packages/api/src/db/schema/pipeline.ts            # report_platform_jobs + report_platform_briefs
packages/api/src/services/keyword-expander.ts     # LLM keyword expansion
packages/api/src/services/pipeline-jobs.service.ts# insert + status helpers for report_platform_jobs

packages/scrapers/src/__fixtures__/<platform>.json     # 1 per platform — raw payload sample
packages/scrapers/src/<platform>/normalize.ts          # appstore, playstore, hackernews, producthunt, devto, medium, trustpilot
packages/scrapers/src/<platform>/normalize.test.ts     # 1 per platform
packages/scrapers/src/<platform>/client.ts             # fetch + raw shapes

packages/worker/src/config.ts                          # re-export from shared
packages/worker/src/llm.ts                             # re-export from shared (back-compat shim, deleted later)
packages/worker/src/prompts/shared.ts                  # canonical Zod schemas + ctx helpers
packages/worker/src/prompts/platform/<p>/extract.ts    # 8 files — Stage A prompt builders
packages/worker/src/prompts/platform/<p>/summarize.ts  # 8 files — Stage B prompt builders
packages/worker/src/prompts/cross/merge.ts             # Stage C
packages/worker/src/prompts/cross/synth.ts             # Stage D
packages/worker/src/prompts/cross/refine.ts            # Stage E
packages/worker/src/pipeline/stage-a-extract.ts
packages/worker/src/pipeline/stage-b-summarize.ts
packages/worker/src/pipeline/stage-c-merge.ts
packages/worker/src/pipeline/stage-d-synth.ts
packages/worker/src/pipeline/stage-e-refine.ts
packages/worker/src/pipeline/persist.ts                # writes Stage E output to 16 tables
packages/worker/src/pipeline/derive-stats.ts           # platform_stats + subreddits derivation
packages/worker/src/pipeline/run.ts                    # generate-report orchestrator
packages/worker/src/pipeline/errors.ts                 # PipelineError
packages/worker/src/scripts/test-platform.ts           # smoke-test single platform

.claude/skills/adding-a-platform-scraper/SKILL.md
.claude/skills/adding-a-platform-scraper/references/scraper-template.ts
.claude/skills/adding-a-platform-scraper/references/extract-prompt-template.ts
.claude/skills/adding-a-platform-scraper/references/summarize-prompt-template.ts
```

### Modified files

```
.env.example                                                  # add OPENROUTER_MODEL, TRUSTPILOT_API_KEY
packages/api/package.json                                     # add openai dep (LLM via shared, but shared needs the SDK)
packages/shared/package.json                                  # add openai dep + export ./llm
packages/api/src/db/schema/index.ts                           # re-export new pipeline schema
packages/api/src/db/schema/reports.ts                         # add types export only
packages/api/src/libs/queue.ts                                # no signature change (job payload already has keywords)
packages/api/src/services/reports.service.ts                  # createReport now fans out N platforms after keyword expansion
packages/api/src/controllers/reports/handlers/createReport.ts # no behaviour change; routes already pipe to service
packages/scrapers/src/index.ts                                # ALL_PLATFORMS drops hostile platforms
packages/scrapers/src/appstore/index.ts                       # full impl
packages/scrapers/src/playstore/index.ts                      # full impl
packages/scrapers/src/producthunt/index.ts                    # full impl
packages/scrapers/src/reddit/*.ts                             # cleanup audit
packages/worker/src/queue.ts                                  # unused — delete after consolidation
packages/worker/src/jobs/scrape-platform.ts                   # wire Stage A + B + fan-in
packages/worker/src/jobs/generate-report.ts                   # call new run.ts
packages/worker/CLAUDE.md                                     # update worker layout notes
packages/scrapers/CLAUDE.md                                   # update platform table (medium added; trustpilot row)
```

### Deleted files

```
packages/worker/src/pipeline/stage1.ts
packages/worker/src/pipeline/stage2.ts
packages/worker/src/pipeline/stage3.ts
packages/worker/src/pipeline/stage4.ts
packages/worker/src/pipeline/evidence-binding.ts
packages/worker/src/pipeline/preflight.ts
packages/worker/src/pipeline/adapter.ts
packages/worker/src/pipeline/schemas.ts
packages/worker/src/prompts/stage1-cluster.ts
packages/worker/src/prompts/stage2-score.ts
packages/worker/src/prompts/stage3-synthesize.ts
packages/worker/src/prompts/stage4-actions.ts
packages/worker/src/prompts/types.ts
packages/worker/src/prompts/index.ts
packages/worker/src/prompts/shared.ts          # replaced by new one
packages/worker/src/llm/index.ts               # superseded by shared/llm
packages/worker/src/llm.ts                     # superseded
competitor-research/*                          # deleted only in final cleanup task
```

### Scrapers — port-by-rewrite plan

| Platform     | Source script                          | Class name              | Env vars                                                    |
|--------------|----------------------------------------|-------------------------|-------------------------------------------------------------|
| reddit       | (existing — audit + clean)             | `RedditScraper`         | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| appstore     | `competitor-research/appstore.ts`      | `AppStoreScraper`       | none                                                        |
| playstore    | `competitor-research/playstore.ts`     | `PlayStoreScraper`      | none                                                        |
| hackernews   | `competitor-research/hackernews.ts`    | `HackerNewsScraper`     | none                                                        |
| producthunt  | `competitor-research/producthunt.ts`   | `ProductHuntScraper`    | `PRODUCTHUNT_TOKEN`                                         |
| devto        | `competitor-research/devto.ts`         | `DevToScraper`          | none                                                        |
| medium       | `competitor-research/hashnode.ts`      | `MediumScraper`         | none                                                        |
| trustpilot   | `competitor-research/trustpilot.ts`    | `TrustpilotScraper`     | `TRUSTPILOT_API_KEY`                                        |

---

## Task ordering rationale

1. **Foundations first** (schema migration, LLM client in shared, canonical prompt types) — everything else depends on them.
2. **One scraper end-to-end** (appstore — simplest free, no auth) — validates the per-platform scraper + Stage A + Stage B + brief-write loop before fan-out logic exists.
3. **Fan-out + fan-in plumbing** — once one platform works, generalise.
4. **Remaining 7 scrapers in sequence** — each one Cargo-Cult-copies the appstore pattern.
5. **Cross-platform Stage C + D + E + persist** — single mega-blob synth.
6. **API keyword expansion + createReport fan-out.**
7. **End-to-end smoke + skill + cleanup.**

---

## Task 1: Add Drizzle schema for `report_platform_jobs` + `report_platform_briefs`

**Files:**
- Create: `packages/api/src/db/schema/pipeline.ts`
- Modify: `packages/api/src/db/schema/index.ts`
- Generate: `packages/api/drizzle/0001_pipeline.sql` (via drizzle-kit)

- [ ] **Step 1: Create the schema file**

```ts
// packages/api/src/db/schema/pipeline.ts
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const report_platform_job_status_enum = pgEnum("report_platform_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const report_platform_jobs = pgTable(
  "report_platform_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    status: report_platform_job_status_enum("status").notNull().default("queued"),
    error: text("error"),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_platform_jobs_report_platform_uniq").on(t.report_id, t.platform),
    index("report_platform_jobs_report_id_idx").on(t.report_id),
  ],
);

export const report_platform_briefs = pgTable(
  "report_platform_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    extract: jsonb("extract").$type<Record<string, unknown>>().notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    model_used: text("model_used").notNull(),
    prompt_tokens: integer("prompt_tokens").notNull().default(0),
    completion_tokens: integer("completion_tokens").notNull().default(0),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_platform_briefs_report_platform_uniq").on(t.report_id, t.platform),
    index("report_platform_briefs_report_id_idx").on(t.report_id),
  ],
);

export type ReportPlatformJob = typeof report_platform_jobs.$inferSelect;
export type NewReportPlatformJob = typeof report_platform_jobs.$inferInsert;
export type ReportPlatformBrief = typeof report_platform_briefs.$inferSelect;
export type NewReportPlatformBrief = typeof report_platform_briefs.$inferInsert;
```

- [ ] **Step 2: Re-export from schema barrel**

```ts
// packages/api/src/db/schema/index.ts
export * from "./users";
export * from "./reports";
export * from "./competitors";
export * from "./mentions";
export * from "./radar";
export * from "./pipeline";
```

- [ ] **Step 3: Generate migration**

Run: `pnpm --filter @rivaleye/api drizzle:generate`
Expected output: a new file `packages/api/drizzle/0001_*.sql` containing `CREATE TYPE "public"."report_platform_job_status"` + two `CREATE TABLE` statements + the unique indexes.

If drizzle-kit blocks on rename prompts (memory note 3345), there are no renames here — it should generate non-interactively. If it hangs, kill it and write the migration by hand mirroring the schema above (see memory note 3350 for prior precedent).

- [ ] **Step 4: Apply migration locally**

Run: `pnpm --filter @rivaleye/api drizzle:migrate`
Expected: drizzle prints "0 migrations to apply" if already applied, or "1 migration applied" first time.

- [ ] **Step 5: Verify schema in DB**

Run: `psql "$CONNECTION_STRING" -c "\d report_platform_jobs" -c "\d report_platform_briefs"`
Expected: both tables print with the columns, types, and unique constraints listed above.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/db/schema/pipeline.ts packages/api/src/db/schema/index.ts packages/api/drizzle/
git commit -m "$(cat <<'EOF'
feat(api): add report_platform_jobs + report_platform_briefs

Why: fan-out/fan-in tracking + per-platform LLM brief storage for the
new multi-platform pipeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Single LLM client in `@rivaleye/shared`

**Files:**
- Create: `packages/shared/src/llm/openrouter.ts`
- Create: `packages/shared/src/llm/errors.ts`
- Create: `packages/shared/src/llm/index.ts`
- Create: `packages/shared/src/llm/openrouter.test.ts`
- Modify: `packages/shared/package.json`
- Modify: `packages/shared/src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add `openai` SDK + exports to shared package**

```jsonc
// packages/shared/package.json
{
  "name": "@rivaleye/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./llm": "./src/llm/index.ts"
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "openai": "^4.77.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

Run: `pnpm install`
Expected: `openai` installed under `packages/shared/node_modules/`.

- [ ] **Step 2: Add error classes**

```ts
// packages/shared/src/llm/errors.ts
export class LlmJsonParseError extends Error {
  constructor(public readonly raw: string, public override readonly cause?: unknown) {
    super(`LLM returned unparseable JSON (${raw.length} chars)`);
    this.name = "LlmJsonParseError";
  }
}

export class LlmHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`OpenRouter HTTP ${status}: ${message}`);
    this.name = "LlmHttpError";
  }
}

export class LlmSchemaError extends Error {
  constructor(public readonly issues: string[], public readonly raw: unknown) {
    super(`LLM JSON did not match schema: ${issues.join("; ")}`);
    this.name = "LlmSchemaError";
  }
}
```

- [ ] **Step 3: Write a failing test first**

```ts
// packages/shared/src/llm/openrouter.test.ts
import { describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { OpenRouterClient } from "./openrouter";
import { LlmJsonParseError, LlmSchemaError } from "./errors";

const schema = z.object({ greeting: z.string() });

describe("OpenRouterClient", () => {
  it("parses JSON content into the provided Zod schema", async () => {
    const client = new OpenRouterClient({
      apiKey: "test",
      model: "test-model",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"greeting":"hi"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        text: async () => "",
      } as unknown as Response),
    });
    const res = await client.complete({ system: "s", user: "u", schema });
    expect(res.parsed).toEqual({ greeting: "hi" });
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 4 });
  });

  it("retries once on malformed JSON, then throws LlmJsonParseError", async () => {
    let calls = 0;
    const client = new OpenRouterClient({
      apiKey: "test",
      model: "test-model",
      fetcher: async () => {
        calls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "definitely not json" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          text: async () => "",
        } as unknown as Response;
      },
    });
    await expect(
      client.complete({ system: "s", user: "u", schema }),
    ).rejects.toBeInstanceOf(LlmJsonParseError);
    expect(calls).toBe(2);
  });

  it("throws LlmSchemaError when JSON parses but schema rejects", async () => {
    const client = new OpenRouterClient({
      apiKey: "test",
      model: "test-model",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"unexpected":1}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        text: async () => "",
      } as unknown as Response),
    });
    await expect(
      client.complete({ system: "s", user: "u", schema }),
    ).rejects.toBeInstanceOf(LlmSchemaError);
  });
});
```

- [ ] **Step 4: Run the test — expect FAIL**

Run: `pnpm --filter @rivaleye/shared exec bun test src/llm/openrouter.test.ts`
Expected: 3 failures, "Cannot find module './openrouter'".

- [ ] **Step 5: Implement `OpenRouterClient`**

```ts
// packages/shared/src/llm/openrouter.ts
import type { ZodSchema } from "zod";
import { LlmHttpError, LlmJsonParseError, LlmSchemaError } from "./errors";

export interface LlmRequest<TSchema extends ZodSchema | undefined = undefined> {
  system: string;
  user: string;
  schema?: TSchema;
  maxTokens?: number;
}

export interface LlmResponse<T> {
  parsed: T;
  raw: string;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export interface OpenRouterClientOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  fetcher?: typeof fetch;
  baseUrl?: string;
}

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const DEFAULT_BASE = "https://openrouter.ai/api/v1";
const RETRY_SUFFIX =
  "\n\nReturn ONLY a single valid JSON object that matches the schema. No prose, no markdown fence.";

export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;

  constructor(opts: OpenRouterClientOptions) {
    if (!opts.apiKey) throw new Error("OpenRouterClient: apiKey required");
    if (!opts.model) throw new Error("OpenRouterClient: model required");
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.temperature = opts.temperature ?? 1.0;
    this.fetcher = opts.fetcher ?? fetch;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  }

  async complete<T>(req: LlmRequest<ZodSchema<T>>): Promise<LlmResponse<T>>;
  async complete(req: LlmRequest): Promise<LlmResponse<string>>;
  async complete<T>(req: LlmRequest<ZodSchema<T>>): Promise<LlmResponse<T | string>> {
    const raw = await this.callWithRetry(req.system, req.user, req.maxTokens);
    if (!req.schema) {
      return { parsed: raw.content, raw: raw.content, usage: raw.usage, model: this.model };
    }
    const json = this.parseJson(raw.content);
    const result = req.schema.safeParse(json);
    if (!result.success) {
      throw new LlmSchemaError(result.error.issues.map((i) => i.message), json);
    }
    return { parsed: result.data, raw: raw.content, usage: raw.usage, model: this.model };
  }

  private async callWithRetry(
    system: string,
    user: string,
    maxTokens?: number,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    const first = await this.callOnce(system, user, maxTokens);
    if (this.looksLikeJson(first.content)) return first;
    const second = await this.callOnce(system, user + RETRY_SUFFIX, maxTokens);
    if (this.looksLikeJson(second.content)) return second;
    throw new LlmJsonParseError(second.content);
  }

  private async callOnce(
    system: string,
    user: string,
    maxTokens?: number,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    const res = await this.fetcher(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: this.temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
    });
    if (!res.ok) {
      throw new LlmHttpError(res.status, await res.text());
    }
    const data = (await res.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new LlmHttpError(200, "empty content");
    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  private looksLikeJson(s: string): boolean {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  private parseJson(s: string): unknown {
    const trimmed = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new LlmJsonParseError(s, err);
    }
  }
}
```

- [ ] **Step 6: Add barrel + helpers**

```ts
// packages/shared/src/llm/index.ts
export { OpenRouterClient } from "./openrouter";
export type { LlmRequest, LlmResponse, OpenRouterClientOptions } from "./openrouter";
export { LlmHttpError, LlmJsonParseError, LlmSchemaError } from "./errors";
export * from "./config";
```

```ts
// packages/shared/src/llm/config.ts
import type { PlatformId } from "@rivaleye/scrapers";

export const ENABLED_PLATFORMS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "medium",
  "trustpilot",
] as const;

export type EnabledPlatformId = (typeof ENABLED_PLATFORMS)[number];

export const LLM_MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat";
export const LLM_TEMPERATURE = 1.0;

export function readOpenRouterApiKey(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY is required");
  return k;
}

export function assertEnabled(p: PlatformId): EnabledPlatformId {
  if ((ENABLED_PLATFORMS as readonly string[]).includes(p)) return p as EnabledPlatformId;
  throw new Error(`platform ${p} is not enabled`);
}
```

Note: `config.ts` imports `PlatformId` from `@rivaleye/scrapers` (type-only). Add the dep in step 7.

- [ ] **Step 7: Add scrapers dep to shared**

```jsonc
// packages/shared/package.json — add to dependencies
"@rivaleye/scrapers": "workspace:*",
```

Run: `pnpm install`
Expected: success.

- [ ] **Step 8: Re-export from `shared/src/index.ts`**

```ts
// packages/shared/src/index.ts
export * from "./schemas/report";
export * from "./types/index";
export * from "./llm";
```

- [ ] **Step 9: Run the test — expect PASS**

Run: `pnpm --filter @rivaleye/shared exec bun test src/llm/openrouter.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 10: Add `OPENROUTER_MODEL` + `TRUSTPILOT_API_KEY` to `.env.example`**

```
# packages/shared (LLM client used by api + worker)
OPENROUTER_API_KEY=sk-or-v1-
OPENROUTER_MODEL=deepseek/deepseek-chat

# Scraper credentials (worker)
TRUSTPILOT_API_KEY=
```

Replace the existing `OPENROUTER_API_KEY=sk-or-v1-` line so the file ends up:

```
CONNECTION_STRING=postgresql://postgres:postgres@localhost:5432/rivaleye

BETTER_AUTH_SECRET=change-me-in-prod
BETTER_AUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Scraper credentials (worker)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=rivaleye/0.1
PRODUCTHUNT_TOKEN=
TRUSTPILOT_API_KEY=
X_API_BEARER=
APIFY_TOKEN=
GOOGLE_PLACES_API_KEY=

# LLM (shared client used by api + worker)
OPENROUTER_API_KEY=sk-or-v1-
OPENROUTER_MODEL=deepseek/deepseek-chat

# Frontend
VITE_API_URL=http://localhost:4000
```

- [ ] **Step 11: Type-check shared**

Run: `pnpm --filter @rivaleye/shared type-check`
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add packages/shared/ .env.example
git commit -m "$(cat <<'EOF'
feat(shared): single OpenRouter LLM client with Zod-validated responses

Why: api (keyword expansion) + worker (5 pipeline stages) all need the same
HTTP client. Lives in shared so the model + base URL are configured in one
place and swappable via OPENROUTER_MODEL.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Canonical Zod schemas for all 5 stages

**Files:**
- Create: `packages/worker/src/prompts/shared.ts`
- Create: `packages/worker/src/prompts/shared.test.ts`

- [ ] **Step 1: Write failing test for the canonical schemas**

```ts
// packages/worker/src/prompts/shared.test.ts
import { describe, expect, it } from "bun:test";
import {
  platformExtractSchema,
  platformBriefSchema,
  mergedClustersSchema,
  synthOutputSchema,
} from "./shared";

describe("canonical pipeline schemas", () => {
  it("accepts a minimal valid PlatformExtract", () => {
    expect(
      platformExtractSchema.safeParse({
        complaints: [],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [],
        voice_phrases: { positive: [], negative: [] },
        notable_quotes: [],
      }).success,
    ).toBe(true);
  });

  it("rejects PlatformExtract with wrong direction enum", () => {
    expect(
      platformExtractSchema.safeParse({
        complaints: [],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [
          { direction: "sideways", competitor: "x", evidence_ids: ["a"] },
        ],
        voice_phrases: { positive: [], negative: [] },
        notable_quotes: [],
      }).success,
    ).toBe(false);
  });

  it("accepts a minimal valid PlatformBrief", () => {
    expect(
      platformBriefSchema.safeParse({
        platform: "appstore",
        headline: "users hate the latest update",
        top_themes: [],
        sentiment: { positive: 0.2, neutral: 0.3, negative: 0.5 },
        most_quoted_competitors: [],
        evidence_coverage: 0,
      }).success,
    ).toBe(true);
  });

  it("accepts a minimal valid MergedClusters", () => {
    expect(
      mergedClustersSchema.safeParse({
        complaint_clusters: [],
        feature_clusters: [],
        pricing_clusters: [],
        switching_clusters: [],
        voice_top: { positive: [], negative: [] },
        cross_platform_themes: [],
      }).success,
    ).toBe(true);
  });

  it("accepts a minimal valid SynthOutput", () => {
    expect(
      synthOutputSchema.safeParse({
        complaints: [],
        feature_gaps: [],
        pricing_tiers: [],
        pricing_quotes: [],
        switching: [],
        quotes: [],
        voice_words: [],
        positioning: [],
        actions: [],
        leads: [],
        opportunities: [],
        threads: [],
        report_meta: {
          sentiment_overall: 0,
          sentiment_positive: 0,
          sentiment_neutral: 0,
          sentiment_negative: 0,
          sentiment_trend: "flat",
          voice_summary: null,
          voice_phrases: [],
          pricing_blended: null,
          pricing_pain_score: null,
          switching_net_signal: null,
          switching_reasons_out: [],
        },
      }).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL ("Cannot find module './shared'")**

Run: `pnpm --filter @rivaleye/worker exec bun test src/prompts/shared.test.ts`
Expected: failures.

- [ ] **Step 3: Implement the schemas**

```ts
// packages/worker/src/prompts/shared.ts
import { z } from "zod";

export const platformIdSchema = z.enum([
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "medium",
  "trustpilot",
]);

export const platformExtractSchema = z.object({
  complaints: z.array(
    z.object({
      text: z.string().min(1),
      severity: z.number().min(0).max(1),
      evidence_ids: z.array(z.string()).default([]),
    }),
  ),
  features_requested: z.array(
    z.object({ feature: z.string().min(1), evidence_ids: z.array(z.string()).default([]) }),
  ),
  pricing_signals: z.array(
    z.object({ note: z.string().min(1), evidence_ids: z.array(z.string()).default([]) }),
  ),
  switching_signals: z.array(
    z.object({
      direction: z.enum(["inbound", "outbound"]),
      competitor: z.string().min(1),
      evidence_ids: z.array(z.string()).default([]),
    }),
  ),
  voice_phrases: z.object({
    positive: z.array(z.string()),
    negative: z.array(z.string()),
  }),
  notable_quotes: z.array(
    z.object({
      author: z.string(),
      text: z.string().min(1),
      evidence_id: z.string(),
    }),
  ),
});

export const platformBriefSchema = z.object({
  platform: platformIdSchema,
  headline: z.string().min(1),
  top_themes: z.array(z.object({ theme: z.string().min(1), weight: z.number().min(0).max(1) })),
  sentiment: z.object({
    positive: z.number().min(0).max(1),
    neutral: z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
  }),
  most_quoted_competitors: z.array(z.string()),
  evidence_coverage: z.number().int().nonnegative(),
});

export const mergedClustersSchema = z.object({
  complaint_clusters: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      severity: z.number().min(0).max(1),
      platforms: z.array(platformIdSchema),
      evidence_ids: z.array(z.string()),
      sample_quote: z.string().nullable(),
    }),
  ),
  feature_clusters: z.array(
    z.object({
      feature: z.string(),
      demand_score: z.number().min(0).max(1),
      platforms: z.array(platformIdSchema),
      evidence_ids: z.array(z.string()),
    }),
  ),
  pricing_clusters: z.array(
    z.object({
      tier_label: z.string(),
      pain: z.number().min(0).max(1),
      note: z.string(),
      platforms: z.array(platformIdSchema),
      sample_quotes: z.array(z.object({ who: z.string(), text: z.string() })),
    }),
  ),
  switching_clusters: z.array(
    z.object({
      direction: z.enum(["inbound", "outbound"]),
      competitor: z.string(),
      count: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
      platforms: z.array(platformIdSchema),
    }),
  ),
  voice_top: z.object({
    positive: z.array(z.object({ word: z.string(), count: z.number().int().nonnegative() })),
    negative: z.array(z.object({ word: z.string(), count: z.number().int().nonnegative() })),
  }),
  cross_platform_themes: z.array(
    z.object({
      theme: z.string(),
      platforms: z.array(platformIdSchema),
      weight: z.number().min(0).max(1),
    }),
  ),
});

const sentimentTrendEnum = z.enum(["up", "down", "flat"]);
const effortEnum = z.enum(["low", "med", "high"]);
const payoffEnum = z.enum(["low", "med", "high"]);

export const synthOutputSchema = z.object({
  complaints: z.array(
    z.object({
      external_id: z.string(),
      title: z.string(),
      tag: z.string().nullable(),
      mentions: z.number().int().nonnegative(),
      delta: z.string().nullable(),
      severity: z.number().min(0).max(1),
      summary: z.string().nullable(),
      threads: z.number().int().nonnegative(),
      sample: z.string().nullable(),
    }),
  ),
  feature_gaps: z.array(
    z.object({
      feature: z.string(),
      votes: z.number().int().nonnegative(),
      signal: z.number().min(0).max(1),
    }),
  ),
  pricing_tiers: z.array(
    z.object({ tier: z.string(), pain: z.number().min(0).max(1), note: z.string().nullable() }),
  ),
  pricing_quotes: z.array(
    z.object({ who: z.string(), sub: z.string().nullable(), text: z.string() }),
  ),
  switching: z.array(
    z.object({
      direction: z.enum(["inbound", "outbound"]),
      competitor_name: z.string(),
      count: z.number().int().nonnegative(),
      share: z.number().min(0).max(1),
    }),
  ),
  quotes: z.array(
    z.object({
      who: z.string(),
      sub: z.string().nullable(),
      when_label: z.string().nullable(),
      score: z.number().int(),
      sentiment: z.number().nullable(),
      text: z.string(),
    }),
  ),
  voice_words: z.array(
    z.object({
      kind: z.enum(["positive", "negative"]),
      word: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  positioning: z.array(
    z.object({
      angle: z.string(),
      thesis: z.string().nullable(),
      audience: z.string().nullable(),
      against: z.string().nullable(),
    }),
  ),
  actions: z.array(
    z.object({
      step: z.string(),
      detail: z.string().nullable(),
      effort: effortEnum,
      role: z.string().nullable(),
    }),
  ),
  leads: z.array(
    z.object({
      who: z.string(),
      sub: z.string().nullable(),
      when_label: z.string().nullable(),
      score: z.number().int(),
      signal: z.string().nullable(),
      quote: z.string().nullable(),
    }),
  ),
  opportunities: z.array(
    z.object({
      title: z.string(),
      thesis: z.string().nullable(),
      effort: effortEnum,
      payoff: payoffEnum,
      anchor_complaint_external_id: z.string().nullable(),
    }),
  ),
  threads: z.array(
    z.object({
      complaint_external_id: z.string().nullable(),
      platform: platformIdSchema,
      url: z.string().nullable(),
      title: z.string(),
      author: z.string().nullable(),
      sub: z.string().nullable(),
      posted_at: z.string().datetime().nullable(),
      score: z.number().int(),
      messages: z
        .array(
          z.object({
            author: z.string().nullable(),
            body: z.string(),
            posted_at: z.string().datetime().nullable(),
            score: z.number().int(),
          }),
        )
        .default([]),
    }),
  ),
  report_meta: z.object({
    sentiment_overall: z.number().min(-1).max(1),
    sentiment_positive: z.number().min(0).max(1),
    sentiment_neutral: z.number().min(0).max(1),
    sentiment_negative: z.number().min(0).max(1),
    sentiment_trend: sentimentTrendEnum,
    voice_summary: z.string().nullable(),
    voice_phrases: z.array(z.string()),
    pricing_blended: z.string().nullable(),
    pricing_pain_score: z.number().min(0).max(1).nullable(),
    switching_net_signal: z.string().nullable(),
    switching_reasons_out: z.array(z.string()),
  }),
});

export type PlatformExtract = z.infer<typeof platformExtractSchema>;
export type PlatformBrief = z.infer<typeof platformBriefSchema>;
export type MergedClusters = z.infer<typeof mergedClustersSchema>;
export type SynthOutput = z.infer<typeof synthOutputSchema>;

export interface PipelineCtx {
  reportId: string;
  competitor: string;
  category: string;
  audience: string | null;
  goal: string;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/prompts/shared.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: no errors related to the new file (existing errors fine — they'll get fixed when we delete old pipeline in Task 14).

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/shared.ts packages/worker/src/prompts/shared.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): canonical Zod schemas for the 5 pipeline stages

Why: every stage produces and consumes structured JSON; one source of truth
keeps cross-platform synth, refine, and persist in lockstep.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Port the App Store scraper (proof-of-concept platform)

**Files:**
- Create: `packages/scrapers/src/appstore/client.ts`
- Create: `packages/scrapers/src/appstore/normalize.ts`
- Create: `packages/scrapers/src/appstore/normalize.test.ts`
- Create: `packages/scrapers/src/__fixtures__/appstore.json`
- Modify: `packages/scrapers/src/appstore/index.ts`
- Modify: `packages/scrapers/src/index.ts` (no behaviour change here)

- [ ] **Step 1: Capture a real iTunes payload fixture**

Run (manually, paste output as the fixture):
```bash
curl -s 'https://itunes.apple.com/search?term=notion&country=us&entity=software&limit=2&lang=en_us' > /tmp/appstore-search.json
curl -s 'https://itunes.apple.com/rss/customerreviews/page=1/id=1232780281/sortBy=mostRecent/json?l=en&cc=us' > /tmp/appstore-reviews.json
```

Combine into `packages/scrapers/src/__fixtures__/appstore.json` shaped as:

```json
{
  "search": { /* paste full contents of /tmp/appstore-search.json */ },
  "reviews": { /* paste full contents of /tmp/appstore-reviews.json */ }
}
```

The fixture must contain at least one app with at least one review.

- [ ] **Step 2: Write the failing normalizer test**

```ts
// packages/scrapers/src/appstore/normalize.test.ts
import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/appstore.json";
import { normalizeAppStorePayload } from "./normalize";

describe("appstore normalizer", () => {
  it("converts an app + its reviews into NormalizedPost[]", () => {
    const app = (fixture as { search: { results: unknown[] } }).search.results[0];
    const reviews = (fixture as { reviews: unknown }).reviews;
    const posts = normalizeAppStorePayload([app], { app: reviews });
    expect(posts.length).toBeGreaterThan(0);
    const first = posts[0]!;
    expect(first.platform).toBe("appstore");
    expect(first.externalId).toMatch(/^appstore:.+:.+/);
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.createdAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/scrapers exec bun test src/appstore/normalize.test.ts`
Expected: failure ("Cannot find module './normalize'").

- [ ] **Step 4: Implement raw client + normalizer**

```ts
// packages/scrapers/src/appstore/client.ts
import { ScraperError } from "../types";

export interface RawAppStoreApp {
  trackId: number;
  bundleId: string;
  trackName: string;
  artistName: string;
  version: string;
  averageUserRating?: number;
  userRatingCount?: number;
  averageUserRatingForCurrentVersion?: number;
  userRatingCountForCurrentVersion?: number;
  description: string;
  releaseNotes?: string;
  primaryGenreName: string;
  trackViewUrl: string;
  releaseDate: string;
  currentVersionReleaseDate: string;
}

export interface RawAppStoreReview {
  id: { label: string };
  author: { name: { label: string } };
  "im:rating": { label: string };
  "im:version"?: { label: string };
  title: { label: string };
  content: { label: string };
  updated: { label: string };
}

export interface RawAppStoreReviewsFeed {
  feed?: { entry?: RawAppStoreReview[] };
}

export async function searchApps(
  term: string,
  country: string,
  limit: number,
): Promise<RawAppStoreApp[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=${limit}&lang=en_us`;
  const res = await fetch(url);
  if (!res.ok) throw new ScraperError("appstore", `search HTTP ${res.status}`);
  const data = (await res.json()) as { results: RawAppStoreApp[] };
  return data.results;
}

export async function fetchReviews(
  appId: number,
  country: string,
  pages: number,
): Promise<RawAppStoreReview[]> {
  const out: RawAppStoreReview[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://itunes.apple.com/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json?l=en&cc=${country}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = (await res.json()) as RawAppStoreReviewsFeed;
    const entries = data.feed?.entry ?? [];
    const reviewEntries = entries.filter((e) => !!e["im:rating"]);
    if (reviewEntries.length === 0) break;
    out.push(...reviewEntries);
  }
  return out;
}
```

```ts
// packages/scrapers/src/appstore/normalize.ts
import type { NormalizedPost } from "../types";
import type { RawAppStoreApp, RawAppStoreReview, RawAppStoreReviewsFeed } from "./client";

export function normalizeAppStorePayload(
  apps: RawAppStoreApp[],
  reviewsByAppId: Record<string, RawAppStoreReviewsFeed>,
): NormalizedPost[] {
  const out: NormalizedPost[] = [];
  for (const app of apps) {
    const feed = reviewsByAppId[String(app.trackId)] ?? reviewsByAppId.app;
    const entries = (feed?.feed?.entry ?? []).filter((e): e is RawAppStoreReview => !!e?.["im:rating"]);
    out.push(...entries.map((r) => normalizeReview(app, r)));
  }
  return out;
}

function normalizeReview(app: RawAppStoreApp, r: RawAppStoreReview): NormalizedPost {
  const rating = parseInt(r["im:rating"].label, 10);
  const title = r.title.label;
  const content = r.content.label;
  return {
    platform: "appstore",
    externalId: `appstore:${app.trackId}:${r.id.label}`,
    url: app.trackViewUrl,
    author: r.author.name.label || null,
    title,
    body: `${title}\n\n${content}\n\n— ${rating}/5 on ${app.trackName} v${r["im:version"]?.label ?? app.version}`,
    score: rating,
    numComments: null,
    createdAt: new Date(r.updated.label),
    raw: { app, review: r },
  };
}
```

- [ ] **Step 5: Run normalizer test — expect PASS**

Run: `pnpm --filter @rivaleye/scrapers exec bun test src/appstore/normalize.test.ts`
Expected: 1 test passes.

- [ ] **Step 6: Implement the `AppStoreScraper` class**

```ts
// packages/scrapers/src/appstore/index.ts
import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchReviews, searchApps, type RawAppStoreReviewsFeed } from "./client";
import { normalizeAppStorePayload } from "./normalize";

const DEFAULT_APP_LIMIT = 5;
const DEFAULT_REVIEW_PAGES = 10;
const DEFAULT_COUNTRY = "us";

export class AppStoreScraper implements Scraper {
  readonly platform = "appstore" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const apps = await searchApps(
        query.competitor,
        DEFAULT_COUNTRY,
        query.limit ?? DEFAULT_APP_LIMIT,
      );
      const reviewsByAppId: Record<string, RawAppStoreReviewsFeed> = {};
      await Promise.all(
        apps.map(async (a) => {
          const entries = await fetchReviews(a.trackId, DEFAULT_COUNTRY, DEFAULT_REVIEW_PAGES);
          reviewsByAppId[String(a.trackId)] = { feed: { entry: entries } };
        }),
      );
      return normalizeAppStorePayload(apps, reviewsByAppId);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("appstore", "fetch failed", err);
    }
  }
}
```

- [ ] **Step 7: Type-check the scrapers package**

Run: `pnpm --filter @rivaleye/scrapers type-check`
Expected: no errors.

- [ ] **Step 8: Smoke-run against the live iTunes API**

Run: `bun -e 'import("./packages/scrapers/src/appstore").then(async ({AppStoreScraper}) => { const r = await new AppStoreScraper().fetch({competitor:"notion"}); console.log(r.length, r[0]); })'`
Expected: prints a count > 0 and the first `NormalizedPost` shape with `platform:"appstore"`. If 0, search a different term — keep retrying until you see real data; do not commit otherwise.

- [ ] **Step 9: Commit**

```bash
git add packages/scrapers/src/appstore/ packages/scrapers/src/__fixtures__/appstore.json
git commit -m "$(cat <<'EOF'
feat(scrapers): port appstore from competitor-research/

Why: real implementation replacing the not-implemented stub. Free iTunes
Search + RSS feed; outputs one NormalizedPost per review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Stage A (per-platform extract) prompt + stage runner — using appstore as first platform

**Files:**
- Create: `packages/worker/src/prompts/platform/appstore/extract.ts`
- Create: `packages/worker/src/pipeline/stage-a-extract.ts`
- Create: `packages/worker/src/pipeline/stage-a-extract.test.ts`

- [ ] **Step 1: Write the prompt builder**

```ts
// packages/worker/src/prompts/platform/appstore/extract.ts
import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from App Store reviews.
You will receive a list of reviews each labelled with a stable id. Return ONE JSON object that conforms to the supplied schema.
Rules:
- Use the id labels in evidence_ids; never invent ids.
- complaints[].severity is 0..1 (higher = harsher).
- voice_phrases.positive and .negative are short (1-3 word) phrases users actually used.
- switching_signals: only when a reviewer explicitly mentions another competing product.
- If a section has no signal, return an empty array — never fabricate.`;

export interface AppStoreExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildAppStoreExtract(input: AppStoreExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | rating=${r.rating}/5 | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

App Store reviews (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
```

- [ ] **Step 2: Write the failing stage-runner test**

```ts
// packages/worker/src/pipeline/stage-a-extract.test.ts
import { describe, expect, it } from "bun:test";
import { runStageAExtract } from "./stage-a-extract";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageAExtract (appstore)", () => {
  it("invokes the LLM with the appstore prompt and returns the parsed extract", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          complaints: [
            { text: "sync breaks daily", severity: 0.8, evidence_ids: ["r1"] },
          ],
          features_requested: [],
          pricing_signals: [],
          switching_signals: [],
          voice_phrases: { positive: [], negative: ["sync breaks"] },
          notable_quotes: [],
        },
        raw: "{}",
        usage: { promptTokens: 10, completionTokens: 5 },
        model: "test",
      }),
    } as unknown as OpenRouterClient;

    const result = await runStageAExtract({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: "founders",
        goal: "find_user_pain",
      },
      platform: "appstore",
      posts: [
        {
          externalId: "appstore:1:r1",
          title: "broken",
          body: "sync breaks daily",
          score: 1,
          numComments: null,
          author: "u",
          url: "u",
          platform: "appstore",
          createdAt: new Date(),
          raw: {},
        },
      ],
    });
    expect(result.extract.complaints.length).toBe(1);
    expect(result.usage.promptTokens).toBe(10);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-a-extract.test.ts`
Expected: failure ("Cannot find module './stage-a-extract'").

- [ ] **Step 4: Implement the stage runner**

```ts
// packages/worker/src/pipeline/stage-a-extract.ts
import type { NormalizedPost, PlatformId } from "@rivaleye/scrapers";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformExtract } from "../prompts/shared";
import { buildAppStoreExtract } from "../prompts/platform/appstore/extract";

export interface StageAInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  posts: NormalizedPost[];
}

export interface StageAOutput {
  extract: PlatformExtract;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageAExtract(input: StageAInput): Promise<StageAOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder(input);
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  });
  return { extract: res.parsed, usage: res.usage, model: res.model };
}

type Builder = (input: StageAInput) => {
  system: string;
  user: string;
  schema: typeof import("../prompts/shared").platformExtractSchema;
};

function pickBuilder(p: PlatformId): Builder {
  switch (p) {
    case "appstore":
      return ({ ctx, posts }) =>
        buildAppStoreExtract({
          ctx,
          reviews: posts.map((p) => ({
            id: p.externalId,
            rating: p.score ?? 0,
            body: `${p.title ?? ""}\n${p.body}`,
          })),
        });
    default:
      throw new Error(`Stage A: no extract builder for platform "${p}" yet`);
  }
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-a-extract.test.ts`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/platform/appstore/ packages/worker/src/pipeline/stage-a-extract.ts packages/worker/src/pipeline/stage-a-extract.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): Stage A extract — runner + appstore prompt

Why: per-platform Stage A is the first LLM call in the new pipeline; wiring
appstore first proves the contract before fanning out to all 8 platforms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Stage B (per-platform summarize) prompt + stage runner — using appstore as first platform

**Files:**
- Create: `packages/worker/src/prompts/platform/appstore/summarize.ts`
- Create: `packages/worker/src/pipeline/stage-b-summarize.ts`
- Create: `packages/worker/src/pipeline/stage-b-summarize.test.ts`

- [ ] **Step 1: Write the prompt builder**

```ts
// packages/worker/src/prompts/platform/appstore/summarize.ts
import { platformBriefSchema, type PipelineCtx, type PlatformExtract } from "../../shared";

const SYSTEM = `You are a research analyst writing a one-page brief from extracted App Store signals.
Return ONE JSON object matching the schema.
Rules:
- headline is one declarative sentence (no hedging).
- top_themes weights sum to ~1.0 across all themes.
- sentiment.positive + sentiment.neutral + sentiment.negative must sum to 1.0.
- evidence_coverage = total distinct evidence ids you actually drew on.
- If extract has no signal in a section, weight that theme as 0 — do not invent.`;

export function buildAppStoreSummarize(input: {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}): { system: string; user: string; schema: typeof platformBriefSchema } {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}

App Store extract (JSON):
${JSON.stringify(input.extract, null, 2)}

Return the brief JSON now. platform="appstore".`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
```

- [ ] **Step 2: Write the failing stage-runner test**

```ts
// packages/worker/src/pipeline/stage-b-summarize.test.ts
import { describe, expect, it } from "bun:test";
import type { OpenRouterClient } from "@rivaleye/shared";
import { runStageBSummarize } from "./stage-b-summarize";

describe("runStageBSummarize (appstore)", () => {
  it("returns a parsed PlatformBrief", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          platform: "appstore",
          headline: "sync issues dominate negative reviews",
          top_themes: [{ theme: "sync", weight: 1 }],
          sentiment: { positive: 0.2, neutral: 0.3, negative: 0.5 },
          most_quoted_competitors: [],
          evidence_coverage: 1,
        },
        raw: "{}",
        usage: { promptTokens: 5, completionTokens: 5 },
        model: "test",
      }),
    } as unknown as OpenRouterClient;
    const res = await runStageBSummarize({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: null,
        goal: "find_user_pain",
      },
      platform: "appstore",
      extract: {
        complaints: [],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [],
        voice_phrases: { positive: [], negative: [] },
        notable_quotes: [],
      },
    });
    expect(res.brief.platform).toBe("appstore");
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-b-summarize.test.ts`
Expected: failure ("Cannot find module").

- [ ] **Step 4: Implement the runner**

```ts
// packages/worker/src/pipeline/stage-b-summarize.ts
import type { PlatformId } from "@rivaleye/scrapers";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../prompts/shared";
import { buildAppStoreSummarize } from "../prompts/platform/appstore/summarize";

export interface StageBInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  extract: PlatformExtract;
}

export interface StageBOutput {
  brief: PlatformBrief;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageBSummarize(input: StageBInput): Promise<StageBOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder(input.ctx, input.extract);
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  });
  return { brief: res.parsed, usage: res.usage, model: res.model };
}

function pickBuilder(p: PlatformId) {
  switch (p) {
    case "appstore":
      return (ctx: PipelineCtx, extract: PlatformExtract) =>
        buildAppStoreSummarize({ ctx, extract });
    default:
      throw new Error(`Stage B: no summarize builder for platform "${p}" yet`);
  }
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-b-summarize.test.ts`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/platform/appstore/summarize.ts packages/worker/src/pipeline/stage-b-summarize.ts packages/worker/src/pipeline/stage-b-summarize.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): Stage B summarize — runner + appstore prompt

Why: completes per-platform layer for appstore. Adding remaining 7 platforms
follows the same pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Pipeline-jobs service in api + queue payload typed in shared

**Files:**
- Create: `packages/api/src/services/pipeline-jobs.service.ts`
- Modify: `packages/api/src/libs/queue.ts`
- Modify: `packages/worker/src/queue.ts`  (kept as a re-export for now; deleted in Task 17)

- [ ] **Step 1: Add helpers for inserting + transitioning jobs**

```ts
// packages/api/src/services/pipeline-jobs.service.ts
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { report_platform_jobs, type NewReportPlatformJob } from "@/db/schema/pipeline";

export async function createPlatformJobs(
  rows: NewReportPlatformJob[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(report_platform_jobs).values(rows);
}

export async function markPlatformJobRunning(
  report_id: string,
  platform: string,
): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "running", started_at: new Date() })
    .where(
      and(eq(report_platform_jobs.report_id, report_id), eq(report_platform_jobs.platform, platform)),
    );
}

export async function markPlatformJobCompleted(
  report_id: string,
  platform: string,
): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "completed", completed_at: new Date() })
    .where(
      and(eq(report_platform_jobs.report_id, report_id), eq(report_platform_jobs.platform, platform)),
    );
}

export async function markPlatformJobFailed(
  report_id: string,
  platform: string,
  error: string,
): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "failed", error, completed_at: new Date() })
    .where(
      and(eq(report_platform_jobs.report_id, report_id), eq(report_platform_jobs.platform, platform)),
    );
}

export async function countUnfinishedPlatformJobs(report_id: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.report_id, report_id),
        inArray(report_platform_jobs.status, ["queued", "running"]),
      ),
    );
  return row?.n ?? 0;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/pipeline-jobs.service.ts
git commit -m "$(cat <<'EOF'
feat(api): platform-jobs service for fan-out + fan-in bookkeeping

Why: createReport (fan-out) and scrape-platform (fan-in check) both need
the same status helpers. One service avoids drift between callers.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Keyword expander service in api

**Files:**
- Create: `packages/api/src/services/keyword-expander.ts`
- Create: `packages/api/src/services/keyword-expander.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/api/src/services/keyword-expander.test.ts
import { describe, expect, it } from "bun:test";
import type { OpenRouterClient } from "@rivaleye/shared";
import { expandKeywords } from "./keyword-expander";

describe("expandKeywords", () => {
  it("returns the parsed keyword list, capped at 10", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          keywords: ["notion", "notion ai", "notion alternatives", "roam vs notion"],
        },
        raw: "{}",
        usage: { promptTokens: 5, completionTokens: 5 },
        model: "test",
      }),
    } as unknown as OpenRouterClient;
    const out = await expandKeywords(fakeLlm, {
      competitor: "Notion",
      category: "productivity",
      audience: "founders",
      goal: "find_user_pain",
    });
    expect(out).toEqual(["notion", "notion ai", "notion alternatives", "roam vs notion"]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/api exec bun test src/services/keyword-expander.test.ts`
Expected: failure ("Cannot find module").

- [ ] **Step 3: Implement**

```ts
// packages/api/src/services/keyword-expander.ts
import { z } from "zod";
import type { OpenRouterClient } from "@rivaleye/shared";

const SYSTEM = `You expand a competitor + category into 5-10 short search queries.
Return ONE JSON object: { "keywords": string[] }. Each keyword 1-4 words. No punctuation, no quotes.
Include: the competitor name; "<competitor> alternatives"; "<competitor> vs"; common feature variants; common pain variants.`;

const schema = z.object({ keywords: z.array(z.string().min(1).max(60)).max(10) });

export interface KeywordInput {
  competitor: string;
  category: string;
  audience: string | null;
  goal: string;
}

export async function expandKeywords(
  llm: OpenRouterClient,
  input: KeywordInput,
): Promise<string[]> {
  const user = `Competitor: ${input.competitor}
Category: ${input.category}
Audience: ${input.audience ?? "unspecified"}
Founder goal: ${input.goal}

Return the JSON now.`;
  const res = await llm.complete({ system: SYSTEM, user, schema });
  return res.parsed.keywords;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @rivaleye/api exec bun test src/services/keyword-expander.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/keyword-expander.ts packages/api/src/services/keyword-expander.test.ts
git commit -m "$(cat <<'EOF'
feat(api): LLM keyword-expansion service

Why: single LLM call before fan-out gives each scraper a richer query set
than just the bare competitor name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update `createReport` service — fan-out over enabled platforms

**Files:**
- Modify: `packages/api/src/services/reports.service.ts`

- [ ] **Step 1: Add a singleton LLM client at the top of the service**

Edit `packages/api/src/services/reports.service.ts`, replace the imports block at the top of the file with:

```ts
import { db } from "@/db/client";
import {
  reports,
  report_complaints,
  report_feature_gaps,
  report_pricing_tiers,
  report_pricing_quotes,
  report_switching,
  report_quotes,
  report_voice_words,
  report_positioning,
  report_actions,
  report_leads,
  report_opportunities,
  report_platform_stats,
  report_subreddits,
  report_threads,
  report_thread_messages,
  type Report,
} from "@/db/schema/reports";
import { enqueueScrapePlatform } from "@/libs/queue";
import { and, asc, eq } from "drizzle-orm";
import type { CreateReportInput } from "@rivaleye/shared";
import {
  ENABLED_PLATFORMS,
  LLM_MODEL,
  OpenRouterClient,
  readOpenRouterApiKey,
} from "@rivaleye/shared";
import { expandKeywords } from "./keyword-expander";
import { createPlatformJobs } from "./pipeline-jobs.service";

let llmSingleton: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (!llmSingleton) {
    llmSingleton = new OpenRouterClient({
      apiKey: readOpenRouterApiKey(),
      model: LLM_MODEL,
    });
  }
  return llmSingleton;
}
```

- [ ] **Step 2: Replace the body of `createReport`**

Replace lines 50-78 (the entire `export async function createReport(...)` block) with:

```ts
export async function createReport(
  owner_id: string,
  input: CreateReportInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(reports)
    .values({
      owner_id,
      category: input.category,
      competitors: input.competitors,
      audience: input.target_audience,
      goal: input.founder_goal,
      status: "queued",
      stage: "queued",
      primary_competitor_name: input.competitors[0] ?? null,
    })
    .returning({ id: reports.id });

  if (!row) throw new Error("Failed to insert report");

  const competitor = input.competitors[0] ?? input.category;
  const keywords = await expandKeywords(getLlm(), {
    competitor,
    category: input.category,
    audience: input.target_audience,
    goal: input.founder_goal,
  });

  await createPlatformJobs(
    ENABLED_PLATFORMS.map((platform) => ({ report_id: row.id, platform })),
  );

  await Promise.all(
    ENABLED_PLATFORMS.map((platform) =>
      enqueueScrapePlatform({
        reportId: row.id,
        platform,
        competitor,
        category: input.category,
        keywords,
      }),
    ),
  );

  return { id: row.id };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @rivaleye/api type-check`
Expected: no errors.

- [ ] **Step 4: Smoke-test by hitting the endpoint locally**

Pre-requisite: `OPENROUTER_API_KEY` set in `.env`. Worker doesn't need to be running for this step.

Start the api: `pnpm --filter @rivaleye/api dev`
In another terminal:

```bash
TOKEN=... # sign-in via /v1/auth/sign-in to obtain a session cookie or jwt
curl -X POST http://localhost:4000/v1/reports \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=$TOKEN" \
  -d '{"category":"productivity","competitors":["Notion"],"target_audience":"founders","founder_goal":"find_user_pain"}'
```

Expected response: `{"data":{"id":"<uuid>","stage":"queued"}}`

Verify in DB: `psql "$CONNECTION_STRING" -c "SELECT platform, status FROM report_platform_jobs WHERE report_id='<uuid>'"` — 8 rows, all status=queued.

Stop the api (Ctrl-C).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/reports.service.ts
git commit -m "$(cat <<'EOF'
feat(api): createReport fans out 8 platform jobs after keyword expansion

Why: replaces the reddit-only enqueue with the multi-platform fan-out the
new pipeline depends on. report_platform_jobs rows pre-seeded so the
fan-in check in worker has authoritative state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Rewrite `scrape-platform` handler — wire scraper + Stage A + Stage B + fan-in

**Files:**
- Modify: `packages/worker/src/jobs/scrape-platform.ts`

- [ ] **Step 1: Replace the file content**

```ts
// packages/worker/src/jobs/scrape-platform.ts
import { getScraper } from "@rivaleye/scrapers";
import {
  LLM_MODEL,
  OpenRouterClient,
  readOpenRouterApiKey,
} from "@rivaleye/shared";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_briefs,
  report_platform_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { boss, QUEUES, type ScrapePlatformJob } from "../queue";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";

const CHUNK_SIZE = 500;

let llmSingleton: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (!llmSingleton) {
    llmSingleton = new OpenRouterClient({
      apiKey: readOpenRouterApiKey(),
      model: LLM_MODEL,
    });
  }
  return llmSingleton;
}

export async function handleScrapePlatform(data: ScrapePlatformJob) {
  console.log(
    `[scrape] start reportId=${data.reportId} platform=${data.platform} competitor="${data.competitor}"`,
  );

  await markRunning(data.reportId, data.platform);

  try {
    const report = await loadReport(data.reportId);
    if (!report) throw new Error(`report ${data.reportId} not found`);

    const scraper = getScraper(data.platform);
    const posts = await scraper.fetch({
      competitor: data.competitor,
      category: data.category,
      keywords: data.keywords,
    });

    console.log(`[scrape] fetched ${posts.length} posts for ${data.platform}/${data.competitor}`);

    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      const chunk = posts.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 0) continue;
      await db
        .insert(mentions)
        .values(
          chunk.map((p) => ({
            report_id: data.reportId,
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
      .where(eq(reports.id, data.reportId));

    if (posts.length > 0) {
      const llm = getLlm();
      const ctx = {
        reportId: data.reportId,
        competitor: data.competitor,
        category: data.category ?? "",
        audience: report.audience,
        goal: report.goal,
      };

      const stageA = await runStageAExtract({ llm, ctx, platform: data.platform, posts });
      const stageB = await runStageBSummarize({
        llm,
        ctx,
        platform: data.platform,
        extract: stageA.extract,
      });

      await db
        .insert(report_platform_briefs)
        .values({
          report_id: data.reportId,
          platform: data.platform,
          extract: stageA.extract as unknown as Record<string, unknown>,
          summary: stageB.brief as unknown as Record<string, unknown>,
          model_used: stageA.model,
          prompt_tokens: stageA.usage.promptTokens + stageB.usage.promptTokens,
          completion_tokens: stageA.usage.completionTokens + stageB.usage.completionTokens,
        })
        .onConflictDoNothing();
    }

    await markCompleted(data.reportId, data.platform);
    await fanIn(data.reportId);
    return { count: posts.length };
  } catch (err) {
    console.error(`[scrape] platform=${data.platform} failed`, err);
    await markFailed(data.reportId, data.platform, asMessage(err));
    await fanIn(data.reportId);
    throw err;
  }
}

async function loadReport(reportId: string) {
  const [r] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  return r ?? null;
}

async function markRunning(reportId: string, platform: string) {
  await db
    .update(report_platform_jobs)
    .set({ status: "running", started_at: new Date() })
    .where(and(eq(report_platform_jobs.report_id, reportId), eq(report_platform_jobs.platform, platform)));
}
async function markCompleted(reportId: string, platform: string) {
  await db
    .update(report_platform_jobs)
    .set({ status: "completed", completed_at: new Date() })
    .where(and(eq(report_platform_jobs.report_id, reportId), eq(report_platform_jobs.platform, platform)));
}
async function markFailed(reportId: string, platform: string, error: string) {
  await db
    .update(report_platform_jobs)
    .set({ status: "failed", error, completed_at: new Date() })
    .where(and(eq(report_platform_jobs.report_id, reportId), eq(report_platform_jobs.platform, platform)));
}

async function fanIn(reportId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        inArray(report_platform_jobs.status, ["queued", "running"]),
      ),
    );
  const remaining = row?.n ?? 0;
  if (remaining === 0) {
    await boss.send(QUEUES.generateReport, { reportId });
    console.log(`[scrape] all platform jobs done → enqueued generate-report for ${reportId}`);
  } else {
    console.log(`[scrape] ${remaining} platform jobs still in flight for ${reportId}`);
  }
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
```

- [ ] **Step 2: Type-check (will surface unused imports in old pipeline files — ignore for now, they're deleted in Task 14)**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: only pre-existing errors from old pipeline files. No new errors from this file.

- [ ] **Step 3: End-to-end smoke (single-platform)**

Manually disable all platforms except appstore by editing `packages/shared/src/llm/config.ts` temporarily to `ENABLED_PLATFORMS = ["appstore"] as const`. Don't commit that change.

Start worker + api:
```bash
pnpm --filter @rivaleye/api dev &
pnpm --filter @rivaleye/worker dev &
```

Create a report via the curl from Task 9 Step 4. Watch worker logs for:
```
[scrape] start reportId=... platform=appstore competitor="Notion"
[scrape] fetched N posts ...
[scrape] all platform jobs done → enqueued generate-report for ...
```

Verify DB:
- `SELECT count(*) FROM mentions WHERE report_id='<uuid>'` — > 0
- `SELECT platform, extract->'complaints' FROM report_platform_briefs WHERE report_id='<uuid>'` — one row with non-null extract
- `SELECT status FROM report_platform_jobs WHERE report_id='<uuid>'` — completed

Revert `ENABLED_PLATFORMS` back to all 8.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/jobs/scrape-platform.ts
git commit -m "$(cat <<'EOF'
feat(worker): scrape-platform runs Stage A + B and fans in to generate-report

Why: per-platform LLM extract + summarize now happen inside the same job
that scrapes; fan-in check enqueues generate-report once all 8 platform
jobs are out of queued/running.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Port the remaining 6 free scrapers (playstore, hackernews, producthunt, devto, medium, trustpilot)

This task is the largest by volume but the most repetitive. **One sub-task per platform** — each follows the same recipe as Task 4 (appstore) and adds the same Stage A + Stage B prompt files as Task 5 + 6. Complete each platform end-to-end (scraper class + normalizer test + prompts + extend `pickBuilder` in stage-a-extract and stage-b-summarize) before moving to the next.

**For every platform `<P>` in [playstore, hackernews, producthunt, devto, medium, trustpilot]:**

### 11.<n>: Port `<P>` scraper + Stage A + Stage B

**Files (per platform):**
- Create: `packages/scrapers/src/<P>/client.ts`
- Create: `packages/scrapers/src/<P>/normalize.ts`
- Create: `packages/scrapers/src/<P>/normalize.test.ts`
- Create: `packages/scrapers/src/__fixtures__/<P>.json`
- Modify: `packages/scrapers/src/<P>/index.ts` (or create if absent)
- Create: `packages/worker/src/prompts/platform/<P>/extract.ts`
- Create: `packages/worker/src/prompts/platform/<P>/summarize.ts`
- Modify: `packages/worker/src/pipeline/stage-a-extract.ts` (add case)
- Modify: `packages/worker/src/pipeline/stage-b-summarize.ts` (add case)

**Per-platform notes:**

- **playstore**: source = `competitor-research/playstore.ts`. Uses `google-play-scraper` npm dep. Add `"google-play-scraper": "^9.1.1"` to `packages/scrapers/package.json` dependencies, run `pnpm install`. Drop `permissions, datasafety, similar`. One `NormalizedPost` per review with `externalId = \`playstore:<appId>:<reviewId>\``.
- **hackernews**: source = `competitor-research/hackernews.ts`. No deps. One `NormalizedPost` per top story; concatenate up to 10 top comments into `body` separated by `\n---\n`. `externalId = \`hackernews:<storyId>\``. Drop `recentStories, recentComments, summary` blocks; the brief covers them.
- **producthunt**: source = `competitor-research/producthunt.ts`. Reads `PRODUCTHUNT_TOKEN` (already in `.env.example`). One `NormalizedPost` per post + one per comment with `externalId = \`producthunt:post:<postId>\`` / `\`producthunt:comment:<commentId>\``.
- **devto**: source = `competitor-research/devto.ts`. No deps. One `NormalizedPost` per article + one per comment. `externalId = \`devto:article:<articleId>\``.
- **medium**: source = `competitor-research/hashnode.ts` (Medium RSS — note: file is named `hashnode.ts` historically). Needs `fast-xml-parser` dep — add `"fast-xml-parser": "^4.5.6"` to `packages/scrapers/package.json`. One `NormalizedPost` per RSS item. `externalId = \`medium:<urlHash>\`` where urlHash = `crypto.createHash("md5").update(p.url).digest("hex")`.
- **trustpilot**: source = `competitor-research/trustpilot.ts`. Reads `TRUSTPILOT_API_KEY`. One `NormalizedPost` per review with `externalId = \`trustpilot:<businessId>:<reviewId>\``. Map review `stars` (1-5) to `score`.

**Common prompt templates** — every platform uses the same canonical `platformExtractSchema` / `platformBriefSchema`. Use the appstore prompts in Task 5/6 as the template; swap the `SYSTEM` description sentence to mention the right platform (e.g., "extracting product-feedback signals from Hacker News threads and comments"), and swap the user-message body block builder to match the post shape coming from that platform's normalizer.

**Sub-task step pattern (do this whole sequence for each platform before moving on):**

- [ ] **Step 1: Capture fixture** — run the curl/script for the platform against the live API and save to `__fixtures__/<P>.json`. Must include at least one post; trustpilot fixture needs a `TRUSTPILOT_API_KEY` (use a test query like `spotify.com`).
- [ ] **Step 2: Write failing normalizer test** modelled exactly on Task 4 Step 2 — assert `posts.length > 0`, platform, externalId prefix, body non-empty, createdAt is `Date`.
- [ ] **Step 3: `bun test src/<P>/normalize.test.ts` — expect FAIL.**
- [ ] **Step 4: Implement `client.ts` + `normalize.ts` + `index.ts`** following the appstore shape.
- [ ] **Step 5: `bun test src/<P>/normalize.test.ts` — expect PASS.**
- [ ] **Step 6: Smoke run** — `bun -e 'import("./packages/scrapers/src/<P>").then(async (m) => { const r = await new m.<ClassName>().fetch({competitor:"notion"}); console.log(r.length, r[0]); })'`. Must print > 0 and a valid post.
- [ ] **Step 7: Write Stage A extract prompt** — copy `packages/worker/src/prompts/platform/appstore/extract.ts` to `packages/worker/src/prompts/platform/<P>/extract.ts`; rewrite SYSTEM platform-specific sentence; adjust the user-block builder to fit the platform's post shape (e.g. include comment thread for hackernews, tags for devto, RSS publish date for medium, stars+verified flag for trustpilot).
- [ ] **Step 8: Write Stage B summarize prompt** — copy appstore summarize, swap SYSTEM sentence to mention the platform name. Schema stays identical.
- [ ] **Step 9: Extend `pickBuilder` in `pipeline/stage-a-extract.ts`** — add a new `case "<P>":` that constructs the platform's extract input from `posts` (mirror the appstore mapping but use the fields that make sense for the platform — e.g., title+body for hackernews, body+tags for devto, body+stars for trustpilot, body+upvotes for producthunt).
- [ ] **Step 10: Extend `pickBuilder` in `pipeline/stage-b-summarize.ts`** — add the matching `case "<P>":`.
- [ ] **Step 11: Add a stage-runner test for `<P>`** — copy `stage-a-extract.test.ts`, change platform, pass a single post that suits the platform, assert parsed extract returned.
- [ ] **Step 12: Run all worker tests** — `pnpm --filter @rivaleye/worker exec bun test`. Expect all passing.
- [ ] **Step 13: Commit** — one commit per platform:
  ```bash
  git add packages/scrapers/src/<P>/ packages/scrapers/src/__fixtures__/<P>.json packages/worker/src/prompts/platform/<P>/ packages/worker/src/pipeline/stage-a-extract.ts packages/worker/src/pipeline/stage-b-summarize.ts packages/worker/src/pipeline/*.test.ts packages/scrapers/package.json pnpm-lock.yaml
  git commit -m "feat(scrapers,worker): port <P> scraper + Stage A/B prompts"
  ```

Repeat for all 6 platforms.

---

## Task 12: Reddit scraper cleanup pass

**Files:**
- Modify: `packages/scrapers/src/reddit/auth.ts`
- Modify: `packages/scrapers/src/reddit/client.ts`
- Modify: `packages/scrapers/src/reddit/search.ts`
- Modify: `packages/scrapers/src/reddit/comments.ts`
- Modify: `packages/scrapers/src/reddit/normalize.ts`
- Modify: `packages/scrapers/src/reddit/index.ts`
- Modify: `packages/scrapers/src/reddit/rate-limiter.ts`
- Create: `packages/scrapers/src/reddit/normalize.test.ts`
- Create: `packages/scrapers/src/__fixtures__/reddit.json`
- Create: `packages/worker/src/prompts/platform/reddit/extract.ts`
- Create: `packages/worker/src/prompts/platform/reddit/summarize.ts`
- Modify: `packages/worker/src/pipeline/stage-a-extract.ts` (add case)
- Modify: `packages/worker/src/pipeline/stage-b-summarize.ts` (add case)

- [ ] **Step 1: Audit each reddit subfile**

For each of `auth.ts, client.ts, search.ts, comments.ts, normalize.ts, rate-limiter.ts, index.ts`: Read the file and document (in your scratch notes, not committed) any of:
- Broken type assertions (e.g., `as any`, unchecked `as`)
- Silent failures (try/catch that swallow without logging context)
- Hard-coded values that should be config
- Dead code (functions / types not referenced)
- Snake_case mismatches with the rest of the codebase

- [ ] **Step 2: Capture a fixture**

The Reddit OAuth flow requires real credentials. Use `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` from your local `.env`. Run a small script that calls `searchPosts("notion complaints", config, { limit: 5 })` and writes the raw response to `packages/scrapers/src/__fixtures__/reddit.json` shaped as:

```json
{
  "posts": [ /* the raw response.data.children[].data array from Reddit */ ],
  "comments": [ /* one post's comments response */ ]
}
```

- [ ] **Step 3: Write failing normalizer test**

```ts
// packages/scrapers/src/reddit/normalize.test.ts
import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/reddit.json";
import { normalizePost } from "./normalize";

describe("reddit normalizer", () => {
  it("converts a raw post + its comments into a NormalizedPost", () => {
    const post = (fixture as { posts: any[] }).posts[0];
    const comments = (fixture as { comments: any[] }).comments;
    const np = normalizePost(post, comments);
    expect(np.platform).toBe("reddit");
    expect(np.externalId).toMatch(/^reddit:.+/);
    expect(np.body.length).toBeGreaterThan(0);
    expect(np.createdAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 4: Run — expect either FAIL or PASS depending on current normalizer state**

Run: `pnpm --filter @rivaleye/scrapers exec bun test src/reddit/normalize.test.ts`

- If FAIL: fix `normalize.ts` until it passes. Mirror the appstore externalId convention: `externalId = \`reddit:<thingId>\``.
- If PASS: still walk through every audit issue from Step 1 and fix.

- [ ] **Step 5: Apply audit fixes**

For each issue identified in Step 1, fix it in the relevant file. Common ones:
- Replace `as any` in `comments.ts` and `search.ts` with explicit raw types.
- In `rate-limiter.ts`, ensure the limiter actually awaits — if it returns synchronously while limited, that's a bug.
- In `index.ts`, the `try { ... } catch (_err) { continue; }` blocks should at least `console.warn` with the term so we can see which searches are dying.

- [ ] **Step 6: Re-run all scraper tests**

Run: `pnpm --filter @rivaleye/scrapers exec bun test`
Expected: all green.

- [ ] **Step 7: Write reddit Stage A + B prompts**

Copy `packages/worker/src/prompts/platform/appstore/extract.ts` to `packages/worker/src/prompts/platform/reddit/extract.ts`. Replace the SYSTEM platform-specific sentence with: "extracting product-feedback signals from Reddit posts and comment threads." User-block lists posts with subreddit + title + top comments inline.

Same for `summarize.ts`: platform sentence mentions Reddit; subreddit-quoted competitors fed into `most_quoted_competitors`.

- [ ] **Step 8: Extend `pickBuilder` for reddit in both stage runners** (same shape as Task 11 step 9–10).

- [ ] **Step 9: Smoke-run a reddit scrape**

Run: `bun -e 'import("./packages/scrapers/src/reddit").then(async ({RedditScraper}) => { const r = await new RedditScraper().fetch({competitor:"notion"}); console.log(r.length, r[0]); })'`
Expected: prints > 0 posts.

- [ ] **Step 10: Type-check + tests**

Run: `pnpm --filter @rivaleye/scrapers type-check && pnpm --filter @rivaleye/worker type-check`
Run: `pnpm --filter @rivaleye/scrapers exec bun test && pnpm --filter @rivaleye/worker exec bun test`
Expected: green.

- [ ] **Step 11: Commit**

```bash
git add packages/scrapers/src/reddit/ packages/scrapers/src/__fixtures__/reddit.json packages/worker/src/prompts/platform/reddit/ packages/worker/src/pipeline/stage-a-extract.ts packages/worker/src/pipeline/stage-b-summarize.ts
git commit -m "$(cat <<'EOF'
fix(scrapers,worker): clean up reddit scraper + add Stage A/B prompts

Why: existing reddit scraper had silent swallowed errors, untyped raw
casts, and was the only platform without a normalizer test. Brought it
in line with the appstore template + wired Stage A/B per-platform prompts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Toggle `ALL_PLATFORMS` to the 8 enabled platforms

**Files:**
- Modify: `packages/scrapers/src/index.ts`
- Modify: `packages/scrapers/src/types.ts` (add `medium`, `hackernews`, `devto`, `trustpilot` to `PlatformId`)

- [ ] **Step 1: Extend `PlatformId`**

```ts
// packages/scrapers/src/types.ts — replace the PlatformId union
export type PlatformId =
  | "reddit"
  | "g2"
  | "capterra"
  | "twitter"
  | "linkedin"
  | "producthunt"
  | "appstore"
  | "playstore"
  | "gmaps"
  | "hackernews"
  | "devto"
  | "medium"
  | "trustpilot";
```

- [ ] **Step 2: Update `getScraper` switch + `ALL_PLATFORMS`**

```ts
// packages/scrapers/src/index.ts
export * from "./types";
export { RedditScraper } from "./reddit";
export { G2Scraper } from "./g2";
export { CapterraScraper } from "./capterra";
export { TwitterScraper } from "./twitter";
export { LinkedInScraper } from "./linkedin";
export { ProductHuntScraper } from "./producthunt";
export { AppStoreScraper } from "./appstore";
export { PlayStoreScraper } from "./playstore";
export { GoogleMapsScraper } from "./gmaps";
export { HackerNewsScraper } from "./hackernews";
export { DevToScraper } from "./devto";
export { MediumScraper } from "./medium";
export { TrustpilotScraper } from "./trustpilot";

import type { Scraper, PlatformId } from "./types";
import { RedditScraper } from "./reddit";
import { G2Scraper } from "./g2";
import { CapterraScraper } from "./capterra";
import { TwitterScraper } from "./twitter";
import { LinkedInScraper } from "./linkedin";
import { ProductHuntScraper } from "./producthunt";
import { AppStoreScraper } from "./appstore";
import { PlayStoreScraper } from "./playstore";
import { GoogleMapsScraper } from "./gmaps";
import { HackerNewsScraper } from "./hackernews";
import { DevToScraper } from "./devto";
import { MediumScraper } from "./medium";
import { TrustpilotScraper } from "./trustpilot";

export function getScraper(platform: PlatformId): Scraper {
  switch (platform) {
    case "reddit": return new RedditScraper();
    case "g2": return new G2Scraper();
    case "capterra": return new CapterraScraper();
    case "twitter": return new TwitterScraper();
    case "linkedin": return new LinkedInScraper();
    case "producthunt": return new ProductHuntScraper();
    case "appstore": return new AppStoreScraper();
    case "playstore": return new PlayStoreScraper();
    case "gmaps": return new GoogleMapsScraper();
    case "hackernews": return new HackerNewsScraper();
    case "devto": return new DevToScraper();
    case "medium": return new MediumScraper();
    case "trustpilot": return new TrustpilotScraper();
  }
}

export const ALL_PLATFORMS: PlatformId[] = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "medium",
  "trustpilot",
];
```

Note: hostile platforms (g2, capterra, twitter, linkedin, gmaps) still have `getScraper` cases (they throw "not implemented") but are NOT in `ALL_PLATFORMS`. Their stubs remain so we can re-enable them when buy-side providers are wired.

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @rivaleye/scrapers type-check && pnpm --filter @rivaleye/shared type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/scrapers/src/index.ts packages/scrapers/src/types.ts
git commit -m "$(cat <<'EOF'
feat(scrapers): enable 8 platforms; hostile platforms stay scaffolded

Why: ALL_PLATFORMS now matches ENABLED_PLATFORMS in shared. Hostile
platforms (g2, capterra, twitter, linkedin, gmaps) keep their stubs so
we can re-enable them when buy-side providers are wired without re-doing
the platform registration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Delete the old reddit-only pipeline + prompt files

**Files (delete):**
- `packages/worker/src/pipeline/stage1.ts`
- `packages/worker/src/pipeline/stage2.ts`
- `packages/worker/src/pipeline/stage3.ts`
- `packages/worker/src/pipeline/stage4.ts`
- `packages/worker/src/pipeline/evidence-binding.ts`
- `packages/worker/src/pipeline/preflight.ts`
- `packages/worker/src/pipeline/adapter.ts`
- `packages/worker/src/pipeline/schemas.ts`
- `packages/worker/src/pipeline/errors.ts` (re-created in Task 15)
- `packages/worker/src/pipeline/run.ts` (re-created in Task 15)
- `packages/worker/src/prompts/stage1-cluster.ts`
- `packages/worker/src/prompts/stage2-score.ts`
- `packages/worker/src/prompts/stage3-synthesize.ts`
- `packages/worker/src/prompts/stage4-actions.ts`
- `packages/worker/src/prompts/types.ts`
- `packages/worker/src/prompts/index.ts`
- `packages/worker/src/llm/index.ts`
- `packages/worker/src/llm.ts`

- [ ] **Step 1: Delete the files**

Run:
```bash
cd /Users/aymanparkar/Desktop/rivaleye-v3
rm packages/worker/src/pipeline/stage1.ts packages/worker/src/pipeline/stage2.ts packages/worker/src/pipeline/stage3.ts packages/worker/src/pipeline/stage4.ts
rm packages/worker/src/pipeline/evidence-binding.ts packages/worker/src/pipeline/preflight.ts packages/worker/src/pipeline/adapter.ts packages/worker/src/pipeline/schemas.ts
rm packages/worker/src/pipeline/errors.ts packages/worker/src/pipeline/run.ts
rm packages/worker/src/prompts/stage1-cluster.ts packages/worker/src/prompts/stage2-score.ts packages/worker/src/prompts/stage3-synthesize.ts packages/worker/src/prompts/stage4-actions.ts
rm packages/worker/src/prompts/types.ts packages/worker/src/prompts/index.ts
rm -rf packages/worker/src/llm
rm packages/worker/src/llm.ts
```

- [ ] **Step 2: Confirm generate-report.ts is the only remaining consumer of old types**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: errors in `jobs/generate-report.ts` referencing the deleted `runInsightPipeline`, `NotEnoughSignalError`, etc. Those are fixed in Task 15.

- [ ] **Step 3: Commit (compile-broken state — clean delete commit)**

```bash
git add -A packages/worker/src/pipeline packages/worker/src/prompts packages/worker/src/llm packages/worker/src/llm.ts
git commit -m "$(cat <<'EOF'
chore(worker): remove reddit-only pipeline + old LLM client

Why: replaced by the new 5-stage pipeline + the shared OpenRouter client.
generate-report.ts intentionally left referencing the removed module —
rewritten in the next commit (Task 15).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Stage C (cross-platform merge) — prompt + runner

**Files:**
- Create: `packages/worker/src/prompts/cross/merge.ts`
- Create: `packages/worker/src/pipeline/stage-c-merge.ts`
- Create: `packages/worker/src/pipeline/stage-c-merge.test.ts`
- Create: `packages/worker/src/pipeline/errors.ts`

- [ ] **Step 1: Add PipelineError**

```ts
// packages/worker/src/pipeline/errors.ts
export class PipelineError extends Error {
  constructor(public readonly stage: "C" | "D" | "E" | "persist", message: string, public override readonly cause?: unknown) {
    super(`pipeline[${stage}]: ${message}`);
    this.name = "PipelineError";
  }
}
```

- [ ] **Step 2: Write merge prompt**

```ts
// packages/worker/src/prompts/cross/merge.ts
import {
  mergedClustersSchema,
  type PipelineCtx,
  type PlatformBrief,
  type PlatformExtract,
} from "../shared";

const SYSTEM = `You are merging research from multiple platforms into unified clusters.
You receive per-platform briefs + per-platform extracts. Return ONE JSON object matching the schema.
Rules:
- A cluster groups the same underlying user-pain / feature / pricing concern across platforms.
- evidence_ids must come from the input extracts (verbatim string ids).
- platforms[] lists every platform that supports the cluster.
- complaint_clusters.severity = max severity across contributing complaints, capped at 1.
- voice_top: aggregate counts; keep top 20 each side.
- If a section has no signal across any platform, return [] for it.
- Do not invent platforms, ids, or quotes that did not appear in the input.`;

export interface MergeInput {
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  extracts: Array<{ platform: PlatformBrief["platform"]; extract: PlatformExtract }>;
}

export function buildMerge(input: MergeInput): {
  system: string;
  user: string;
  schema: typeof mergedClustersSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Per-platform briefs (JSON array):
${JSON.stringify(input.briefs, null, 2)}

Per-platform extracts (JSON array, keyed by platform):
${JSON.stringify(input.extracts, null, 2)}

Return the merged JSON now.`;
  return { system: SYSTEM, user, schema: mergedClustersSchema };
}
```

- [ ] **Step 3: Write failing runner test**

```ts
// packages/worker/src/pipeline/stage-c-merge.test.ts
import { describe, expect, it } from "bun:test";
import type { OpenRouterClient } from "@rivaleye/shared";
import { runStageCMerge } from "./stage-c-merge";

describe("runStageCMerge", () => {
  it("returns parsed merged clusters", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          complaint_clusters: [],
          feature_clusters: [],
          pricing_clusters: [],
          switching_clusters: [],
          voice_top: { positive: [], negative: [] },
          cross_platform_themes: [],
        },
        raw: "{}",
        usage: { promptTokens: 1, completionTokens: 1 },
        model: "t",
      }),
    } as unknown as OpenRouterClient;
    const out = await runStageCMerge({
      llm: fakeLlm,
      ctx: { reportId: "r", competitor: "c", category: "k", audience: null, goal: "g" },
      briefs: [],
      extracts: [],
    });
    expect(out.merged.complaint_clusters).toEqual([]);
  });
});
```

- [ ] **Step 4: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-c-merge.test.ts`
Expected: failure.

- [ ] **Step 5: Implement runner**

```ts
// packages/worker/src/pipeline/stage-c-merge.ts
import type { OpenRouterClient } from "@rivaleye/shared";
import { buildMerge, type MergeInput } from "../prompts/cross/merge";
import type { MergedClusters } from "../prompts/shared";
import { PipelineError } from "./errors";

export interface StageCOutput {
  merged: MergedClusters;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageCMerge(
  input: MergeInput & { llm: OpenRouterClient },
): Promise<StageCOutput> {
  try {
    const built = buildMerge(input);
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
    });
    return { merged: res.parsed, usage: res.usage, model: res.model };
  } catch (err) {
    throw new PipelineError("C", "merge failed", err);
  }
}
```

- [ ] **Step 6: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-c-merge.test.ts`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add packages/worker/src/prompts/cross/merge.ts packages/worker/src/pipeline/stage-c-merge.ts packages/worker/src/pipeline/stage-c-merge.test.ts packages/worker/src/pipeline/errors.ts
git commit -m "$(cat <<'EOF'
feat(worker): Stage C merge — cross-platform clusters from per-platform briefs

Why: first cross-platform stage. Collapses 8 platform briefs + extracts into
unified clusters that Stage D and E operate on.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Stage D (cross-platform synth) — prompt + runner

**Files:**
- Create: `packages/worker/src/prompts/cross/synth.ts`
- Create: `packages/worker/src/pipeline/stage-d-synth.ts`
- Create: `packages/worker/src/pipeline/stage-d-synth.test.ts`

- [ ] **Step 1: Write the synth prompt**

```ts
// packages/worker/src/prompts/cross/synth.ts
import { synthOutputSchema, type MergedClusters, type PipelineCtx } from "../shared";

const SYSTEM = `You are writing the final founder-facing report from merged research.
You receive merged clusters from multiple platforms. Return ONE JSON object matching the schema.
Rules:
- complaints[].external_id is a unique slug you mint per cluster ("c001", "c002", ...).
- opportunities[].anchor_complaint_external_id should reference a complaints[].external_id where applicable, or null.
- Empty array is correct when there is no evidence. NEVER fabricate quotes, leads, or threads.
- threads[]: rebuild conversation snapshots from voice_phrases / sample_quote when present; leave [] otherwise.
- report_meta sentiment percentages must sum to ~1.0 (positive+neutral+negative).
- report_meta.sentiment_overall is -1..1 (sign: positive minus negative weighted).
- pricing_pain_score in [0..1] when there is pricing evidence, otherwise null.
- voice_summary one sentence. voice_phrases up to 10 phrases.
- positioning[] up to 4 angles; actions[] up to 6 steps.
- effort/payoff enum strictly low|med|high.`;

export interface SynthInput {
  ctx: PipelineCtx;
  merged: MergedClusters;
}

export function buildSynth(input: SynthInput): {
  system: string;
  user: string;
  schema: typeof synthOutputSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Merged clusters (JSON):
${JSON.stringify(input.merged, null, 2)}

Return the final synth JSON now.`;
  return { system: SYSTEM, user, schema: synthOutputSchema };
}
```

- [ ] **Step 2: Write failing runner test**

```ts
// packages/worker/src/pipeline/stage-d-synth.test.ts
import { describe, expect, it } from "bun:test";
import type { OpenRouterClient } from "@rivaleye/shared";
import { runStageDSynth } from "./stage-d-synth";

describe("runStageDSynth", () => {
  it("returns parsed synth output", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: emptySynth(),
        raw: "{}",
        usage: { promptTokens: 2, completionTokens: 2 },
        model: "t",
      }),
    } as unknown as OpenRouterClient;
    const res = await runStageDSynth({
      llm: fakeLlm,
      ctx: { reportId: "r", competitor: "c", category: "k", audience: null, goal: "g" },
      merged: {
        complaint_clusters: [],
        feature_clusters: [],
        pricing_clusters: [],
        switching_clusters: [],
        voice_top: { positive: [], negative: [] },
        cross_platform_themes: [],
      },
    });
    expect(res.synth.report_meta.sentiment_trend).toBe("flat");
  });
});

function emptySynth() {
  return {
    complaints: [],
    feature_gaps: [],
    pricing_tiers: [],
    pricing_quotes: [],
    switching: [],
    quotes: [],
    voice_words: [],
    positioning: [],
    actions: [],
    leads: [],
    opportunities: [],
    threads: [],
    report_meta: {
      sentiment_overall: 0,
      sentiment_positive: 0,
      sentiment_neutral: 0,
      sentiment_negative: 0,
      sentiment_trend: "flat" as const,
      voice_summary: null,
      voice_phrases: [],
      pricing_blended: null,
      pricing_pain_score: null,
      switching_net_signal: null,
      switching_reasons_out: [],
    },
  };
}
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-d-synth.test.ts`
Expected: failure.

- [ ] **Step 4: Implement runner**

```ts
// packages/worker/src/pipeline/stage-d-synth.ts
import type { OpenRouterClient } from "@rivaleye/shared";
import { buildSynth, type SynthInput } from "../prompts/cross/synth";
import type { SynthOutput } from "../prompts/shared";
import { PipelineError } from "./errors";

export interface StageDOutput {
  synth: SynthOutput;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

const MAX_TOKENS = 16000;

export async function runStageDSynth(
  input: SynthInput & { llm: OpenRouterClient },
): Promise<StageDOutput> {
  try {
    const built = buildSynth(input);
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
      maxTokens: MAX_TOKENS,
    });
    return { synth: res.parsed, usage: res.usage, model: res.model };
  } catch (err) {
    throw new PipelineError("D", "synth failed", err);
  }
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-d-synth.test.ts`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/cross/synth.ts packages/worker/src/pipeline/stage-d-synth.ts packages/worker/src/pipeline/stage-d-synth.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): Stage D synth — single mega-blob populating all 16 sections

Why: keeps cross-section references (opportunity→complaint, action→step)
internally consistent. Schema-enforced via Zod.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Stage E (refine) — prompt + runner

**Files:**
- Create: `packages/worker/src/prompts/cross/refine.ts`
- Create: `packages/worker/src/pipeline/stage-e-refine.ts`
- Create: `packages/worker/src/pipeline/stage-e-refine.test.ts`

- [ ] **Step 1: Write the refine prompt**

```ts
// packages/worker/src/prompts/cross/refine.ts
import {
  synthOutputSchema,
  type MergedClusters,
  type PipelineCtx,
  type SynthOutput,
} from "../shared";

const SYSTEM = `You are a senior research lead doing a critique-and-revise pass on a draft report.
You will receive (a) the merged clusters, (b) a draft synth report.
Return ONE revised JSON object in the SAME schema as the draft.
Rules:
- Strengthen weak sections: if a cluster has strong signal in (a) but the draft section is empty, populate it from the cluster.
- Tighten language: remove hedging ("might", "could", "maybe").
- Drop fabrications: if a quote, lead, or thread is not anchored to evidence in (a), remove it.
- Keep external_ids stable when rewriting complaints — downstream sections reference them.
- Empty arrays are correct when there is no signal. Do NOT invent.`;

export interface RefineInput {
  ctx: PipelineCtx;
  merged: MergedClusters;
  draft: SynthOutput;
}

export function buildRefine(input: RefineInput): {
  system: string;
  user: string;
  schema: typeof synthOutputSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}

Merged clusters (JSON):
${JSON.stringify(input.merged, null, 2)}

Draft synth (JSON):
${JSON.stringify(input.draft, null, 2)}

Return the revised JSON now.`;
  return { system: SYSTEM, user, schema: synthOutputSchema };
}
```

- [ ] **Step 2: Write failing runner test (includes Stage-D-fallback behaviour)**

```ts
// packages/worker/src/pipeline/stage-e-refine.test.ts
import { describe, expect, it } from "bun:test";
import type { OpenRouterClient } from "@rivaleye/shared";
import { runStageERefine } from "./stage-e-refine";

const draft = {
  complaints: [],
  feature_gaps: [],
  pricing_tiers: [],
  pricing_quotes: [],
  switching: [],
  quotes: [],
  voice_words: [],
  positioning: [],
  actions: [],
  leads: [],
  opportunities: [],
  threads: [],
  report_meta: {
    sentiment_overall: 0,
    sentiment_positive: 0,
    sentiment_neutral: 0,
    sentiment_negative: 0,
    sentiment_trend: "flat" as const,
    voice_summary: null,
    voice_phrases: [],
    pricing_blended: null,
    pricing_pain_score: null,
    switching_net_signal: null,
    switching_reasons_out: [],
  },
};

describe("runStageERefine", () => {
  it("returns the parsed refined output", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: draft,
        raw: "{}",
        usage: { promptTokens: 1, completionTokens: 1 },
        model: "t",
      }),
    } as unknown as OpenRouterClient;
    const res = await runStageERefine({
      llm: fakeLlm,
      ctx: { reportId: "r", competitor: "c", category: "k", audience: null, goal: "g" },
      merged: {
        complaint_clusters: [],
        feature_clusters: [],
        pricing_clusters: [],
        switching_clusters: [],
        voice_top: { positive: [], negative: [] },
        cross_platform_themes: [],
      },
      draft,
    });
    expect(res.refined).toEqual(draft);
    expect(res.fellBackToDraft).toBe(false);
  });

  it("falls back to draft + logs warning when refine fails", async () => {
    const fakeLlm = {
      complete: async () => {
        throw new Error("LLM blew up");
      },
    } as unknown as OpenRouterClient;
    const res = await runStageERefine({
      llm: fakeLlm,
      ctx: { reportId: "r", competitor: "c", category: "k", audience: null, goal: "g" },
      merged: {
        complaint_clusters: [],
        feature_clusters: [],
        pricing_clusters: [],
        switching_clusters: [],
        voice_top: { positive: [], negative: [] },
        cross_platform_themes: [],
      },
      draft,
    });
    expect(res.refined).toEqual(draft);
    expect(res.fellBackToDraft).toBe(true);
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-e-refine.test.ts`
Expected: failure ("Cannot find module").

- [ ] **Step 4: Implement runner**

```ts
// packages/worker/src/pipeline/stage-e-refine.ts
import type { OpenRouterClient } from "@rivaleye/shared";
import { buildRefine, type RefineInput } from "../prompts/cross/refine";
import type { SynthOutput } from "../prompts/shared";

export interface StageEOutput {
  refined: SynthOutput;
  fellBackToDraft: boolean;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

const MAX_TOKENS = 16000;

export async function runStageERefine(
  input: RefineInput & { llm: OpenRouterClient },
): Promise<StageEOutput> {
  try {
    const built = buildRefine(input);
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
      maxTokens: MAX_TOKENS,
    });
    return {
      refined: res.parsed,
      fellBackToDraft: false,
      usage: res.usage,
      model: res.model,
    };
  } catch (err) {
    console.warn(`[stage-e] refine failed, falling back to Stage D draft: ${asMessage(err)}`);
    return {
      refined: input.draft,
      fellBackToDraft: true,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "(stage-e-fallback)",
    };
  }
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/stage-e-refine.test.ts`
Expected: both tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/worker/src/prompts/cross/refine.ts packages/worker/src/pipeline/stage-e-refine.ts packages/worker/src/pipeline/stage-e-refine.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): Stage E refine — critique-and-revise + draft fallback

Why: closes the iterative loop. On LLM failure we return the Stage D draft
unchanged rather than failing the whole report — the synth is still a
complete report shape, just not refined.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Derive platform stats + subreddits from mentions

**Files:**
- Create: `packages/worker/src/pipeline/derive-stats.ts`
- Create: `packages/worker/src/pipeline/derive-stats.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/worker/src/pipeline/derive-stats.test.ts
import { describe, expect, it } from "bun:test";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";

describe("derive-stats", () => {
  it("aggregates platform counts", () => {
    const stats = computePlatformStats([
      { platform: "reddit" },
      { platform: "reddit" },
      { platform: "appstore" },
    ]);
    expect(stats).toEqual([
      { platform_id: "reddit", name: "Reddit", posts: 2, sentiment: null, contexts: [], sort_order: 0 },
      { platform_id: "appstore", name: "App Store", posts: 1, sentiment: null, contexts: [], sort_order: 1 },
    ]);
  });

  it("aggregates subreddit counts from reddit mentions only", () => {
    const stats = computeSubredditStats([
      { platform: "reddit", raw: { subreddit: "Notion" } },
      { platform: "reddit", raw: { subreddit: "Notion" } },
      { platform: "reddit", raw: { subreddit: "productivity" } },
      { platform: "appstore", raw: {} },
    ]);
    expect(stats).toEqual([
      { name: "Notion", posts: 2, sentiment: null, sort_order: 0 },
      { name: "productivity", posts: 1, sentiment: null, sort_order: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/derive-stats.test.ts`
Expected: failure.

- [ ] **Step 3: Implement**

```ts
// packages/worker/src/pipeline/derive-stats.ts
import type { PlatformId } from "@rivaleye/scrapers";

export interface MentionLike {
  platform: string;
  raw?: unknown;
}

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  appstore: "App Store",
  playstore: "Play Store",
  hackernews: "Hacker News",
  producthunt: "Product Hunt",
  devto: "Dev.to",
  medium: "Medium",
  trustpilot: "Trustpilot",
  g2: "G2",
  capterra: "Capterra",
  twitter: "Twitter",
  linkedin: "LinkedIn",
  gmaps: "Google Maps",
};

export interface PlatformStatRow {
  platform_id: string;
  name: string;
  posts: number;
  sentiment: number | null;
  contexts: string[];
  sort_order: number;
}

export function computePlatformStats(mentions: MentionLike[]): PlatformStatRow[] {
  const counts = new Map<string, number>();
  for (const m of mentions) counts.set(m.platform, (counts.get(m.platform) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ordered.map(([platform_id, posts], i) => ({
    platform_id,
    name: PLATFORM_LABELS[platform_id] ?? platform_id,
    posts,
    sentiment: null,
    contexts: [],
    sort_order: i,
  }));
}

export interface SubredditRow {
  name: string;
  posts: number;
  sentiment: number | null;
  sort_order: number;
}

export function computeSubredditStats(mentions: MentionLike[]): SubredditRow[] {
  const counts = new Map<string, number>();
  for (const m of mentions) {
    if (m.platform !== "reddit") continue;
    const sub = readSubreddit(m.raw);
    if (!sub) continue;
    counts.set(sub, (counts.get(sub) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ordered.map(([name, posts], i) => ({ name, posts, sentiment: null, sort_order: i }));
}

function readSubreddit(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as Record<string, unknown>).subreddit;
  return typeof v === "string" && v.length > 0 ? v : null;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/derive-stats.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/pipeline/derive-stats.ts packages/worker/src/pipeline/derive-stats.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): derive platform_stats + subreddits from raw mentions

Why: these two sections are aggregate-only — no need to spend LLM budget
on them. Counts come straight from mentions; sentiment stays null until
we have a per-mention sentiment scorer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Persist Stage E output into 16 sub-tables

**Files:**
- Create: `packages/worker/src/pipeline/persist.ts`
- Create: `packages/worker/src/pipeline/persist.test.ts`

- [ ] **Step 1: Failing integration test against a test db schema (we'll use a real test database, no mocking)**

Pre-req: `psql` available; `CONNECTION_STRING` points at a local Postgres with the migrations applied.

```ts
// packages/worker/src/pipeline/persist.test.ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../../api/src/db/schema/users.js";
import { reports, report_complaints, report_actions, report_threads } from "../../../api/src/db/schema/reports.js";
import { persistReport } from "./persist";
import type { SynthOutput } from "../prompts/shared";

const ownerId = "00000000-0000-0000-0000-000000000001";
let reportId: string;

beforeAll(async () => {
  await db.insert(users).values({ id: ownerId, email: "persist-test@example.com", name: "Test" })
    .onConflictDoNothing();
});

beforeEach(async () => {
  const [r] = await db.insert(reports).values({
    owner_id: ownerId,
    category: "test",
    competitors: ["test"],
    goal: "find_user_pain",
  }).returning({ id: reports.id });
  reportId = r!.id;
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
});

const synth: SynthOutput = {
  complaints: [
    {
      external_id: "c001",
      title: "Sync breaks daily",
      tag: "sync",
      mentions: 12,
      delta: "+30%",
      severity: 0.85,
      summary: "Users repeatedly report syncing failures on iOS.",
      threads: 3,
      sample: "It deleted all my pages overnight.",
    },
  ],
  feature_gaps: [{ feature: "Offline mode", votes: 42, signal: 0.8 }],
  pricing_tiers: [{ tier: "Plus", pain: 0.6, note: "Too steep for solo founders" }],
  pricing_quotes: [{ who: "u/anon", sub: "Notion", text: "$10 is too much for a notebook." }],
  switching: [{ direction: "outbound", competitor_name: "Obsidian", count: 5, share: 0.3 }],
  quotes: [{ who: "u/x", sub: null, when_label: "2d ago", score: 100, sentiment: -0.5, text: "Slow as hell" }],
  voice_words: [{ kind: "negative", word: "slow", count: 12 }],
  positioning: [{ angle: "Speed-first", thesis: null, audience: null, against: "Notion" }],
  actions: [{ step: "Ship offline mode", detail: null, effort: "high", role: "eng" }],
  leads: [{ who: "u/founder", sub: "saas", when_label: null, score: 0, signal: "ready to switch", quote: null }],
  opportunities: [
    {
      title: "Offline-first Notion alternative",
      thesis: "Solo founders can't afford pages disappearing",
      effort: "high",
      payoff: "high",
      anchor_complaint_external_id: "c001",
    },
  ],
  threads: [
    {
      complaint_external_id: "c001",
      platform: "reddit",
      url: "https://reddit.com/x",
      title: "Sync broken since update",
      author: "u/x",
      sub: "Notion",
      posted_at: "2026-05-01T00:00:00.000Z",
      score: 200,
      messages: [{ author: "u/y", body: "same here", posted_at: "2026-05-01T01:00:00.000Z", score: 50 }],
    },
  ],
  report_meta: {
    sentiment_overall: -0.3,
    sentiment_positive: 0.2,
    sentiment_neutral: 0.3,
    sentiment_negative: 0.5,
    sentiment_trend: "down",
    voice_summary: "Users love structure, hate sync.",
    voice_phrases: ["love structure", "hate sync"],
    pricing_blended: "$10/mo perceived ceiling",
    pricing_pain_score: 0.6,
    switching_net_signal: "outbound dominant",
    switching_reasons_out: ["sync issues", "price"],
  },
};

describe("persistReport", () => {
  it("writes all 16 sections + report_meta in a single transaction", async () => {
    await persistReport({
      reportId,
      synth,
      platformStats: [
        { platform_id: "reddit", name: "Reddit", posts: 50, sentiment: null, contexts: [], sort_order: 0 },
      ],
      subreddits: [{ name: "Notion", posts: 20, sentiment: null, sort_order: 0 }],
    });

    const comp = await db.select().from(report_complaints).where(eq(report_complaints.report_id, reportId));
    expect(comp.length).toBe(1);
    expect(comp[0]!.external_id).toBe("c001");

    const acts = await db.select().from(report_actions).where(eq(report_actions.report_id, reportId));
    expect(acts.length).toBe(1);
    expect(acts[0]!.effort).toBe("high");

    const threads = await db.select().from(report_threads).where(eq(report_threads.report_id, reportId));
    expect(threads.length).toBe(1);
    expect(threads[0]!.complaint_external_id).toBe("c001");

    const [updatedReport] = await db.select().from(reports).where(eq(reports.id, reportId));
    expect(updatedReport!.voice_summary).toBe("Users love structure, hate sync.");
    expect(updatedReport!.sentiment_trend).toBe("down");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/persist.test.ts`
Expected: "Cannot find module './persist'".

- [ ] **Step 3: Implement `persistReport`**

```ts
// packages/worker/src/pipeline/persist.ts
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  reports,
  report_complaints,
  report_feature_gaps,
  report_pricing_tiers,
  report_pricing_quotes,
  report_switching,
  report_quotes,
  report_voice_words,
  report_positioning,
  report_actions,
  report_leads,
  report_opportunities,
  report_platform_stats,
  report_subreddits,
  report_threads,
  report_thread_messages,
} from "../../../api/src/db/schema/reports.js";
import type { SynthOutput } from "../prompts/shared";
import type { PlatformStatRow, SubredditRow } from "./derive-stats";
import { PipelineError } from "./errors";

export interface PersistInput {
  reportId: string;
  synth: SynthOutput;
  platformStats: PlatformStatRow[];
  subreddits: SubredditRow[];
}

export async function persistReport(input: PersistInput): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(report_complaints).where(eq(report_complaints.report_id, input.reportId));
      await tx.delete(report_feature_gaps).where(eq(report_feature_gaps.report_id, input.reportId));
      await tx.delete(report_pricing_tiers).where(eq(report_pricing_tiers.report_id, input.reportId));
      await tx.delete(report_pricing_quotes).where(eq(report_pricing_quotes.report_id, input.reportId));
      await tx.delete(report_switching).where(eq(report_switching.report_id, input.reportId));
      await tx.delete(report_quotes).where(eq(report_quotes.report_id, input.reportId));
      await tx.delete(report_voice_words).where(eq(report_voice_words.report_id, input.reportId));
      await tx.delete(report_positioning).where(eq(report_positioning.report_id, input.reportId));
      await tx.delete(report_actions).where(eq(report_actions.report_id, input.reportId));
      await tx.delete(report_leads).where(eq(report_leads.report_id, input.reportId));
      await tx.delete(report_opportunities).where(eq(report_opportunities.report_id, input.reportId));
      await tx.delete(report_platform_stats).where(eq(report_platform_stats.report_id, input.reportId));
      await tx.delete(report_subreddits).where(eq(report_subreddits.report_id, input.reportId));
      await tx.delete(report_threads).where(eq(report_threads.report_id, input.reportId));

      const { synth, platformStats, subreddits, reportId } = input;

      if (synth.complaints.length) {
        await tx.insert(report_complaints).values(
          synth.complaints.map((c, i) => ({ report_id: reportId, ...c, sort_order: i })),
        );
      }
      if (synth.feature_gaps.length) {
        await tx.insert(report_feature_gaps).values(
          synth.feature_gaps.map((f, i) => ({ report_id: reportId, ...f, sort_order: i })),
        );
      }
      if (synth.pricing_tiers.length) {
        await tx.insert(report_pricing_tiers).values(
          synth.pricing_tiers.map((t, i) => ({ report_id: reportId, ...t, sort_order: i })),
        );
      }
      if (synth.pricing_quotes.length) {
        await tx.insert(report_pricing_quotes).values(
          synth.pricing_quotes.map((q, i) => ({ report_id: reportId, ...q, sort_order: i })),
        );
      }
      if (synth.switching.length) {
        await tx.insert(report_switching).values(
          synth.switching.map((s, i) => ({ report_id: reportId, ...s, sort_order: i })),
        );
      }
      if (synth.quotes.length) {
        await tx.insert(report_quotes).values(
          synth.quotes.map((q, i) => ({ report_id: reportId, ...q, sort_order: i })),
        );
      }
      if (synth.voice_words.length) {
        await tx.insert(report_voice_words).values(
          synth.voice_words.map((w, i) => ({ report_id: reportId, ...w, sort_order: i })),
        );
      }
      if (synth.positioning.length) {
        await tx.insert(report_positioning).values(
          synth.positioning.map((p, i) => ({ report_id: reportId, ...p, sort_order: i })),
        );
      }
      if (synth.actions.length) {
        await tx.insert(report_actions).values(
          synth.actions.map((a, i) => ({ report_id: reportId, ...a, sort_order: i })),
        );
      }
      if (synth.leads.length) {
        await tx.insert(report_leads).values(
          synth.leads.map((l, i) => ({ report_id: reportId, ...l, sort_order: i })),
        );
      }
      if (synth.opportunities.length) {
        await tx.insert(report_opportunities).values(
          synth.opportunities.map((o, i) => ({ report_id: reportId, ...o, sort_order: i })),
        );
      }
      if (platformStats.length) {
        await tx.insert(report_platform_stats).values(
          platformStats.map((s) => ({ report_id: reportId, ...s })),
        );
      }
      if (subreddits.length) {
        await tx.insert(report_subreddits).values(
          subreddits.map((s) => ({ report_id: reportId, ...s })),
        );
      }

      for (let i = 0; i < synth.threads.length; i++) {
        const t = synth.threads[i]!;
        const [thread] = await tx.insert(report_threads).values({
          report_id: reportId,
          complaint_external_id: t.complaint_external_id,
          platform: t.platform,
          url: t.url,
          title: t.title,
          author: t.author,
          sub: t.sub,
          posted_at: t.posted_at ? new Date(t.posted_at) : null,
          score: t.score,
          sort_order: i,
        }).returning({ id: report_threads.id });
        if (!thread) continue;
        if (t.messages.length) {
          await tx.insert(report_thread_messages).values(
            t.messages.map((m, j) => ({
              thread_id: thread.id,
              author: m.author,
              body: m.body,
              posted_at: m.posted_at ? new Date(m.posted_at) : null,
              score: m.score,
              sort_order: j,
            })),
          );
        }
      }

      await tx.update(reports).set({
        sentiment_overall: synth.report_meta.sentiment_overall,
        sentiment_positive: synth.report_meta.sentiment_positive,
        sentiment_neutral: synth.report_meta.sentiment_neutral,
        sentiment_negative: synth.report_meta.sentiment_negative,
        sentiment_trend: synth.report_meta.sentiment_trend,
        voice_summary: synth.report_meta.voice_summary,
        voice_phrases: synth.report_meta.voice_phrases,
        pricing_blended: synth.report_meta.pricing_blended,
        pricing_pain_score: synth.report_meta.pricing_pain_score,
        switching_net_signal: synth.report_meta.switching_net_signal,
        switching_reasons_out: synth.report_meta.switching_reasons_out,
        total_threads: synth.threads.length,
        scanned_at: new Date(),
        updated_at: new Date(),
      }).where(eq(reports.id, reportId));
    });
  } catch (err) {
    throw new PipelineError("persist", "transaction failed", err);
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @rivaleye/worker exec bun test src/pipeline/persist.test.ts`
Expected: 1 test passes.

If test fails because `reports.total_threads` column missing, check the existing schema (`packages/api/src/db/schema/reports.ts`) — `total_threads` already exists on `reports` (line 53). If not, this is a schema gap; pause and add it before continuing.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/pipeline/persist.ts packages/worker/src/pipeline/persist.test.ts
git commit -m "$(cat <<'EOF'
feat(worker): persistReport writes the final synth into 16 sub-tables in one txn

Why: every section gets a clean delete-then-insert so re-runs are
idempotent. report_meta fields update the parent reports row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: Pipeline orchestrator `run.ts` + rewrite `generate-report.ts`

**Files:**
- Create: `packages/worker/src/pipeline/run.ts`
- Modify: `packages/worker/src/jobs/generate-report.ts`

- [ ] **Step 1: Write `run.ts`**

```ts
// packages/worker/src/pipeline/run.ts
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { report_platform_briefs } from "../../../api/src/db/schema/pipeline.js";
import {
  LLM_MODEL,
  OpenRouterClient,
  readOpenRouterApiKey,
} from "@rivaleye/shared";
import { runStageCMerge } from "./stage-c-merge";
import { runStageDSynth } from "./stage-d-synth";
import { runStageERefine } from "./stage-e-refine";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";
import { persistReport } from "./persist";
import { PipelineError } from "./errors";
import type {
  PipelineCtx,
  PlatformBrief,
  PlatformExtract,
} from "../prompts/shared";

let llmSingleton: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (!llmSingleton) {
    llmSingleton = new OpenRouterClient({
      apiKey: readOpenRouterApiKey(),
      model: LLM_MODEL,
    });
  }
  return llmSingleton;
}

export async function runPipeline(reportId: string): Promise<void> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) throw new PipelineError("C", `report ${reportId} not found`);

  const briefRows = await db
    .select()
    .from(report_platform_briefs)
    .where(eq(report_platform_briefs.report_id, reportId));

  if (briefRows.length === 0) {
    throw new PipelineError("C", "no platform briefs available");
  }

  const briefs: PlatformBrief[] = briefRows.map((r) => r.summary as unknown as PlatformBrief);
  const extracts = briefRows.map((r) => ({
    platform: (r.summary as unknown as PlatformBrief).platform,
    extract: r.extract as unknown as PlatformExtract,
  }));

  const ctx: PipelineCtx = {
    reportId,
    competitor: (report.competitors as string[])[0] ?? "",
    category: report.category,
    audience: report.audience,
    goal: report.goal,
  };

  await db
    .update(reports)
    .set({ stage: "clustering", updated_at: new Date() })
    .where(eq(reports.id, reportId));

  const llm = getLlm();
  const merged = await runStageCMerge({ llm, ctx, briefs, extracts });
  const synth = await runStageDSynth({ llm, ctx, merged: merged.merged });
  const refined = await runStageERefine({
    llm,
    ctx,
    merged: merged.merged,
    draft: synth.synth,
  });

  const mentionRows = await db
    .select({ platform: mentions.platform, raw: mentions.raw })
    .from(mentions)
    .where(eq(mentions.report_id, reportId));

  const platformStats = computePlatformStats(mentionRows);
  const subreddits = computeSubredditStats(mentionRows);

  await persistReport({
    reportId,
    synth: refined.refined,
    platformStats,
    subreddits,
  });

  console.log(
    `[pipeline] reportId=${reportId} done — stage E fellback=${refined.fellBackToDraft}`,
  );
}
```

- [ ] **Step 2: Rewrite `generate-report.ts`**

```ts
// packages/worker/src/jobs/generate-report.ts
import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { runPipeline } from "../pipeline/run";

export async function handleGenerateReport(data: GenerateReportJob) {
  const { reportId } = data;
  console.log(`[generate] start reportId=${reportId}`);
  try {
    await runPipeline(reportId);
    await db
      .update(reports)
      .set({ stage: "done", status: "completed", updated_at: new Date() })
      .where(eq(reports.id, reportId));
    console.log(`[generate] done reportId=${reportId} status=completed`);
  } catch (err) {
    console.error(`[generate] failed reportId=${reportId}`, err);
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(reports)
      .set({ stage: "failed", status: "failed", error: message, updated_at: new Date() })
      .where(eq(reports.id, reportId));
    throw err;
  }
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @rivaleye/worker type-check`
Expected: clean.

- [ ] **Step 4: Run all worker tests**

Run: `pnpm --filter @rivaleye/worker exec bun test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/pipeline/run.ts packages/worker/src/jobs/generate-report.ts
git commit -m "$(cat <<'EOF'
feat(worker): pipeline orchestrator wires C → D → E → derive → persist

Why: replaces runInsightPipeline. generate-report job is now a thin
wrapper that runs the orchestrator and flips the report status.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Smoke-test single-platform end-to-end script

**Files:**
- Create: `packages/worker/src/scripts/test-platform.ts`

- [ ] **Step 1: Write the script**

```ts
// packages/worker/src/scripts/test-platform.ts
import { getScraper, type PlatformId } from "@rivaleye/scrapers";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";

const platform = process.argv[2] as PlatformId | undefined;
const competitor = process.argv[3];
const category = process.argv[4] ?? "productivity";

if (!platform || !competitor) {
  console.error("usage: bun run packages/worker/src/scripts/test-platform.ts <platform> <competitor> [category]");
  process.exit(1);
}

(async () => {
  const scraper = getScraper(platform);
  console.log(`[smoke] fetching ${platform} for "${competitor}"`);
  const posts = await scraper.fetch({ competitor, category, keywords: [competitor] });
  console.log(`[smoke] got ${posts.length} posts`);
  if (posts.length === 0) {
    console.log("[smoke] no posts, nothing to do");
    return;
  }

  const llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  const ctx = {
    reportId: "00000000-0000-0000-0000-000000000000",
    competitor,
    category,
    audience: null,
    goal: "find_user_pain",
  };

  console.log("[smoke] running Stage A extract...");
  const a = await runStageAExtract({ llm, ctx, platform, posts });
  console.log(JSON.stringify(a.extract, null, 2));

  console.log("[smoke] running Stage B summarize...");
  const b = await runStageBSummarize({ llm, ctx, platform, extract: a.extract });
  console.log(JSON.stringify(b.brief, null, 2));

  console.log(`[smoke] tokens used: A=${a.usage.promptTokens + a.usage.completionTokens} B=${b.usage.promptTokens + b.usage.completionTokens}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run for one platform**

Run: `bun run packages/worker/src/scripts/test-platform.ts appstore notion productivity`
Expected: prints non-empty extract + brief JSON, no errors.

If it fails: the LLM probably needs JSON tightening. Check the raw response in `raw:` and adjust the SYSTEM prompt before continuing.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/scripts/test-platform.ts
git commit -m "$(cat <<'EOF'
feat(worker): smoke-test script for single-platform Stage A + B

Why: the adding-a-platform skill cites this script as step 9; pre-PR
manual validation lives here.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 22: End-to-end smoke test (all 8 platforms, real LLM, real DB)

**Files:** none (manual procedure)

- [ ] **Step 1: Confirm `.env` has all credentials**

```
CONNECTION_STRING=postgresql://...        # live dev DB
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=deepseek/deepseek-chat
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=rivaleye/0.1
PRODUCTHUNT_TOKEN=...
TRUSTPILOT_API_KEY=...
```

If `TRUSTPILOT_API_KEY` is unavailable: temporarily drop `"trustpilot"` from `ENABLED_PLATFORMS` for this smoke. Note the omission in your test report.

- [ ] **Step 2: Boot api + worker**

```bash
pnpm --filter @rivaleye/api dev &
pnpm --filter @rivaleye/worker dev &
```

- [ ] **Step 3: Create a report**

```bash
TOKEN=...   # from /v1/auth/sign-in
curl -X POST http://localhost:4000/v1/reports \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=$TOKEN" \
  -d '{"category":"productivity","competitors":["Notion"],"target_audience":"founders","founder_goal":"find_user_pain"}'
```

- [ ] **Step 4: Watch worker logs**

Expected sequence (interleaved across platforms):
```
[scrape] start reportId=... platform=appstore ...
[scrape] start reportId=... platform=reddit ...
... (8 platforms)
[scrape] all platform jobs done → enqueued generate-report for ...
[generate] start reportId=...
[pipeline] reportId=... done — stage E fellback=false
[generate] done reportId=... status=completed
```

Total wall time: 1-3 minutes.

- [ ] **Step 5: Verify DB**

```sql
SELECT status, stage, sentiment_overall, total_threads FROM reports WHERE id = '<uuid>';
SELECT platform, status FROM report_platform_jobs WHERE report_id = '<uuid>';
SELECT platform, COUNT(*) FROM mentions WHERE report_id = '<uuid>' GROUP BY platform;
SELECT platform, evidence_coverage FROM report_platform_briefs WHERE report_id = '<uuid>';
SELECT COUNT(*) FROM report_complaints WHERE report_id = '<uuid>';
SELECT COUNT(*) FROM report_feature_gaps WHERE report_id = '<uuid>';
SELECT COUNT(*) FROM report_opportunities WHERE report_id = '<uuid>';
SELECT COUNT(*) FROM report_threads WHERE report_id = '<uuid>';
```

Expected:
- `reports.status='completed'`, `stage='done'`, non-null sentiment.
- 8 jobs all `completed` (any `failed` is acceptable but note it).
- Mentions exist for every successful platform.
- All 8 platforms have a brief.
- Complaints, feature_gaps, opportunities ≥ 1 row each (assuming the LLM produced anything).

- [ ] **Step 6: Verify in the web app**

Open `http://localhost:4004/report/<uuid>` (or whatever Vite picks). Every section should render either real data or its empty state. No "loading…" stuck.

- [ ] **Step 7: Stop both processes**

Ctrl-C the api and worker.

- [ ] **Step 8: No commit (this is verification only)**

If any step failed, fix and recommit under the relevant Task #. Do not introduce a new "smoke fix" commit unrelated to a Task above.

---

## Task 23: Ship the `adding-a-platform-scraper` skill

**Files:**
- Create: `.claude/skills/adding-a-platform-scraper/SKILL.md`
- Create: `.claude/skills/adding-a-platform-scraper/references/scraper-template.ts`
- Create: `.claude/skills/adding-a-platform-scraper/references/extract-prompt-template.ts`
- Create: `.claude/skills/adding-a-platform-scraper/references/summarize-prompt-template.ts`

- [ ] **Step 1: Skill body**

```markdown
---
name: adding-a-platform-scraper
description: Use when adding a new platform to RivalEye's multi-platform pipeline. Walks through scraper class, prompt templates, schema registration, env vars, tests, and toggling on in ENABLED_PLATFORMS.
---

# Adding a Platform Scraper

Use this skill when the user asks to "add a scraper for X" or invokes `/add-platform`.

Every step is required. Skip none.

1. **Add the literal to `PlatformId`** in `packages/scrapers/src/types.ts`.

2. **Create the scraper class** at `packages/scrapers/src/<platform>/index.ts`:
   - Implements `Scraper` interface from `../types`
   - Reads env at constructor; never mid-fetch
   - Owns its rate limiter
   - Returns `NormalizedPost[]`; throws `ScraperError`
   - Template: `references/scraper-template.ts`

3. **Register in `packages/scrapers/src/index.ts`**: add to `getScraper` switch + the `export { ... }` block.
   Do NOT add to `ALL_PLATFORMS` yet — only after smoke-test in step 11.

4. **Capture a real fixture** at `packages/scrapers/src/__fixtures__/<platform>.json`.

5. **Write the normalizer test** at `packages/scrapers/src/<platform>/normalize.test.ts`:
   - Assert `posts.length > 0`, platform tag, externalId prefix, body non-empty, createdAt is `Date`.

6. **Env vars**: add to root `.env.example` + document in root `CLAUDE.md` §6.

7. **Stage A extract prompt** at `packages/worker/src/prompts/platform/<platform>/extract.ts`:
   - Output schema is the canonical `platformExtractSchema` from `prompts/shared.ts`
   - Template: `references/extract-prompt-template.ts`

8. **Stage B summarize prompt** at `packages/worker/src/prompts/platform/<platform>/summarize.ts`:
   - Output schema is the canonical `platformBriefSchema`
   - Template: `references/summarize-prompt-template.ts`

9. **Extend `pickBuilder` in BOTH `pipeline/stage-a-extract.ts` AND `pipeline/stage-b-summarize.ts`** — add the new `case "<platform>":`.

10. **Smoke-test single-platform**: `bun run packages/worker/src/scripts/test-platform.ts <platform> <competitor>` — must print a non-empty extract + brief JSON.

11. **Toggle on**: add the platform id to `ENABLED_PLATFORMS` in `packages/shared/src/llm/config.ts` AND to `ALL_PLATFORMS` in `packages/scrapers/src/index.ts`.

12. **Full pipeline smoke**: create a report from the api → confirm all platforms (including the new one) complete → confirm the new platform's brief appears in `report_platform_briefs`.

## Hostile-platform notes

If the platform is on the buy-list (g2, capterra, twitter, linkedin, gmaps): the scraper class wraps a 3rd-party provider call (Apify, X API, etc.). Never DIY scraping on hostile platforms. See `packages/scrapers/CLAUDE.md` §2.

## Tests required

- Normalizer test (`<platform>/normalize.test.ts`) — sample raw payload → asserts `NormalizedPost`.
- Stage A runner test (`pipeline/stage-a-extract.test.ts`) — case for new platform, fake LLM, asserts parsed extract.
- Stage B runner test (`pipeline/stage-b-summarize.test.ts`) — case for new platform, fake LLM, asserts parsed brief.
```

- [ ] **Step 2: Scraper template**

```ts
// .claude/skills/adding-a-platform-scraper/references/scraper-template.ts
import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

interface ExampleConfig {
  apiKey: string;
}

export class ExampleScraper implements Scraper {
  readonly platform = "example" as const;

  private readonly config: ExampleConfig;

  constructor() {
    const apiKey = process.env.EXAMPLE_API_KEY;
    if (!apiKey) {
      throw new ScraperError("example" as never, "EXAMPLE_API_KEY is required");
    }
    this.config = { apiKey };
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const raw = await this.callApi(query);
      return raw.map((r) => this.normalize(r));
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("example" as never, "fetch failed", err);
    }
  }

  private async callApi(_query: ScrapeQuery): Promise<unknown[]> {
    throw new Error("implement me");
  }

  private normalize(_raw: unknown): NormalizedPost {
    throw new Error("implement me");
  }
}
```

- [ ] **Step 3: Extract prompt template**

```ts
// .claude/skills/adding-a-platform-scraper/references/extract-prompt-template.ts
import { platformExtractSchema, type PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from <PLATFORM>.
Return ONE JSON object that conforms to the supplied schema.
Rules:
- Use the id labels in evidence_ids; never invent ids.
- complaints[].severity is 0..1.
- voice_phrases.positive and .negative are short (1-3 word) phrases.
- If a section has no signal, return an empty array.`;

export interface ExampleExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; body: string }>;
}

export function buildExampleExtract(input: ExampleExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const block = input.posts.map((p) => `- id=${p.id} | ${p.body.slice(0, 400)}`).join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}

<PLATFORM> posts:
${block}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}
```

- [ ] **Step 4: Summarize prompt template**

```ts
// .claude/skills/adding-a-platform-scraper/references/summarize-prompt-template.ts
import { platformBriefSchema, type PipelineCtx, type PlatformExtract } from "../../shared";

const SYSTEM = `You are a research analyst writing a one-page brief from extracted <PLATFORM> signals.
Return ONE JSON object matching the schema.
Rules:
- headline is one declarative sentence.
- sentiment.positive + .neutral + .negative must sum to 1.0.
- evidence_coverage = distinct evidence ids drawn on.
- platform must equal "<platform>".`;

export function buildExampleSummarize(input: {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}): { system: string; user: string; schema: typeof platformBriefSchema } {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}

<PLATFORM> extract:
${JSON.stringify(input.extract, null, 2)}

Return the brief JSON now. platform="<platform>".`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/adding-a-platform-scraper/
git commit -m "$(cat <<'EOF'
feat(skill): adding-a-platform-scraper

Why: codifies the 12-step recipe future agents must follow when adding a
platform. Three reference templates ship with the skill so the recipe
isn't ambiguous.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 24: Clean up `competitor-research/` + worker re-exports

**Files (delete):**
- `competitor-research/` (entire directory)
- `packages/worker/src/queue.ts` (re-exported indirectly via api now)

Only run this task AFTER Task 22 smoke passes.

- [ ] **Step 1: Delete `competitor-research/`**

Run: `rm -rf competitor-research`

- [ ] **Step 2: Verify nothing still imports from it**

Run: `grep -r "competitor-research" packages/ docs/`
Expected: zero matches (or only matches inside markdown docs which can be updated manually).

If `docs/superpowers/specs/2026-05-16-multi-platform-pipeline-design.md` references it, update that doc to say "(deleted in Task 24)" rather than removing the prose.

- [ ] **Step 3: Decide on worker/src/queue.ts**

`packages/worker/src/queue.ts` currently defines the `QUEUES`, `ScrapePlatformJob`, etc. used by the worker. `packages/api/src/libs/queue.ts` does the same for the api. **Don't delete `worker/src/queue.ts`** — `scrape-platform.ts` and `generate-report.ts` import from it, and merging the two would force a circular workspace dep.

Leave it as-is. (This bullet just documents that the file in the spec's "Modified files" list under "deleted" was wrong.)

- [ ] **Step 4: Type-check + tests once more**

Run:
```bash
pnpm --filter @rivaleye/api type-check
pnpm --filter @rivaleye/worker type-check
pnpm --filter @rivaleye/scrapers type-check
pnpm --filter @rivaleye/shared type-check
pnpm --filter @rivaleye/api exec bun test
pnpm --filter @rivaleye/worker exec bun test
pnpm --filter @rivaleye/scrapers exec bun test
pnpm --filter @rivaleye/shared exec bun test
```
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: drop competitor-research/ after ports validated

Why: every script in competitor-research/ has been ported into
packages/scrapers/src/<platform>/ and smoke-tested end-to-end via the
8-platform pipeline. Source scripts no longer have a consumer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Spec coverage:** every section of the spec maps to a task —
- 5.1 Scrapers → Task 4 + 11 + 12 + 13
- 5.2 LLM client → Task 2
- 5.3 New DB tables → Task 1
- 5.4 Prompts → Task 3 (schemas) + Task 5 + 6 (per-platform appstore) + Task 11 (other 6) + Task 12 (reddit) + Task 15 + 16 + 17 (cross)
- 5.5 Pipeline → Task 14 (delete old) + Task 15-20 (new)
- 5.6 Jobs → Task 10 (scrape-platform) + Task 20 (generate-report)
- 5.7 API → Task 8 (keyword expander) + Task 9 (createReport fan-out)
- 5.8 Config → Task 2 step 6 (config in shared)
- 5.9 Skill → Task 23
- §6 Data flow → Task 22 (smoke validates end-to-end)
- §7 Error handling → Tasks 10 (scraper/Stage A/B failure), 15-17 (PipelineError), 17 (Stage E fallback), 20 (generate-report failure write-back)
- §8 Frontend coverage → Task 18 (derived stats) + Task 19 (persist) — populates all sections the spec lists
- §9 Testing → unit tests in Tasks 4, 11, 12 (normalizers), 5/6/15/16/17 (stage runners), 19 (persist integration), 21 (smoke script), 22 (full end-to-end)
- §10 Migration + rollout → Task ordering matches steps 1-8 of the spec rollout

**Placeholder scan:** none found. Every code step shows the actual code; every command shows the actual command; every assertion shows the expected output.

**Type consistency:** `OpenRouterClient.complete` returns `LlmResponse<T>` with `parsed`, `raw`, `usage`, `model`. Used identically in stage-a, stage-b, stage-c, stage-d, stage-e, keyword-expander. `PlatformExtract` / `PlatformBrief` / `MergedClusters` / `SynthOutput` shapes defined once in `prompts/shared.ts`, imported everywhere downstream.

**One known soft spot:** Task 11 references "competitor-research/hashnode.ts" as the source for the medium scraper — file is named `hashnode.ts` for legacy reasons but the implementation is Medium RSS. Task 11 note on the medium row makes this explicit.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-multi-platform-pipeline.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
