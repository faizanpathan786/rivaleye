# Multi-platform scraper + 5-stage iterative LLM pipeline

**Status:** design
**Date:** 2026-05-16
**Owner:** Ayman Parkar
**Spec scope:** Port 7 working competitor-research scrapers + clean reddit, build new 5-stage iterative LLM pipeline that replaces existing reddit-only stage1-4, persist results into the existing 16 report sub-tables, and create a reusable skill for adding more platforms later.

---

## 1. Goal

Replace the current reddit-only pipeline with a multi-platform, multi-step iterative LLM pipeline that:

1. Fans out scrapes across 8 platforms in parallel.
2. Runs per-platform LLM extract + summarize (Stage A + B) inside each scrape job.
3. Runs cross-platform merge → synth → refine (Stage C + D + E) once all platform jobs finish.
4. Writes results into all 16 existing report sub-tables so the frontend can render every section.
5. Surfaces empty states (not fabricated data) when a section has no signal.

Single configurable LLM model for every stage. Temperature 1.0. No hallucination.

---

## 2. Non-goals

- Not implementing hostile-platform scrapers (g2, capterra, twitter, linkedin, gmaps). They stay scaffolded but disabled.
- Not implementing radar_events generation (different data source — monitoring-based, not scrape-based). Section renders empty.
- Not changing the frontend. The api response shapes for existing report endpoints stay identical.
- Not changing better-auth, dashboard, competitor CRUD, or any other domain.
- Not implementing Stripe/billing.

---

## 3. MVP platform set

| Platform     | Source                                      | Status in MVP |
|--------------|---------------------------------------------|---------------|
| reddit       | `packages/scrapers/src/reddit/` (existing, needs cleanup) | enabled |
| appstore     | port `competitor-research/appstore.ts`      | enabled |
| playstore    | port `competitor-research/playstore.ts`     | enabled |
| hackernews   | port `competitor-research/hackernews.ts`    | enabled |
| producthunt  | port `competitor-research/producthunt.ts`   | enabled |
| devto        | port `competitor-research/devto.ts`         | enabled |
| medium       | port `competitor-research/hashnode.ts` (Medium RSS)  | enabled |
| trustpilot   | port `competitor-research/trustpilot.ts`    | enabled |
| g2 / capterra / twitter / linkedin / gmaps | existing stubs | **disabled** (kept in tree, removed from `ALL_PLATFORMS`) |

`competitor-research/` source scripts stay until ports are validated, then deleted in a separate cleanup commit.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  api  POST /v1/reports                                              │
│         1. insert reports row (status=queued, stage=queued)         │
│         2. LLM call: keyword expansion                              │
│            in:  { competitor, category, audience, goal }            │
│            out: { keywords: string[] }  (max 10)                    │
│         3. insert N report_platform_jobs (one per enabled platform) │
│         4. enqueue 8x scrape-platform jobs (fan-out)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼                           ▼
┌───────────────────────────┐    ┌──────────────────────┐
│  worker  scrape-platform  │ x8 │  pg-boss queue       │
│  1. getScraper(platform)  │    └──────────────────────┘
│  2. fetch → NormalizedPost│
│  3. insert mentions       │
│     (chunked, onConflict  │
│      DoNothing)           │
│  4. Stage A: per-platform │
│     LLM extract           │
│  5. Stage B: per-platform │
│     LLM summarize         │
│  6. insert report_platform│
│     _briefs row           │
│  7. UPDATE report_platform│
│     _jobs SET status=     │
│     completed             │
│  8. if all 8 jobs done    │
│     → enqueue             │
│     generate-report       │
└───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  worker  generate-report                                            │
│  1. load N briefs from report_platform_briefs                       │
│  2. Stage C: cross-platform merge                                   │
│  3. Stage D: cross-platform synth                                   │
│     produces: complaints, feature_gaps, pricing_tiers,              │
│     pricing_quotes, switching, quotes, voice_words, positioning,    │
│     actions, leads, opportunities, threads, thread_messages         │
│  4. Stage E: critique-and-revise on Stage D output                  │
│  5. derive platform_stats + subreddits from mentions counts         │
│  6. persist to 16 sub-tables in single transaction                  │
│  7. set reports.status=completed, stage=done                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Components

### 5.1 Scrapers (`packages/scrapers/src/`)

Eight enabled platforms. All implement existing `Scraper` interface, return `NormalizedPost[]`, throw `ScraperError` on failure.

Per-platform changes:

- **reddit**: clean up. Existing impl in `packages/scrapers/src/reddit/` is buggy (per user: "denting and painting"). Audit `client.ts`, `search.ts`, `normalize.ts`, `auth.ts`, `comments.ts`, `rate-limiter.ts`. Fix bugs surfaced during audit. Add normalizer test.
- **appstore**: port from `competitor-research/appstore.ts`. Drop hardcoded defaults. Replace `process.argv` driver with class. Strip unused fields (developerUrl, sellerUrl, screenshots, ipadScreenshots, appletvScreenshots, supportedDevices, languages, contentRating, fileSizeMB) — keep `appId, bundleId, name, developer, version, rating, ratingsCount, currentVersionRating, currentVersionRatingsCount, releaseNotes, releaseDate, updatedDate, primaryGenre`. Reviews kept fully. Output one `NormalizedPost` per review (mentioning rating in body or score).
- **playstore**: port from `competitor-research/playstore.ts`. Strip `permissions, datasafety, similar`. Keep metadata + reviews. One `NormalizedPost` per review.
- **hackernews**: port from `competitor-research/hackernews.ts`. Strip `recentStories, recentComments, summary` fields. Output one `NormalizedPost` per top story (with top comments concatenated into body or recorded separately as their own NormalizedPost rows).
- **producthunt**: port from `competitor-research/producthunt.ts`. One `NormalizedPost` per post + one per comment.
- **devto**: port from `competitor-research/devto.ts`. One `NormalizedPost` per article + one per comment.
- **medium**: port from `competitor-research/hashnode.ts` (Medium RSS). One `NormalizedPost` per post.
- **trustpilot**: port from `competitor-research/trustpilot.ts`. One `NormalizedPost` per review.

All ports follow `packages/scrapers/CLAUDE.md`:

- Class implementing `Scraper`. Env read at construction.
- Owns its rate limiter (hand-rolled `p-limit` style).
- Throws `ScraperError`; never silently returns `[]`.
- Normalizer unit test (`bun test`): sample raw payload → `NormalizedPost`.

Register all 8 in `packages/scrapers/src/index.ts` (`getScraper` switch + `ALL_PLATFORMS`). Hostile platforms drop out of `ALL_PLATFORMS` but their stubs stay in tree.

### 5.2 LLM client (`packages/shared/src/llm/openrouter.ts`)

Single env-driven client. Lives in `@rivaleye/shared` so both api (for keyword expansion) and worker (for Stage A-E) consume the same client. Replaces current `packages/worker/src/llm.ts` and `packages/worker/src/llm/`.

```ts
export type LlmRequest = {
  system: string;
  user: string;
  schema?: JSONSchema; // when set, response_format=json_schema
  maxTokens?: number;
};

export type LlmResponse<T = unknown> = {
  parsed: T;
  raw: string;
  usage: { promptTokens: number; completionTokens: number };
};

export interface LlmClient {
  complete<T = unknown>(req: LlmRequest): Promise<LlmResponse<T>>;
}
```

Implementation:

- Reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` at construction (default `deepseek/deepseek-chat`).
- Temperature 1.0 (hard-coded; per user spec — "no kachra data" = no low-temperature determinism that crushes nuance).
- HTTP POST to `https://openrouter.ai/api/v1/chat/completions`.
- On JSON parse failure: retry once with stricter "respond with valid JSON only" reminder appended to user message. If still fails, throw `LlmJsonParseError`.
- Logs token usage per call.
- All five stages call through this client. Swap model = change one env var.

### 5.3 New DB tables

#### `report_platform_jobs`

```sql
report_platform_jobs (
  id              uuid pk default random,
  report_id       uuid not null references reports(id) on delete cascade,
  platform        text not null,
  status          report_platform_job_status not null default 'queued',
  error           text,
  started_at      timestamp,
  completed_at    timestamp,
  created_at      timestamp not null default now(),
  unique(report_id, platform)
)
```

Enum `report_platform_job_status`: `queued | running | completed | failed`.

#### `report_platform_briefs`

```sql
report_platform_briefs (
  id              uuid pk default random,
  report_id       uuid not null references reports(id) on delete cascade,
  platform        text not null,
  extract         jsonb not null,
  summary         jsonb not null,
  model_used      text not null,
  prompt_tokens   integer not null default 0,
  completion_tokens integer not null default 0,
  created_at      timestamp not null default now(),
  unique(report_id, platform)
)
```

Both added via Drizzle in `packages/api/src/db/schema/reports.ts` (same file group — they're sub-resources of reports). Migration auto-generated via `pnpm db:generate` then committed.

### 5.4 Prompts (`packages/worker/src/prompts/`)

Wipe existing stage1-4 prompt files. Replace with:

```
packages/worker/src/prompts/
  shared.ts                          # canonical types, schemas, helper builders
  platform/
    reddit/extract.ts
    reddit/summarize.ts
    appstore/extract.ts
    appstore/summarize.ts
    playstore/extract.ts
    playstore/summarize.ts
    hackernews/extract.ts
    hackernews/summarize.ts
    producthunt/extract.ts
    producthunt/summarize.ts
    devto/extract.ts
    devto/summarize.ts
    medium/extract.ts
    medium/summarize.ts
    trustpilot/extract.ts
    trustpilot/summarize.ts
  cross/
    merge.ts        # Stage C
    synth.ts        # Stage D
    refine.ts       # Stage E
```

Each platform prompt file exports `{ system, buildUser, responseSchema }`.

**Stage A (per-platform extract) output shape (canonical, same across platforms):**

```ts
type PlatformExtract = {
  complaints: Array<{ text: string; severity: number; evidence_ids: string[] }>;
  features_requested: Array<{ feature: string; evidence_ids: string[] }>;
  pricing_signals: Array<{ note: string; evidence_ids: string[] }>;
  switching_signals: Array<{
    direction: "inbound" | "outbound";
    competitor: string;
    evidence_ids: string[];
  }>;
  voice_phrases: { positive: string[]; negative: string[] };
  notable_quotes: Array<{ author: string; text: string; evidence_id: string }>;
};
```

`evidence_ids` reference `mentions.external_id`. Schema enforced via OpenRouter `response_format=json_schema`.

**Stage B (per-platform summarize) output shape:**

```ts
type PlatformBrief = {
  platform: PlatformId;
  headline: string;                     // one-sentence summary
  top_themes: Array<{ theme: string; weight: number }>;
  sentiment: { positive: number; neutral: number; negative: number };  // 0-1 sums to 1
  most_quoted_competitors: string[];
  evidence_coverage: number;            // how many mentions actually contributed
};
```

**Stage C (cross-platform merge) input:** all PlatformBriefs + PlatformExtracts.
**Stage C output:** unified clusters of complaints / features / pricing / switching across platforms, each with cross-platform evidence references.

**Stage D (cross-platform synth) input:** Stage C output.
**Stage D output:** single mega-blob — populated content for all 16 report sub-tables in one LLM call: `{ complaints: [...], feature_gaps: [...], pricing_tiers: [...], pricing_quotes: [...], switching: [...], quotes: [...], voice_words: [...], positioning: [...], actions: [...], leads: [...], opportunities: [...], threads: [...], thread_messages: [...] }`. Single call (not 16 parallel calls) so synth output stays internally consistent — same opportunities reference same complaints, same quotes reference same threads. Schema enforced via JSON-mode. Token cost acceptable; one big call ~10-20k output tokens.

**Stage E (refine) input:** Stage D output + the original Stage C merged clusters.
**Stage E output:** revised Stage D shape. Stage E prompt is critique-driven: "look at this synth output. Where is it thin? Where is evidence shallow? Where are sections empty that have available evidence? Rewrite weak sections; leave strong ones unchanged."

### 5.5 Pipeline (`packages/worker/src/pipeline/`)

**Delete:** `stage1.ts, stage2.ts, stage3.ts, stage4.ts, evidence-binding.ts, preflight.ts, adapter.ts, errors.ts, schemas.ts`.

**Keep:** none of the existing files.

**Write fresh:**

```
packages/worker/src/pipeline/
  stage-a-extract.ts    # run from scrape-platform job
  stage-b-summarize.ts  # run from scrape-platform job
  stage-c-merge.ts
  stage-d-synth.ts
  stage-e-refine.ts
  persist.ts            # writes Stage E output to 16 sub-tables
  derive-stats.ts       # builds platform_stats + subreddits from mentions counts
  run.ts                # orchestrator for generate-report (calls C, D, E, persist, derive)
  errors.ts             # PipelineError, LlmJsonParseError, StagePersistError
```

`stage-a-extract.ts` and `stage-b-summarize.ts` exported and called by `scrape-platform.ts`.

`run.ts` orchestrates Stage C → D → E → persist → derive within `generate-report.ts`.

### 5.6 Jobs (`packages/worker/src/jobs/`)

**`scrape-platform.ts`** — updated:

```
1. mark report_platform_jobs.status=running, started_at=now
2. const scraper = getScraper(platform)
3. const posts = await scraper.fetch({ competitor, category, keywords })
4. chunked insert into mentions (onConflictDoNothing) — existing logic
5. const extract = await runStageAExtract({ platform, posts, brief context })
6. const summary = await runStageBSummarize({ platform, extract })
7. insert into report_platform_briefs
8. mark report_platform_jobs.status=completed, completed_at=now
9. check fan-in via Drizzle query:
     db.select({ count: count() }).from(report_platform_jobs)
       .where(and(eq(report_id, $1), inArray(status, ['queued','running'])))
   if count === 0 → boss.send('generate-report', { reportId })
```

On thrown error in steps 2-7: mark `report_platform_jobs.status=failed, error=msg`, then **still run the fan-in check** so a single dead platform doesn't block the whole report.

**`generate-report.ts`** — replaced:

```
1. load report row (must exist, status=running)
2. load all report_platform_briefs for this report (skip platforms that failed)
3. if briefs.length === 0: mark report failed, throw
4. const merged    = await runStageCMerge({ ctx, briefs })
5. const synth     = await runStageDSynth({ ctx, merged })
6. const refined   = await runStageERefine({ ctx, synth, merged })
7. const stats     = await deriveStats({ reportId })  // queries mentions
8. await persistReport({ reportId, refined, stats })  // single transaction
9. UPDATE reports SET status='completed', stage='done', updated_at=now
```

### 5.7 API (`packages/api/src/`)

`POST /v1/reports` handler (`controllers/reports/handlers/createReport.ts`) gains pre-enqueue work:

```
1. insert reports row (existing)
2. const { keywords } = await expandKeywords({ competitor, category, audience, goal })
3. const platforms = ENABLED_PLATFORMS
4. await db.insert(report_platform_jobs).values(
     platforms.map(p => ({ report_id, platform: p, status: 'queued' }))
   )
5. for each platform: enqueue scrape-platform with { reportId, platform, competitor, category, keywords }
6. return { reportId }
```

`expandKeywords` is a service (`services/keyword-expander.ts`) wrapping a single LLM call. Belongs in api (it runs before enqueue, fast, single call, blocks the response).

**Important:** api now imports the LLM client from `@rivaleye/shared` (same path as worker). Update `packages/shared/package.json` exports to include `./llm`. No back-import worker→api.

No other api routes change.

### 5.8 Config (`packages/worker/src/config.ts`)

New file:

```ts
export const ENABLED_PLATFORMS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "medium",
  "trustpilot",
] as const satisfies readonly PlatformId[];

export const LLM_MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat";
export const LLM_TEMPERATURE = 1.0;
```

Same constant re-exported from `packages/shared/src/config.ts` so api uses the same list.

### 5.9 Skill (`.claude/skills/adding-a-platform-scraper/SKILL.md`)

New skill in user's local `.claude/skills/` directory (project-scoped equivalent path: `.claude/skills/` at repo root).

Trigger: user types `/add-platform <name>` or "add a new scraper for X".

**Skill body:**

```markdown
---
name: adding-a-platform-scraper
description: Use when adding a new platform to RivalEye's multi-platform pipeline. Walks through scraper class, prompt templates, schema registration, env vars, tests, and toggling on in ENABLED_PLATFORMS.
---

# Adding a Platform Scraper

Checklist — every step required. Skip none.

1. **Add `PlatformId` literal** in `packages/scrapers/src/types.ts`.

2. **Create scraper class** at `packages/scrapers/src/<platform>/index.ts`:
   - Implements `Scraper` interface
   - Reads env at constructor only
   - Owns rate limiter
   - Returns `NormalizedPost[]`
   - Throws `ScraperError`
   - Template: see `references/scraper-template.ts`

3. **Register in `packages/scrapers/src/index.ts`**: add to `getScraper` switch.
   Do NOT add to `ALL_PLATFORMS` yet — only after smoke-test.

4. **Env vars**: add to root `.env.example` + document in root `CLAUDE.md` §6.

5. **Stage A extract prompt** at `packages/worker/src/prompts/platform/<platform>/extract.ts`:
   - Output schema matches canonical `PlatformExtract` type from `prompts/shared.ts`
   - Template: see `references/extract-prompt-template.ts`

6. **Stage B summarize prompt** at `packages/worker/src/prompts/platform/<platform>/summarize.ts`:
   - Output schema matches canonical `PlatformBrief` type
   - Template: see `references/summarize-prompt-template.ts`

7. **Normalizer test** (`bun test`): sample raw payload → assert `NormalizedPost` shape.

8. **Prompt round-trip test**: mock `LlmClient` → assert schema-valid output for both prompts.

9. **Smoke test**: `bun run packages/worker/src/scripts/test-platform.ts <platform> <competitor>` — runs full scrape + Stage A + Stage B end-to-end against the dev DB, prints brief.

10. **Toggle on**: add to `ENABLED_PLATFORMS` in `packages/worker/src/config.ts` AND `packages/scrapers/src/index.ts` `ALL_PLATFORMS`.

11. **Run full pipeline**: create a report from the api, watch all platforms complete, confirm the new platform's brief appears in `report_platform_briefs`.

## Hostile-platform notes

If platform is on the buy-list (g2, capterra, twitter, linkedin, gmaps): the scraper class wraps the 3rd-party provider call (Apify, X API, etc.). Never DIY scraping on hostile platforms. See `packages/scrapers/CLAUDE.md` §2.
```

Skill ships with three templates in `references/`:
- `scraper-template.ts` — Scraper class skeleton
- `extract-prompt-template.ts` — Stage A prompt skeleton with canonical schema
- `summarize-prompt-template.ts` — Stage B prompt skeleton with canonical schema

---

## 6. Data flow (end-to-end, single report)

```
T+0     POST /v1/reports
        api: insert reports row (status=queued)
        api: 1 LLM call → keywords[]
        api: insert 8 report_platform_jobs (status=queued)
        api: enqueue 8x scrape-platform
        api: respond 200 { reportId }

T+1..N  worker: 8 scrape-platform jobs run in parallel
        per job:
          - mark job running
          - fetch (varies: 1s reddit, 30s appstore with 10 reviews/app x 5 apps)
          - chunked insert mentions
          - Stage A LLM call (~3-8s)
          - Stage B LLM call (~2-4s)
          - insert report_platform_briefs
          - mark job completed
          - fan-in check → enqueue generate-report if last

T+M     worker: generate-report runs once
          - load 8 briefs (or fewer if some failed)
          - Stage C LLM call (~5-10s)
          - Stage D LLM call (~10-20s) — big output
          - Stage E LLM call (~10-20s) — critique-revise
          - derive platform_stats + subreddits from mentions counts
          - persist into 16 sub-tables (single transaction)
          - mark reports.status=completed, stage=done

T+M+ε   web: report page polling sees status=completed, renders all sections
```

Expected total wall time: 1-3 minutes per report. Dominated by scraper fetches (especially playstore/appstore reviews) and Stage D synth size.

---

## 7. Error handling

| Failure point                | Behaviour                                                                 |
|------------------------------|---------------------------------------------------------------------------|
| Single scraper throws        | mark `report_platform_jobs.status=failed`, store error, run fan-in check anyway |
| Scraper returns 0 posts      | mark job completed (not failed), no brief inserted, fan-in continues       |
| Stage A or B fails           | mark `report_platform_jobs.status=failed`, fan-in continues               |
| LLM JSON parse fails 2x      | throw `LlmJsonParseError` → job fails                                     |
| Stage C fails                | mark reports.status=failed, error stored                                  |
| Stage D fails                | retry once → on second fail, mark reports.status=failed                   |
| Stage E fails                | fall back to using Stage D output unrefined, log warning, mark completed  |
| All scrapers fail            | generate-report sees 0 briefs → mark reports.status=failed                |
| Single sub-table empty       | write nothing → frontend empty state (NEVER fabricate)                    |
| pg-boss retry                | all handlers idempotent: scrape uses `onConflictDoNothing`, Stage A/B uses unique `(report_id, platform)` on briefs |

---

## 8. Frontend coverage

All 16 sub-tables get populated from Stage D + E output where evidence exists. Empty-data sections render existing empty states (no schema change frontend-side).

Sections NOT populated by the pipeline (different data source — keep empty optimistic state):
- `radar_events` (monitoring-based, future work)
- per-report competitor mentions in `competitors.stat_*` fields (existing aggregate logic)

Sections derived (not LLM-generated):
- `report_platform_stats` — built from `mentions` counts grouped by platform
- `report_subreddits` — built from reddit mentions grouped by `raw.subreddit`

---

## 9. Testing

- **Scraper normalizer tests** — one per platform. Sample raw payload checked into `__fixtures__/`. Assert `NormalizedPost` shape.
- **Prompt schema tests** — one per Stage A and Stage B per platform (8x2 = 16) + Stage C, D, E (3). Mock `LlmClient` returning fixture JSON → assert parsed output validates against canonical schema.
- **Pipeline integration test** — seed `mentions` + `report_platform_briefs` for one report → run `generate-report` with mocked LLM → assert all 16 sub-tables populated correctly. Skipped in CI by default; runs locally.
- **Smoke test script** — `bun run packages/worker/src/scripts/test-platform.ts <platform> <competitor>` for manual end-to-end against dev DB.

---

## 10. Migration + rollout

1. Add Drizzle schema for `report_platform_jobs` + `report_platform_briefs`. Run `pnpm db:generate`. Commit migration.
2. Build LLM client in `shared/`. Replace `worker/src/llm.ts`.
3. Port scrapers one at a time (start with reddit cleanup → appstore → playstore → ...). Smoke-test each.
4. Replace `worker/src/pipeline/`. Wire Stage A/B into `scrape-platform.ts`. Wire Stage C/D/E into `generate-report.ts`.
5. Update `createReport` handler with keyword expansion + fan-out.
6. End-to-end smoke: create a report for "notion / productivity SaaS" → confirm all 8 scrapes run → confirm 16 sub-tables populated → confirm web report page renders.
7. Add skill `.claude/skills/adding-a-platform-scraper/`.
8. Delete `competitor-research/` directory in a separate cleanup commit only after all ports validated.

No feature flag. This replaces the existing reddit-only pipeline directly — current pipeline isn't in production use.

---

## 11. Open questions

None. All previously-open questions resolved in brainstorm:
- 5 stages: A (per-platform extract) → B (per-platform summarize) → C (cross merge) → D (cross synth) → E (refine). ✅
- 8 platforms enabled. ✅
- `mentions` for raw + `report_platform_briefs` for LLM per-platform output. ✅
- Single LLM model, swappable via env. ✅
- Replace existing pipeline entirely. ✅
- Scrapers get competitor + category + LLM-expanded keywords. ✅
- Max coverage, no hallucination, temperature 1.0. ✅
- Skill for adding more platforms. ✅
