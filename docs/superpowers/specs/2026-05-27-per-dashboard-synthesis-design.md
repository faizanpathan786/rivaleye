# Per-Dashboard Synthesis — Stop Over-Collapsing the Signal Funnel

## Problem

RivalEye reports felt low-value. For a Notion scan, every role dashboard (founder / product / marketing / growth) harped on the same ~2 findings (e.g. "mobile responsiveness"). The root cause was measured on report `5ac6c0ad`:

| Stage | What survives |
|---|---|
| Mentions scraped | 1058 (appstore 500 + playstore 200 = 66% app reviews) |
| Stage A signals extracted | ~170 (app + play ~116, 68%) |
| Stage C merged clusters | 20 total (love 4, pain 4, gap 3, switch 3, feature 2, positioning 2, pricing 2) |
| Stage D synth draft | ~13 findings (4 complaints, 2 opportunities, 2 actions, 3 gaps, 2 switching) |

Two findings:

1. The big collapse is the **Stage C LLM merge** crushing 170 signals into 20 clusters.
2. The surviving 20 clusters are app-review-flavored because 68% of the input is app reviews.

The 4 role dashboards all read those same 20 collapsed clusters (via `mergedSignals`), so they cannot help but repeat the same handful of app-flavored themes. The dashboard schemas themselves (in `packages/worker/src/prompts/role-sections/schema.ts`) are already rich and well-designed — they are rich containers fed thin gruel.

## Goal

Make each of the 4 role dashboards genuinely valuable and distinct by feeding each one the **full signal corpus** and letting each synthesize through its own lens, instead of all sharing one over-collapsed neutral digest.

## Decisions (locked with the product owner)

1. **Approach A: per-dashboard synthesis from the full pool.** Each dashboard (founder / product / marketing / growth) reads all ~170 signals and does its own dedup + synthesis. One rich LLM pass per dashboard (not two-pass), with a "richness floor" instruction.
2. **No platform balancing / no credibility weighting** — every signal is equal regardless of platform. Take whatever each platform gives.
3. **Replace the legacy flat report surface with the dashboards.** The frontend already has a live `/scan-report/:id` route rendering the dashboards from `report_role_sections` via `GET /v1/reports/:id/sections`; the dashboard components already exist.

## Design

- Replace the Stage C LLM merge (the collapsing step) with a pure-code "assemble" step: `assembleSignalPool(signalExtracts): MergedSignals` in `packages/worker/src/pipeline/assemble-signals.ts`. It maps every raw Stage A signal 1:1 into a `MergedSignals` cluster (no semantic collapse, no cap, no balancing), tagging each with its source platform, and computes per-cluster stats (`frequency`, `source_spread`, `platforms`, `confidence`), `evidence_index`, `source_coverage`, `voice_top`, and `clustering_meta`. Zero LLM, instant, lossless.
- Because the assembled pool reuses the existing `MergedSignals` type, downstream role synthesis (`runRoleSynthesis` in `stage-d-role.ts`) needs **no type changes** — it just receives ~170 clusters instead of 20. The 5 role prompt builders (overview / founder / product / marketing / growth) get a "richness floor" instruction added: mine the full corpus, surface all distinct findings the evidence supports, do not collapse to a handful.
- `run.ts`: the Stage C block swaps `runStageCMerge` (LLM) for `assembleSignalPool` (pure code); checkpoint still saved.
- Legacy Stage D synth + Stage E refine and the legacy flat sub-tables are slated for retirement (the frontend reads `role_sections`). Initial implementation may keep them running harmlessly to minimize blast radius; full removal is follow-up cleanup.

## Performance characteristics

- Each role prompt input grows from ~3K tokens (20 clusters) to ~25K tokens (170 clusters). Within DeepSeek context.
- The 5 role passes run in parallel (latency ≈ one pass).
- Existing per-section `safeParse` fallbacks protect against any bloat-induced failures.

## Risks

- **Prompt size growth (~8x)** could trigger truncation / empty-content on weaker stages; mitigated by compact serialization and existing graceful fallbacks.
- **App-review volume dominance** is accepted by explicit decision (all signals equal); per-dashboard lenses + richness floor are expected to surface non-app nuance that the old single collapse suppressed.

## Out of scope

- New dashboard UI (already built).
- Dashboard schema redesign (already good).
- Scraper volume caps (left as-is).

## Verification plan

Run the pipeline on a fresh competitor scan end-to-end; compare the new `role_sections` richness / diversity against the old Notion report `5ac6c0ad` (which had ~2 repeated findings across dashboards).
