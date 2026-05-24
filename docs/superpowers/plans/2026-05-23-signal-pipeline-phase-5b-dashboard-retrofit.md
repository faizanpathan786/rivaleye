# Phase 5b — Dashboard Retrofit (Path 1: Align UI to Doc-16 Contract)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire the four pretty role dashboards (`founder.tsx`/`product.tsx`/`marketing.tsx`/`growth.tsx`) to consume real data from `useReportSectionsQuery`, while aligning the UI to the doc-16 contract. **Fabrication-prone mock-only widgets are dropped, not preserved**, in service of RivalEye's "every claim grounded" promise.

**Architecture (Path 1):**

1. **Shared dashboard primitives** (one set, used by all four pages) — the five cross-cutting fixes the audits identified:
   - `<ConfidenceIndicator>` renders `Confidence` (`{ score, label, basis }`) as a colored badge with tooltip.
   - `bucketFloat(0..1) → "low" | "medium" | "high"` helper for severity / friction / urgency badges that were enum-strings in mocks.
   - `<ScoreFactors>` renders the fixed-key factor objects as bars (replaces the array-iterator pattern).
   - `<EvidenceDrawer>` resolves `evidence_refs.quote_ids` against `EvidenceSection.quotes` instead of reading inline quotes.

2. **Per-role adapters** (one per dashboard, pure functions): `dashboard-adapters/{founder,product,marketing,growth}.ts` map doc-16 section → the page's component-input shape, applying renames, type coercions, and noting which mock-only fields are dropped.

3. **Page refactors** — each `routes/<role>.tsx` accepts `data?: ReturnType<typeof adapt<Role>>` prop (falls back to mock when undefined for the dev-only `/founder` etc. routes). Mock-only widgets that fabricate are removed; widgets that need the new shared primitives are migrated.

4. **`scan-report.tsx`** becomes the live parent at `/scan-report/:id` — one fetch, runs all four adapters, threads section data into each embedded lens. Existing `/scan-report` (no id) keeps working with mocks for the design demo.

**Dropped mock-only widgets (no contract source, would require fabrication):**
- `delta` / `+34% QoQ` / `weeklyDelta` / `trends[]` — no time-series in the pipeline.
- `score.insight` / `score.focus` / `bestAngle` / `topOpportunity` long-form narrative blocks — non-evidence prose.
- `score.coverage[]` per role section — coverage lives in `OverviewSection.source_coverage` (rendered once at the top, not per role).
- Inline `quote` + `who` blocks per item — replaced by the new evidence drawer.
- `wedge.evidence.{mentions,threads,sources}` stats sub-object — duplication of `evidence_refs`.
- `actions[].next` "what to do this week" — no contract field.
- `pricingLeads[].quote` inline blockquote — replaced by evidence drawer.
- `segmentHints[].who` attribution string — replaced by evidence_refs.
- Inline `doNot` / `angle` panels per feed card — these are properly modeled in `suggested_reply_angles`; rendered separately.
- `gaps[].requirement`, `gaps[].effort`, `gaps[].risk` — no contract source (would be made up).
- `decisions.*[].quote` inline blockquote — replaced by evidence drawer.
- `clusterCards[].trend` / `loves[n].mentions` raw counts — replaced by `frequency` 0..1.

**Source spec:** `docs/architecture/16-dashboard-data-contracts.md`. Audit results are the basis for every adapter's mapping table.

**Scope guard:** Do NOT modify Stage D/E/persist/api or any worker code. This is web-only.

---

## File Map

**Create:**
- `packages/web/src/lib/dashboard-helpers.ts` — `bucketFloat`, helpers.
- `packages/web/src/components/dashboard/confidence-indicator.tsx`
- `packages/web/src/components/dashboard/score-factors.tsx`
- `packages/web/src/components/dashboard/evidence-drawer.tsx`
- `packages/web/src/lib/dashboard-adapters/founder.ts` (+ test)
- `packages/web/src/lib/dashboard-adapters/product.ts` (+ test)
- `packages/web/src/lib/dashboard-adapters/marketing.ts` (+ test)
- `packages/web/src/lib/dashboard-adapters/growth.ts` (+ test)

**Modify:**
- `packages/web/src/routes/founder.tsx` — accept `data?: FounderAdapterOutput`; replace components per shared primitives; drop mock-only widgets.
- `packages/web/src/routes/product.tsx` — same.
- `packages/web/src/routes/marketing.tsx` — same.
- `packages/web/src/routes/growth.tsx` — same.
- `packages/web/src/routes/scan-report.tsx` — at `/scan-report/:id`, fetch + thread adapter output to each lens.
- `packages/web/src/app.tsx` — add `/scan-report/:id` route.

**Untouched:** existing `/reports/:id/sections` (Phase 5 MVP debug page stays). Existing `/scan-report` without id stays as mock demo.

---

## Execution Waves

- **Wave 1:** G1 (shared primitives) — solo.
- **Wave 2 (parallel ×4):** G2–G5 (adapters per role) — need G1.
- **Wave 3 (parallel ×4):** G6–G9 (page refactors per role) — need G1 + their adapter.
- **Wave 4:** G10 (scan-report parent) — needs G6–G9.
- **Wave 5:** G11 (verification).

---

## Task G1 — Shared dashboard primitives

**Files:** Create the 4 shared files in `lib/` and `components/dashboard/`.

- [ ] **Helpers** (`lib/dashboard-helpers.ts`):
  - `bucketFloat(v: number, hi = 0.66, mid = 0.33): "low" | "medium" | "high"`.
  - `confidencePercent(c: Confidence): number` returns `Math.round(c.score * 100)`.
  - Re-export the `Confidence` / `EvidenceRef` / `SignalType` types (import from a place TBD — for now from `web/src/api/report-sections.ts` once we widen its `Sections` type; for Phase 5b just define local types matching doc-16).

- [ ] **`<ConfidenceIndicator confidence={...}>`** — colored badge ("low" amber / "medium" blue / "high" green) showing the score percent + tooltip with `basis`.

- [ ] **`<ScoreFactors factors={...}>`** — takes a fixed-key object `Record<string, number>`, renders ordered horizontal bars labelled by humanised key (`pain_frequency` → "Pain frequency"). No `tone` (per-factor color was a mock invention).

- [ ] **`<EvidenceDrawer open={...} refs={...} evidenceSection={...}>`** — given `evidence_refs` and the report's `EvidenceSection`, resolves and renders the linked quotes. If `evidenceSection` is missing or refs are empty, shows "Evidence not available for this insight."

- [ ] Tests for `bucketFloat` (boundary cases) + smoke render tests for the three components.

- [ ] **tsc + tests pass.** Commit.

---

## Task G2 — Founder adapter

**File:** Create `lib/dashboard-adapters/founder.ts` + `.test.ts`.

Map doc-16 `FounderViewSection` → the founder page's component-input shape. Apply the audit's findings:
- Type coercions: `severity 0..1` → mock string is dropped (UI now reads float and buckets via `bucketFloat`).
- Renames: `summary`→`explanation` on strengths, `target_segment`→`target`, `core_pain`→`pain`, `positioning_promise`→`promise`/`title`, `why_this_wedge_exists`→`why`, `risk_title`→`title`, `mitigation`→`recommendation`.
- Actions: destructure `recommended_product_move`/`recommended_positioning_move`/`recommended_growth_move` into a 3-item array with `kind: "product"|"positioning"|"growth"`.
- Drop: `delta`, `wedge.evidence.{mentions,threads,sources}`, `actions[].evidence`/`actions[].next`, inline quote/`who` on every item.
- Pricing: divide `pricing_pain_score` by 1 (keep 0..1; UI page must change to render 0..1, not `/100`).

- [ ] Adapter function `toFounderViewProps(section: FounderViewSection): FounderViewProps`. Export `FounderViewProps` type.
- [ ] Test the mapping with one fixture per insight type.
- [ ] tsc + tests. Commit.

---

## Task G3 — Product adapter

**File:** Create `lib/dashboard-adapters/product.ts` + `.test.ts`.

- Heatmap: aggregate `complaint_clusters_by_product_area[]` by `product_area` → one heatmap row per area with averaged `severity`, summed `frequency`, etc.
- `friction: enum` → derived from `impact 0..1` via `bucketFloat`.
- `loves[].rec` PascalCase → lowercase normalization (`"Match"`→`"match"`).
- Renames: `title`→`opportunity_title`, `problem`→`user_problem`, `feature`→`suggested_feature`, `why`→`why_now`, `loves[].why`→`why_users_love_it`, `loves[].lesson`→`product_lesson`, `workflow[].step`→`workflow_name`, `decisions.*[].evidence`→`evidence_count`.
- Drop: `score.insight`, `score.focus`, `score.coverage`, `gaps[].requirement`/`effort`/`risk`, `decisions.*[].quote`, `clusterCards[].trend`, `roadmap[].impact` enum.

- [ ] Adapter function + props type + tests + commit.

---

## Task G4 — Marketing adapter

**File:** Create `lib/dashboard-adapters/marketing.ts` + `.test.ts`.

- Score factors: object → array of `{key, value}` (no `tone`/`note`).
- `bestAngle` (mock hero): derive at runtime from `positioning_angles[0]` sorted by `confidence.score` desc.
- `language.*[]`: include all 5 sub-arrays (`positive_phrases`, `negative_phrases`, `alternative_seeking_phrases`, `emotional_adjectives`, `category_language`) — UI must render two new tabs.
- `objections[].frequency` (0..1) ← contract's integer cast: actually contract is integer; UI uses 0..1 float bar. Convert integer to a normalized share (`frequency / max(frequencies)`).
- `quoteLib[].signals[]` array → `signal_type` single enum (drop multi-signal mock model).
- Renames per the audit table (35 trivial+medium).
- Drop: `score.coverage`, `quoteLib[].score` upvote int, `bestAngle.{evidence,sources,confidence}` ad-hoc fields, `comparison.chooseThem[]`.

- [ ] Adapter + props + tests + commit.

---

## Task G5 — Growth adapter

**File:** Create `lib/dashboard-adapters/growth.ts` + `.test.ts`.

- `intent_score 0..1` → multiply by 100 for UI's 0–100 scale.
- `intent_type` enum normalization (`"alternative-seeking"`→`"looking_for_alternative"` etc.).
- `urgency: "research"`→`"research_only"`.
- `engagement_level` enum → drop raw upvote/comment integers entirely (UI badge becomes the enum).
- `source_date` (ISO) → `formatRelative(date)` for the "3h ago" string.
- `budget_sensitivity`/`technical_maturity` enum normalization (`"Tight"`→`"high"`, `"Mid"`→`"medium"`).
- `topOpportunity` mock object → derive from `switch_intent_feed[0]` sorted by `intent_score` desc.
- `replyAngles[].related_conversation_id`: keep, used by UI to highlight linked feed cards.
- Drop: `trends[]`, `score.weeklyDelta`, `feed[].doNot`/`feed[].angle` inline panels (moved to reply angles section), `pricingLeads[].quote`, `segmentHints[].who`.

- [ ] Adapter + props + tests + commit.

---

## Tasks G6 — G9: Per-page refactors

Each page (`founder.tsx`/`product.tsx`/`marketing.tsx`/`growth.tsx`):

1. Add prop `data?: <Role>ViewProps` (the adapter output). Use it when provided; fall back to existing mock when undefined.
2. Replace inline-quote rendering with `<EvidenceDrawer>` triggered by an "Evidence" button that passes `evidence_refs`.
3. Replace `score.factors[].map(f => <Bar>)` with `<ScoreFactors factors={section.score.factors}>`.
4. Replace `<Confidence>{Math.round(x*100)}%</Confidence>` with `<ConfidenceIndicator confidence={obj}>`.
5. Replace enum string comparisons (`f.severity === "high"`) with `bucketFloat(f.severity)` calls.
6. Delete mock-only widgets (per the dropped list in the plan header).

Each is its own task (G6 founder / G7 product / G8 marketing / G9 growth). Run in parallel — disjoint files.

- [ ] Per page: tsc clean, route still loads with mock data (open in browser if possible).

---

## Task G10 — `scan-report.tsx` becomes the live parent

- Route at `/scan-report/:id`.
- `useReportSectionsQuery(id)`.
- Run all 4 adapters once.
- Pass adapter output to each embedded `<FounderPage data={founderProps}>` etc.
- Loading / error states match Phase 5 MVP.
- Keep `/scan-report` (no id) showing the mock demo unchanged.

- [ ] tsc clean.

---

## Task G11 — Verification

- [ ] `pnpm type-check` clean across workspace.
- [ ] `cd packages/web && pnpm build` succeeds.
- [ ] Live: navigate to `/scan-report/<completed-report-id>`, confirm each lens renders real data, evidence drawer resolves quotes from `EvidenceSection`, no `NaN%` anywhere, no empty platform-coverage chips (the chips render only at the overview section, not per-role).

---

## Acceptance criteria

- [ ] `/scan-report/:id` renders all four role lenses with live data from `GET /v1/reports/:id/sections`.
- [ ] Every confidence in every dashboard is rendered as `<ConfidenceIndicator>` showing label + percent + basis tooltip.
- [ ] Every severity/friction/urgency badge in every dashboard is bucketed from the contract's 0..1 float, not a mock enum string.
- [ ] Every evidence drawer resolves quotes from `EvidenceSection.quotes` by `quote_ids` — no inline quotes anywhere on insight cards.
- [ ] No mock-only fabrication widgets remain (no `trends`, no `weeklyDelta`, no `delta`, no `score.insight`/`score.focus`, no inline `quote` on items).
- [ ] `pnpm type-check` clean.
