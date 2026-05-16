---
name: adding-a-platform-scraper
description: Use when adding a new platform to RivalEye's multi-platform pipeline. Walks through scraper class, prompt templates, schema registration, env vars, tests, and toggling on in ENABLED_PLATFORMS.
---

# Adding a Platform Scraper

Follow these 12 steps in order. Each step references the file(s) to create or modify.

---

## Step 1 — Decide: DIY vs hostile

Consult the build-vs-buy table in `packages/scrapers/CLAUDE.md`. If the platform blocks scrapers (LinkedIn, G2, Capterra, Gmaps), wrap a third-party provider (Apify actor or official API) inside your scraper class. Never write a headless-browser farm.

---

## Step 2 — Add `PlatformId` literal

File: `packages/scrapers/src/types.ts`

Add the new platform name to the `PlatformId` union. Keep alphabetical order.

```ts
export type PlatformId =
  | "existing-platform"
  | "<newplatform>"  // add here
  | ...;
```

---

## Step 3 — Create the scraper class

Directory: `packages/scrapers/src/<newplatform>/`

Required files:
- `client.ts` — raw API/HTTP calls and raw response types
- `normalize.ts` — maps raw payload → `NormalizedPost[]`
- `index.ts` — exports the class implementing `Scraper`

Use `references/scraper-template.ts` as a starting scaffold. Key rules:
- `readonly platform = "<newplatform>" as const`
- Read all env vars in the constructor, not mid-fetch
- Wrap `fetch()` body in `try/catch`; re-throw `ScraperError` for typed errors, wrap unknown errors
- Never let platform-specific fields escape; output is `NormalizedPost[]` only
- Throw `ScraperError`, never silently return `[]` on error

---

## Step 4 — Register in `getScraper` and `ALL_PLATFORMS`

File: `packages/scrapers/src/index.ts`

1. Add named export for the new scraper class.
2. Add `import` at the top.
3. Add a `case "<newplatform>": return new <NewPlatform>Scraper();` branch in `getScraper`.
4. Add `"<newplatform>"` to the `ALL_PLATFORMS` array.

---

## Step 5 — Add env vars

Files: `.env.example` and root `CLAUDE.md` env-vars table

Document every env var the new scraper reads. Format:

```
<NEWPLATFORM>_API_KEY=        # <NewPlatform> API key for scraper
```

Read only via `process.env.<VAR>` in the constructor. Never hardcode.

---

## Step 6 — Create Stage A extract prompt

Directory: `packages/worker/src/prompts/platform/<newplatform>/`

File: `extract.ts`

Use `references/extract-prompt-template.ts` as scaffold. Key requirements:
- Import `platformExtractSchema` and `PipelineCtx` from `../../shared`
- `SYSTEM` describes extracting product-feedback signals from `<NewPlatform>`
- Build function maps `NormalizedPost[]` → labelled input block for the LLM
- Return `{ system, user, schema: platformExtractSchema }`

---

## Step 7 — Create Stage B summarize prompt

File: `packages/worker/src/prompts/platform/<newplatform>/summarize.ts`

Use `references/summarize-prompt-template.ts` as scaffold. Key requirements:
- Import `platformBriefSchema`, `PipelineCtx`, and `PlatformExtract` from `../../shared`
- `SYSTEM` summarises platform feedback into a platform-level brief (same 5 rules as other platforms)
- User prompt includes `Platform: <newplatform>`
- Return `{ system, user, schema: platformBriefSchema }`

---

## Step 8 — Wire into Stage A `pickBuilder`

File: `packages/worker/src/pipeline/stage-a-extract.ts`

1. Add import: `import { build<NewPlatform>Extract } from "../prompts/platform/<newplatform>/extract";`
2. Add `case "<newplatform>":` branch in `pickBuilder` switch, mapping `NormalizedPost[]` fields to the extract builder's input shape.

---

## Step 9 — Wire into Stage B `pickBuilder`

File: `packages/worker/src/pipeline/stage-b-summarize.ts`

1. Add import: `import { build<NewPlatform>Summarize } from "../prompts/platform/<newplatform>/summarize";`
2. Add `case "<newplatform>": return build<NewPlatform>Summarize;` in the `pickBuilder` switch.

---

## Step 10 — Toggle on in `ENABLED_PLATFORMS`

File: `packages/shared/src/llm/config.ts`

Add `"<newplatform>"` to the `ENABLED_PLATFORMS` array only when the scraper is production-ready (auth works, normalize tested, fixtures committed). Leave it off during development to avoid breaking the report fan-in.

Also update `platformIdSchema` in `packages/worker/src/prompts/shared.ts` if the new platform needs to appear in LLM-schema validation.

---

## Step 11 — Add a fixture and normalize unit test

Files:
- `packages/scrapers/src/__fixtures__/<newplatform>.json` — minimal sample raw payload (≥3 items)
- `packages/scrapers/src/<newplatform>/normalize.test.ts` — feeds fixture → `normalizeAppStorePayload` (or equivalent) → asserts `NormalizedPost` shape

Test rules:
- Every `NormalizedPost` must have `platform === "<newplatform>"`
- `externalId` must be non-empty
- `body` must be non-empty
- `createdAt` must be a valid `Date`
- Run with `bun test`

---

## Step 12 — Run type-check and tests

```sh
pnpm --filter @rivaleye/scrapers type-check
pnpm --filter @rivaleye/worker type-check
pnpm --filter @rivaleye/scrapers test   # bun test
```

All must pass before merging.

---

## Hostile-platform notes

For G2, Capterra, LinkedIn, Gmaps:
- The scraper class wraps an Apify actor call (or equivalent provider).
- Pass `APIFY_TOKEN` (already in `.env.example`) from the constructor.
- Never attempt direct HTTP scraping; the sites actively block it.
- The `normalize.ts` still maps the Apify response → `NormalizedPost[]` — you own the normalization layer.
- If the provider's schema changes, update only `normalize.ts`; the rest of the pipeline is unaware.

---

## Tests required

| File | What to test |
|---|---|
| `normalize.test.ts` | fixture JSON → `NormalizedPost[]` shape, field types, non-empty ids/bodies |
| `extract.ts` (prompt) | `buildExtract` returns non-empty `system`, `user`, and the correct `schema` reference |
| `summarize.ts` (prompt) | `buildSummarize` returns non-empty `system`, `user`, and `platformBriefSchema` |
| Stage A integration | `pickBuilder("<newplatform>")` does not throw; returned builder accepts a mock `StageAInput` |
| Stage B integration | `pickBuilder("<newplatform>")` does not throw; returned builder accepts a mock `StageBInput` |
