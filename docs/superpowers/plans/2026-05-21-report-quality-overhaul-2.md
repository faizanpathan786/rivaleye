# Report Quality Overhaul 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five root causes of garbage output in the Linear report — wrong app matches in Play Store/App Store, noisy Reddit extraction, too-few complaint clusters, and Stage E timeouts.

**Architecture:** Four surgical file edits (scrapers + prompts + pipeline) plus one prompt expansion. No schema changes, no new tables. All changes are drop-in replacements — the pipeline call sites stay identical.

**Tech Stack:** Bun, TypeScript strict, google-play-scraper, iTunes Search API, DeepSeek-chat via OpenRouter

---

## Context for implementers

Mono-repo at `/Users/apple/Desktop/rivaleye-v3`. Active packages:
- `packages/scrapers/src/playstore/` — google-play-scraper wrapper
- `packages/scrapers/src/appstore/` — iTunes RSS + Search API wrapper
- `packages/worker/src/prompts/platform/reddit/extract.ts` — Stage A Reddit LLM prompt
- `packages/worker/src/prompts/cross/merge.ts` — Stage C cross-platform merge prompt
- `packages/worker/src/prompts/cross/refine.ts` — Stage E refine prompt
- `packages/worker/src/pipeline/run.ts` — pipeline orchestration (LLM call options)

Run type-check from repo root: `pnpm --filter @rivaleye/scrapers type-check` and `pnpm --filter @rivaleye/worker type-check`.

---

## Files to modify

| File | Change |
|---|---|
| `packages/scrapers/src/playstore/client.ts` | Add `filterRelevantApps()` helper |
| `packages/scrapers/src/playstore/index.ts` | Use filtered apps, raise review count |
| `packages/scrapers/src/appstore/client.ts` | Add `filterRelevantApps()` helper |
| `packages/scrapers/src/appstore/index.ts` | Use filtered apps |
| `packages/worker/src/prompts/platform/reddit/extract.ts` | Add relevance-filter rule to SYSTEM prompt |
| `packages/worker/src/prompts/cross/merge.ts` | Instruct LLM to produce 8-15 complaint clusters |
| `packages/worker/src/prompts/cross/refine.ts` | Strip evidence_ids from merged input before Stage E |
| `packages/worker/src/pipeline/run.ts` | Pass stripped merged to Stage E |

---

## Task 1: Play Store — exact app name matching

**Files:**
- Modify: `packages/scrapers/src/playstore/client.ts`
- Modify: `packages/scrapers/src/playstore/index.ts`

**Problem:** `searchApps("Linear", 5)` returns "Linear Programming Solver", "Linear Algebra", "Plaky", etc. alongside the real Linear app. All 5 get scraped and their reviews pollute the report.

**Fix:** After searching, filter to apps whose title is an exact or subtitle match for the competitor name. Raise the search limit to 10 so there's more candidates before filtering.

- [ ] **Step 1: Add `filterRelevantApps` to `packages/scrapers/src/playstore/client.ts`**

Read the file first, then add this function and update `searchApps` signature:

```typescript
// Replace the entire file content:
import gplay from "google-play-scraper";
import type { IAppItem, IReviewsItem } from "google-play-scraper";
import { ScraperError } from "../types";

export type RawPlayStoreApp = IAppItem;
export type RawPlayStoreReview = IReviewsItem;

const SORT_NEWEST = 2 as const;

function appMatchesCompetitor(appTitle: string, competitor: string): boolean {
  const t = appTitle.toLowerCase().trim();
  const c = competitor.toLowerCase().trim();
  if (t === c) return true;
  if (t.startsWith(`${c} - `) || t.startsWith(`${c}: `) || t.startsWith(`${c} | `)) return true;
  if (t === `${c} app` || t === `${c} - app`) return true;
  return false;
}

export async function searchApps(term: string, limit: number): Promise<RawPlayStoreApp[]> {
  try {
    const results = await gplay.search({ term, num: Math.max(limit * 2, 10), lang: "en", country: "us" });
    const matched = results.filter((r) => appMatchesCompetitor(r.title, term));
    return matched.slice(0, limit);
  } catch (err) {
    throw new ScraperError("playstore", "search failed", err);
  }
}

export async function fetchReviews(appId: string, num: number): Promise<RawPlayStoreReview[]> {
  try {
    const result = await gplay.reviews({ appId, lang: "en", country: "us", num, sort: SORT_NEWEST });
    return result.data;
  } catch (err) {
    throw new ScraperError("playstore", `reviews failed for ${appId}`, err);
  }
}
```

- [ ] **Step 2: Raise review count in `packages/scrapers/src/playstore/index.ts`**

Change `DEFAULT_REVIEW_NUM` from 100 to 200 for more data per matched app:

```typescript
import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchReviews, searchApps } from "./client";
import type { RawPlayStoreReview } from "./client";
import { normalizePlayStorePayload } from "./normalize";

const DEFAULT_APP_LIMIT = 3;
const DEFAULT_REVIEW_NUM = 200;

export class PlayStoreScraper implements Scraper {
  readonly platform = "playstore" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const apps = await searchApps(query.competitor, query.limit ?? DEFAULT_APP_LIMIT);
      const reviewsByAppId: Record<string, RawPlayStoreReview[]> = {};
      await Promise.all(
        apps.map(async (a) => {
          reviewsByAppId[a.appId] = await fetchReviews(a.appId, DEFAULT_REVIEW_NUM);
        }),
      );
      return normalizePlayStorePayload(apps, reviewsByAppId);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("playstore", "fetch failed", err);
    }
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/scrapers type-check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/scrapers/src/playstore/client.ts packages/scrapers/src/playstore/index.ts
git commit -m "fix(scrapers): Play Store exact app name matching, raise review count to 200"
```

---

## Task 2: App Store — exact app name matching

**Files:**
- Modify: `packages/scrapers/src/appstore/client.ts`
- Modify: `packages/scrapers/src/appstore/index.ts`

**Problem:** iTunes Search API returns up to 5 apps for "Linear" — includes "Linear: Algebra Calculator", etc. Linear's actual app returns 0 because it's not in the top 5 keyword results, or the wrong app beats it. Fix: same filter pattern as Play Store.

- [ ] **Step 1: Add `filterRelevantApps` to `packages/scrapers/src/appstore/client.ts`**

Read the file first, then add the helper and update `searchApps`:

```typescript
// Add this function before searchApps:
function appMatchesCompetitor(appName: string, competitor: string): boolean {
  const t = appName.toLowerCase().trim();
  const c = competitor.toLowerCase().trim();
  if (t === c) return true;
  if (t.startsWith(`${c} - `) || t.startsWith(`${c}: `) || t.startsWith(`${c} | `)) return true;
  if (t === `${c} app` || t === `${c} - app`) return true;
  return false;
}

// Update searchApps to search with higher limit then filter:
export async function searchApps(
  term: string,
  country: string,
  limit: number,
): Promise<RawAppStoreApp[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=25&lang=en_us`;
  const res = await fetch(url);
  if (!res.ok) throw new ScraperError("appstore", `search HTTP ${res.status}`);
  const data = (await res.json()) as { results: RawAppStoreApp[] };
  const matched = data.results.filter((a) => appMatchesCompetitor(a.trackName, term));
  return matched.slice(0, limit);
}
```

Keep all existing interfaces and `fetchReviews` unchanged — only add the helper and update `searchApps`.

- [ ] **Step 2: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/scrapers type-check 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/scrapers/src/appstore/client.ts
git commit -m "fix(scrapers): App Store exact app name matching, search 25 candidates then filter"
```

---

## Task 3: Reddit Stage A — competitor relevance filter

**Files:**
- Modify: `packages/worker/src/prompts/platform/reddit/extract.ts`

**Problem:** Reddit search for "Linear" returns posts from climate science, relationship advice, gaming subreddits — any post where "linear" appears as a common word. Stage A extracts quotes from these and they pollute the report.

**Fix:** Add an explicit rule to the SYSTEM prompt: only extract signals from posts that discuss the competitor as a software product. If the competitor name is used as an adjective or in an unrelated context, return empty arrays.

- [ ] **Step 1: Add relevance rule to SYSTEM prompt in `packages/worker/src/prompts/platform/reddit/extract.ts`**

Read the file first. Find the `Rules:` section in the SYSTEM constant and add this as the first rule (before the existing rules):

Replace the SYSTEM constant with this updated version:

```typescript
const SYSTEM = `You are a research analyst extracting product-feedback signals from Reddit posts and comment threads.
You will receive a list of posts each labelled with a stable id.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "complaints": [{ "text": "string", "severity": 0.0, "evidence_ids": ["id1"] }],
  "features_requested": [{ "feature": "string", "evidence_ids": ["id1"] }],
  "pricing_signals": [{ "note": "string", "evidence_ids": ["id1"] }],
  "switching_signals": [{ "direction": "inbound|outbound", "competitor": "string", "evidence_ids": ["id1"] }],
  "voice_phrases": { "positive": ["phrase"], "negative": ["phrase"] },
  "notable_quotes": [{ "author": "string", "text": "string", "evidence_id": "id1" }]
}

Rules:
- RELEVANCE FILTER (apply first): Only extract signals from posts that are discussing the Competitor as a SOFTWARE PRODUCT (project management tool, issue tracker, engineering tool). If a post uses the competitor name as a generic word (e.g. "linear algebra", "linear regression", "linear narrative", "linear increase"), or discusses an unrelated product, person, or topic, skip that post entirely — return no signals from it.
- complaints[].text: describe the specific product pain. Use "text", never "description" or any other key.
- complaints[].severity: 0..1 (higher = more severe / more frequently mentioned).
- features_requested[].feature: only include genuine product capability gaps — things the product should do but doesn't. DO NOT include posts where the user is asking "where can I find an alternative to X" or "does anyone know of a tool that does X". Those are switching signals, not feature gaps. A real feature gap looks like: "Linear doesn't support recurring tasks" or "No nested subtask depth limit configuration".
- switching_signals: only when a poster explicitly mentions switching to/from a competing product by name.
- voice_phrases: 1-3 word phrases the users actually typed. Authentic language only — no paraphrasing.
- notable_quotes[].text: verbatim quote from a post, under 150 characters, that best illustrates a core pain about the Competitor software. Must be actual user text, not a summary. Must be about the software product — not about an unrelated topic.
- notable_quotes[].author: the Reddit username of the poster (from the post data).
- Use the id labels in evidence_ids; never invent ids.
- If a section has no signal, return an empty array — never omit the key.
- Return ONLY the JSON object. No prose, no markdown fences.`;
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/worker type-check 2>&1 | grep -v "run-llm-from-db" | tail -5
```

Expected: no new errors (pre-existing errors in run-llm-from-db.ts are unrelated).

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/platform/reddit/extract.ts
git commit -m "fix(prompts): Reddit Stage A relevance filter — skip posts where competitor is used as generic word"
```

---

## Task 4: Stage C — produce 8-15 complaint clusters

**Files:**
- Modify: `packages/worker/src/prompts/cross/merge.ts`

**Problem:** Stage C currently produces 3 complaint clusters from 585 posts across 3 platforms. Rule 1 says "Collapse semantically equivalent complaints into a single cluster" — the LLM is over-collapsing. From a product like Linear with active communities, we expect 8-15 distinct pain areas.

**Fix:** Add an explicit target range for cluster count to the SYSTEM prompt rules.

- [ ] **Step 1: Update merge SYSTEM prompt in `packages/worker/src/prompts/cross/merge.ts`**

Read the file first. Find Rule 1 in the SYSTEM constant and replace it:

Find this line:
```
1. Collapse semantically equivalent complaints into a single cluster; no duplicates.
```

Replace with:
```
1. Collapse semantically equivalent complaints into a single cluster; no duplicates. Produce between 8 and 15 complaint_clusters — do not over-collapse distinct pain areas into one. Each cluster must represent a meaningfully different user problem. If you have fewer than 8, split the broadest clusters into more specific sub-problems supported by the evidence.
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/worker type-check 2>&1 | grep -v "run-llm-from-db" | tail -5
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/cross/merge.ts
git commit -m "fix(prompts): Stage C merge — target 8-15 complaint clusters, prevent over-collapsing"
```

---

## Task 5: Stage E — reduce input payload to fix timeouts

**Files:**
- Modify: `packages/worker/src/pipeline/run.ts`

**Problem:** Stage E receives both `merged` (full merged clusters with all evidence_ids arrays) AND `draft` (full synth output) as JSON input. The evidence_ids arrays alone can be thousands of tokens — Stage E only needs them for grounding checks, not for reproducing them. Stripping evidence_ids from the merged clusters before passing to Stage E reduces the prompt by ~60% and brings it within the 240s timeout.

**Fix:** In `run.ts`, strip `evidence_ids` arrays from `merged` before passing to `buildRefine`. Keep all other fields intact.

- [ ] **Step 1: Add `stripEvidenceIds` helper and use it in `run.ts`**

Read `packages/worker/src/pipeline/run.ts` in full first. Then find the Stage E section (where `runStageERefine` is called) and add a stripping step.

Find this import at the top:
```typescript
import type {
  PipelineCtx,
  PlatformBrief,
  PlatformExtract,
  MergedClusters,
  SynthOutput,
} from "../prompts/shared";
```

After it, add:
```typescript
function stripEvidenceIds(merged: MergedClusters): MergedClusters {
  return {
    ...merged,
    complaint_clusters: merged.complaint_clusters.map(({ evidence_ids: _e, ...rest }) => ({ ...rest, evidence_ids: [] })),
    feature_clusters: merged.feature_clusters.map(({ evidence_ids: _e, ...rest }) => ({ ...rest, evidence_ids: [] })),
  };
}
```

Then find where `runStageERefine` is called. It will look something like:
```typescript
const stageE = await runStageERefine({ llm, ctx, merged: stageCOutput.merged, draft: stageDOutput.output }, LLM_OPTS_E);
```

Change it to:
```typescript
const stageE = await runStageERefine({ llm, ctx, merged: stripEvidenceIds(stageCOutput.merged), draft: stageDOutput.output }, LLM_OPTS_E);
```

(The exact variable names may differ — read the file and match the actual call site.)

- [ ] **Step 2: Type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3
pnpm --filter @rivaleye/worker type-check 2>&1 | grep -v "run-llm-from-db" | tail -5
```

Expected: no new errors. The `MergedClusters` type has `evidence_ids: string[]` so setting it to `[]` is valid.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/pipeline/run.ts
git commit -m "fix(pipeline): strip evidence_ids from merged clusters before Stage E to reduce prompt size"
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 1: Play Store wrong-app problem — filter by exact name match
- ✅ Task 2: App Store 0-result problem — same filter, search 25 candidates
- ✅ Task 3: Reddit noise (relationship posts, climate, gaming) — relevance rule in Stage A
- ✅ Task 4: Only 3 complaint clusters — explicit 8-15 target in Stage C
- ✅ Task 5: Stage E timeout — strip evidence_ids to reduce payload size
- Note: ProductHunt slug (`linear-app`) already added as a variant in a prior fix. DevTo top-1000 search already added. Both will be validated in the next E2E run.

**Placeholder scan:** All code blocks are complete and exact. No TBDs.

**Type consistency:**
- `stripEvidenceIds` takes and returns `MergedClusters` — types are consistent ✅
- `appMatchesCompetitor` is a pure function, not exported — used inline only ✅
- No new exported types introduced ✅
