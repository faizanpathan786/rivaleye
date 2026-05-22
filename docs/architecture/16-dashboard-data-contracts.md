# 16 — Dashboard Data Contracts

**Status:** Design proposal — companion to `15-signal-centric-pipeline-redesign.md`. Not yet approved, not implemented.
**Date:** 2026-05-22
**Purpose:** The exact, frontend-ready data contract for the six dashboard sections RivalEye's Stage D emits. This document is **normative** — Stage D output and the `report_role_sections.data` JSONB must validate against these Zod schemas. Doc 15 explains *why* the pipeline becomes signal-centric; this doc defines *exactly what* each role dashboard receives.

---

## How to read this document

- Six sections, one per `report_role_sections.section_type`: **Overview, Founder, Product, Marketing, Growth, Evidence**.
- Each section gives: purpose, the full Zod schema, a field contract table, and frontend component suggestions.
- **Every dashboard insight references evidence.** No insight may render without `evidence_refs`. Where evidence is weak, `confidence` must say so — never fake certainty.
- All field names are `snake_case`. All schemas export a `z.infer` type. Arrays default to `[]`; optional scalars are `.nullable()`.

## Shared primitives

Every section imports these from a shared module (proposed home: `packages/shared/src/dashboard/primitives.ts`). They are defined **once** here and never redefined inside a section schema.

```typescript
import { z } from "zod";

export const signalTypeSchema = z.enum([
  "love", "pain", "gap", "switch", "pricing", "feature", "positioning",
]);
export type SignalType = z.infer<typeof signalTypeSchema>;

export const roleSchema = z.enum(["founder", "product", "marketing", "growth"]);
export type Role = z.infer<typeof roleSchema>;

/**
 * A reference from a dashboard insight back to its grounding evidence.
 *  - signal_ids  → Stage C signal cluster ids
 *  - quote_ids   → ids into EvidenceSection.quotes
 *  - source_urls → raw source post/page URLs
 * At least one of the three must be non-empty for any insight that makes a claim.
 */
export const evidenceRefSchema = z.object({
  signal_ids: z.array(z.string()).default([]),
  quote_ids: z.array(z.string()).default([]),
  source_urls: z.array(z.string()).default([]),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/** Confidence attached to any insight. Never fake certainty. */
export const confidenceSchema = z.object({
  score: z.number().min(0).max(1),
  label: z.enum(["low", "medium", "high"]),
  basis: z.string().nullable().default(null),
});
export type Confidence = z.infer<typeof confidenceSchema>;
```

## Section index

| `section_type` | Root schema | ICP question |
|---|---|---|
| `overview` | `overviewSectionSchema` | "What's the overall picture — and can I trust it?" |
| `founder` | `founderViewSectionSchema` | "Where is the market opportunity?" |
| `product` | `productViewSectionSchema` | "What should we build or prioritize?" |
| `marketing` | `marketingViewSectionSchema` | "What should we say?" |
| `growth` | `growthViewSectionSchema` | "Where is intent, and how do we engage?" |
| `evidence` | `evidenceSectionSchema` | "Show me the proof behind every claim." |

## A note on per-section opportunity scores

Several sections define a `*_score` widget shaped `{ score: 0..100, label, explanation, factors }`. The `factors` keys differ per section because each score weights different signals — so each section declares its own score schema with explicit factor keys. This is intentional, not drift.

## Persistence

Each section below is stored as one row in `report_role_sections` (`section_type` = the section name, `data` = the section's JSON), per `15-signal-centric-pipeline-redesign.md` §8.2.


---

## OverviewSection

The `OverviewSection` is the universal entry point for every RivalEye report. It answers the question: *"What is the overall picture of how real users perceive this competitor — and how much should I trust it?"* It is shown to all four ICPs (founder, product, marketing, growth) and contains no role-specific framing. Its job is to establish evidence quality, surface the single strongest signal in each quadrant (love / pain / gap / switch), and point the reader toward the one opportunity that deserves immediate attention.

```typescript
import { z } from "zod";
// Shared primitives (evidenceRefSchema, confidenceSchema, signalTypeSchema, roleSchema)
// are imported — NOT redefined here.

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * A single dominant signal snapshot used for the top_love / top_pain /
 * top_gap / top_switch fields. Carries just enough for the snapshot widget
 * without duplicating the full signal object.
 */
export const topSignalSnapshotSchema = z.object({
  /** Short human-readable title, e.g. "Pricing too complex" */
  title: z.string(),
  /** One-sentence summary of the signal cluster. */
  summary: z.string(),
  /**
   * Relative strength of this signal cluster within its type bucket.
   * 0–1; derived from mention frequency + sentiment weight.
   */
  strength: z.number().min(0).max(1),
  /**
   * Raw mention count that backs this signal. Null when the platform
   * returned results but exact counts are unavailable.
   */
  mention_count: z.number().int().nonnegative().nullable().default(null),
  /** Signal type tag — always matches the bucket this snapshot lives in. */
  signal_type: signalTypeSchema,
  evidence_refs: evidenceRefSchema,
});

export type TopSignalSnapshot = z.infer<typeof topSignalSnapshotSchema>;

/**
 * Per-platform coverage descriptor for the source_coverage card.
 */
export const platformCoverageSchema = z.object({
  /** Canonical platform identifier, e.g. "reddit", "g2", "app_store". */
  platform: z.string(),
  /** Number of posts / reviews / threads collected from this platform. */
  mention_count: z.number().int().nonnegative(),
  /**
   * 0–1 coverage quality for this platform: accounts for date range,
   * volume relative to expected baseline, and API completeness.
   */
  coverage_score: z.number().min(0).max(1),
  /**
   * ISO-8601 date of the oldest piece of content included. Null if unknown.
   */
  oldest_content_date: z.string().nullable().default(null),
  /**
   * ISO-8601 date of the newest piece of content included. Null if unknown.
   */
  newest_content_date: z.string().nullable().default(null),
  /** True when the platform was requested but returned zero usable results. */
  empty: z.boolean().default(false),
});

export type PlatformCoverage = z.infer<typeof platformCoverageSchema>;

/**
 * The single strongest cross-signal opportunity surfaced for all ICPs.
 */
export const strongestOpportunitySchema = z.object({
  /** Short headline, ≤ 80 chars. */
  headline: z.string().max(80),
  /** 2–3 sentence elaboration of why this opportunity is significant. */
  rationale: z.string(),
  /**
   * Which signal types contributed to this opportunity.
   * At least one element required.
   */
  contributing_signal_types: z.array(signalTypeSchema).min(1),
  /** Relevant to all ICPs by definition; tagged here for transparency. */
  relevant_roles: z.array(roleSchema).min(1),
  evidence_refs: evidenceRefSchema,
  confidence: confidenceSchema,
});

export type StrongestOpportunity = z.infer<typeof strongestOpportunitySchema>;

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

export const overviewSectionSchema = z.object({
  /**
   * 2–4 sentence narrative synthesis of overall competitor user perception.
   * Written in plain English for the summary card header.
   */
  overall_perception_summary: z.string(),

  /**
   * Ordered list of platform identifiers that were included in this report,
   * e.g. ["reddit", "g2", "app_store", "product_hunt"].
   */
  sources_scanned: z.array(z.string()).default([]),

  /**
   * Total number of posts / reviews / comments ingested across all platforms
   * before deduplication and filtering. Null if the pipeline did not emit a
   * reliable count.
   */
  total_mentions: z.number().int().nonnegative().nullable().default(null),

  /**
   * The single highest-strength signal cluster of type "love".
   * Null when no love signals were found.
   */
  top_love_signal: topSignalSnapshotSchema.nullable().default(null),

  /**
   * The single highest-strength signal cluster of type "pain".
   * Null when no pain signals were found.
   */
  top_pain_signal: topSignalSnapshotSchema.nullable().default(null),

  /**
   * The single highest-strength signal cluster of type "gap".
   * Null when no gap signals were found.
   */
  top_gap_signal: topSignalSnapshotSchema.nullable().default(null),

  /**
   * The single highest-strength signal cluster of type "switch".
   * Null when no switching signals were found.
   */
  top_switch_signal: topSignalSnapshotSchema.nullable().default(null),

  /**
   * The single cross-signal opportunity most worth acting on immediately.
   * Null when confidence is too low to surface a reliable opportunity.
   */
  strongest_opportunity: strongestOpportunitySchema.nullable().default(null),

  /**
   * Aggregate confidence in the overview section as a whole.
   * Derived from: total_mentions, coverage_score across platforms,
   * and signal diversity. Never inflated.
   */
  confidence_score: confidenceSchema,

  /**
   * Per-platform coverage breakdown for the source coverage card.
   */
  source_coverage: z.array(platformCoverageSchema).default([]),

  /**
   * Plain-English statements of what this report CANNOT determine
   * given the data available. Always present; empty array means the
   * pipeline found no material gaps (rare).
   * Examples:
   *   "Twitter/X data unavailable — API access not configured."
   *   "Only 12 Reddit mentions found; pain rankings may not be representative."
   */
  report_limitations: z.array(z.string()).default([]),
});

export type OverviewSection = z.infer<typeof overviewSectionSchema>;
```

---

### Field Contract Table

| Field | Type | Required | Example | Source signal types | Evidence required | Frontend component |
|---|---|---|---|---|---|---|
| `overall_perception_summary` | `string` | Yes | `"Users appreciate Notion's flexibility but consistently cite a steep learning curve and sluggish performance on large workspaces."` | all | No (narrative) | `<PerceptionSummaryCard>` |
| `sources_scanned` | `string[]` | Yes | `["reddit","g2","app_store","product_hunt"]` | — | No | `<SourceCoverageCard>` |
| `total_mentions` | `number \| null` | Yes (nullable) | `1842` | — | No | `<ReportSummaryCard>` |
| `top_love_signal` | `TopSignalSnapshot \| null` | Yes (nullable) | `{ title: "Flexible templates", strength: 0.82, mention_count: 340, signal_type: "love", ... }` | `love` | Yes — `evidence_refs` on the snapshot | `<SignalQuadrantSnapshot>` |
| `top_pain_signal` | `TopSignalSnapshot \| null` | Yes (nullable) | `{ title: "Performance on large pages", strength: 0.91, mention_count: 512, signal_type: "pain", ... }` | `pain` | Yes | `<SignalQuadrantSnapshot>` |
| `top_gap_signal` | `TopSignalSnapshot \| null` | Yes (nullable) | `{ title: "No native Gantt view", strength: 0.74, mention_count: 210, signal_type: "gap", ... }` | `gap` | Yes | `<SignalQuadrantSnapshot>` |
| `top_switch_signal` | `TopSignalSnapshot \| null` | Yes (nullable) | `{ title: "Switching to Linear for engineering", strength: 0.65, mention_count: 88, signal_type: "switch", ... }` | `switch` | Yes | `<SignalQuadrantSnapshot>` |
| `strongest_opportunity` | `StrongestOpportunity \| null` | Yes (nullable) | `{ headline: "Fast, opinionated Gantt for technical teams", contributing_signal_types: ["gap","switch"], ... }` | `gap`, `switch`, `pain`, `pricing` | Yes — `evidence_refs` + `confidence` on the opportunity object | `<OpportunityCard>` |
| `confidence_score` | `Confidence` | Yes | `{ score: 0.71, label: "medium", basis: "1 842 mentions across 4 platforms, 60-day window" }` | — | No (meta) | `<ConfidenceIndicator>` |
| `source_coverage` | `PlatformCoverage[]` | Yes | `[{ platform: "reddit", mention_count: 920, coverage_score: 0.85, oldest_content_date: "2024-01-10", newest_content_date: "2025-05-01", empty: false }]` | — | No | `<SourceCoverageCard>` |
| `report_limitations` | `string[]` | Yes | `["Twitter/X data unavailable — API access not configured.", "Only 12 G2 reviews found; ratings may not be representative."]` | — | No | `<ReportLimitationsBanner>` |

---

### Frontend Widgets

- **Report summary card** → `<ReportSummaryCard>` — renders `overall_perception_summary`, `sources_scanned`, `total_mentions`.
- **Source coverage card** → `<SourceCoverageCard>` — renders `source_coverage` as a platform grid with per-platform mention count and a coverage score bar; also lists `sources_scanned` for platforms with zero results.
- **Love / Pain / Gap / Switch snapshot** → `<SignalQuadrantSnapshot>` — four-panel grid, one per `top_*_signal`; each panel shows `title`, `summary`, `strength` (visual bar), `mention_count`, and a "see evidence" link using `evidence_refs`.
- **Strongest opportunity card** → `<OpportunityCard>` — headline + rationale + contributing signal type chips + `<ConfidenceIndicator>` inline.
- **Confidence indicator** → `<ConfidenceIndicator>` — renders `confidence_score.label` as a colour-coded badge (low = amber, medium = blue, high = green) with `score` percentage and `basis` tooltip.
- **Report limitations banner** → `<ReportLimitationsBanner>` — dismissible banner listing each string in `report_limitations`; hidden when the array is empty.


---

## FounderViewSection

The `FounderViewSection` answers the question **"Where is the market opportunity?"** It is the strategic entry point of the RivalEye dashboard, scoped to founders who need to make go/no-go, wedge, and positioning decisions fast. Every field is grounded in evidence from the signal pipeline — no assertion is made without traceable source signals or quotes. When evidence is thin, confidence is surfaced explicitly so a founder is never misled by false certainty.

```typescript
import { z } from "zod";
import {
  signalTypeSchema,
  roleSchema,
  evidenceRefSchema,
  confidenceSchema,
} from "@rivaleye/shared";

// ─── Opportunity Score ────────────────────────────────────────────────────────
// Numeric factors are all 0..1 (signal-derived weights); score is 0..100.
export const opportunityScoreSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string(),
  explanation: z.string(),
  factors: z.object({
    pain_frequency: z.number().min(0).max(1),
    gap_severity: z.number().min(0).max(1),
    switch_intent: z.number().min(0).max(1),
    competitor_love_strength: z.number().min(0).max(1),
    pricing_pain: z.number().min(0).max(1),
    source_confidence: z.number().min(0).max(1),
  }),
});
export type OpportunityScore = z.infer<typeof opportunityScoreSchema>;

// ─── Market Opening Summary ───────────────────────────────────────────────────
export const marketOpeningSummarySchema = z.object({
  summary: z.string(),
  target_segment: z.string(),
  main_opportunity: z.string(),
  why_now: z.string(),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type MarketOpeningSummary = z.infer<typeof marketOpeningSummarySchema>;

// ─── Strength to Respect ──────────────────────────────────────────────────────
export const strengthItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  why_users_love_it: z.string(),
  strategic_implication: z.string(),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type StrengthItem = z.infer<typeof strengthItemSchema>;

// ─── Weakness to Attack ───────────────────────────────────────────────────────
// severity and frequency are numeric 0..1 (continuous signal weights are more
// informative than discrete enums at this granularity).
export const weaknessItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  severity: z.number().min(0).max(1),
  frequency: z.number().min(0).max(1),
  opportunity_implication: z.string(),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type WeaknessItem = z.infer<typeof weaknessItemSchema>;

// ─── Unmet Need ───────────────────────────────────────────────────────────────
// opportunity_level: enum — "low" | "medium" | "high" — chosen because the
// frontend renders this as a badge, not a progress bar, and three tiers are
// semantically clearer than a raw float for founders.
// source_spread: integer count of distinct platforms the need was observed on.
export const unmetNeedItemSchema = z.object({
  need: z.string(),
  user_segment: z.string(),
  frequency: z.number().min(0).max(1),
  source_spread: z.number().int().min(0),
  opportunity_level: z.enum(["low", "medium", "high"]),
  evidence_refs: evidenceRefSchema,
});
export type UnmetNeedItem = z.infer<typeof unmetNeedItemSchema>;

// ─── Wedge Recommendation ─────────────────────────────────────────────────────
// evidence_strength and risk_level: enum — "low" | "medium" | "high" — chosen
// for the same badge-rendering reason as opportunity_level; a founder reading
// "high risk" acts differently than reading "0.78".
export const wedgeRecommendationSchema = z.object({
  target_segment: z.string(),
  core_pain: z.string(),
  positioning_promise: z.string(),
  why_this_wedge_exists: z.string(),
  evidence_strength: z.enum(["low", "medium", "high"]),
  risk_level: z.enum(["low", "medium", "high"]),
  evidence_refs: evidenceRefSchema,
});
export type WedgeRecommendation = z.infer<typeof wedgeRecommendationSchema>;

// ─── Pricing Opportunity ──────────────────────────────────────────────────────
// pricing_pain_score: numeric 0..1 — continuous, matches factor-weight style
// used elsewhere; frontend maps to a score ring.
export const pricingOpportunitySchema = z.object({
  pricing_pain_score: z.number().min(0).max(1),
  main_pricing_complaint: z.string(),
  affected_segment: z.string(),
  suggested_pricing_angle: z.string(),
  risk_warning: z.string().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type PricingOpportunity = z.infer<typeof pricingOpportunitySchema>;

// ─── Strategic Risk ───────────────────────────────────────────────────────────
// severity: numeric 0..1 — continuous so the list can be sorted by severity
// and rendered with a proportional indicator.
export const strategicRiskItemSchema = z.object({
  risk_title: z.string(),
  explanation: z.string(),
  why_it_matters: z.string(),
  mitigation: z.string(),
  severity: z.number().min(0).max(1),
  evidence_refs: evidenceRefSchema,
});
export type StrategicRiskItem = z.infer<typeof strategicRiskItemSchema>;

// ─── Founder Action Plan — individual move ───────────────────────────────────
export const founderMoveSchema = z.object({
  recommendation: z.string(),
  why: z.string(),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type FounderMove = z.infer<typeof founderMoveSchema>;

// ─── Section root ─────────────────────────────────────────────────────────────
export const founderViewSectionSchema = z.object({
  // Widget 1
  opportunity_score: opportunityScoreSchema,

  // Widget 2
  market_opening_summary: marketOpeningSummarySchema,

  // Widget 3
  strengths_to_respect: z.array(strengthItemSchema).default([]),

  // Widget 4
  weaknesses_to_attack: z.array(weaknessItemSchema).default([]),

  // Widget 5
  unmet_needs: z.array(unmetNeedItemSchema).default([]),

  // Widget 6
  wedge_recommendation: wedgeRecommendationSchema,

  // Widget 7
  pricing_opportunity: pricingOpportunitySchema,

  // Widget 8
  strategic_risks: z.array(strategicRiskItemSchema).default([]),

  // Widget 9 — three moves, one per discipline
  recommended_product_move: founderMoveSchema,
  recommended_positioning_move: founderMoveSchema,
  recommended_growth_move: founderMoveSchema,

  // Top-level evidence rollup for the entire section
  evidence_refs: evidenceRefSchema,
});

export type FounderViewSection = z.infer<typeof founderViewSectionSchema>;
```

---

## Field Contract Table

| Field | Type | Required | Example | Source signal types | Evidence required | Frontend component |
|---|---|---|---|---|---|---|
| `opportunity_score` | `OpportunityScore` | yes | `{ score: 74, label: "Strong opening", explanation: "High pain + low love = actionable gap", factors: { pain_frequency: 0.81, gap_severity: 0.72, switch_intent: 0.60, competitor_love_strength: 0.35, pricing_pain: 0.68, source_confidence: 0.75 } }` | pain, gap, switch, pricing | implicit — factors derived from signal corpus | `OpportunityScoreWidget` |
| `market_opening_summary.summary` | `string` | yes | `"Notion's users love the flexibility but churn on reliability; a focused, opinionated tool for ops teams has room."` | all | `confidence`, `evidence_refs` | `MarketOpeningCard` |
| `market_opening_summary.target_segment` | `string` | yes | `"Ops leads at 10–50-person B2B SaaS teams"` | gap, pain | `evidence_refs` | `MarketOpeningCard` |
| `market_opening_summary.main_opportunity` | `string` | yes | `"Reliability + opinionated structure where Notion requires heavy setup"` | gap, pain | `evidence_refs` | `MarketOpeningCard` |
| `market_opening_summary.why_now` | `string` | yes | `"Post-layoffs ops teams are leaner; setup overhead is now a dealbreaker"` | switch | `evidence_refs` | `MarketOpeningCard` |
| `market_opening_summary.confidence` | `Confidence` | yes | `{ score: 0.71, label: "medium", basis: "68 signals across 3 platforms" }` | — | signal volume | `MarketOpeningCard` |
| `strengths_to_respect[n].title` | `string` | yes | `"Best-in-class template library"` | love | `evidence_refs` | `StrengthsCarousel` |
| `strengths_to_respect[n].why_users_love_it` | `string` | yes | `"Users cite hours saved on project kick-off"` | love | `evidence_refs` | `StrengthsCarousel` |
| `strengths_to_respect[n].strategic_implication` | `string` | yes | `"Competing head-on on templates will fail; differentiate on outcome speed"` | love, positioning | `evidence_refs` | `StrengthsCarousel` |
| `weaknesses_to_attack[n].severity` | `number` 0..1 | yes | `0.84` | pain, switch | `evidence_refs` | `WeaknessAttackList` |
| `weaknesses_to_attack[n].frequency` | `number` 0..1 | yes | `0.67` | pain | `evidence_refs` | `WeaknessAttackList` |
| `weaknesses_to_attack[n].opportunity_implication` | `string` | yes | `"Users actively search for alternatives after third reliability incident"` | switch, pain | `evidence_refs` | `WeaknessAttackList` |
| `unmet_needs[n].need` | `string` | yes | `"Automated status roll-up without Zapier"` | gap, feature | `evidence_refs` | `UnmetNeedsTable` |
| `unmet_needs[n].source_spread` | `integer` | yes | `4` (Reddit + G2 + PH + AppStore) | gap | `evidence_refs` | `UnmetNeedsTable` |
| `unmet_needs[n].opportunity_level` | `"low"\|"medium"\|"high"` | yes | `"high"` | gap | `evidence_refs` | `UnmetNeedsTable` |
| `wedge_recommendation.positioning_promise` | `string` | yes | `"The ops workspace that actually works the first week"` | gap, pain, positioning | `evidence_refs` | `WedgeCard` |
| `wedge_recommendation.evidence_strength` | `"low"\|"medium"\|"high"` | yes | `"high"` | all | `evidence_refs` | `WedgeCard` |
| `wedge_recommendation.risk_level` | `"low"\|"medium"\|"high"` | yes | `"medium"` | switch | `evidence_refs` | `WedgeCard` |
| `pricing_opportunity.pricing_pain_score` | `number` 0..1 | yes | `0.73` | pricing | `evidence_refs` | `PricingOpportunityCard` |
| `pricing_opportunity.suggested_pricing_angle` | `string` | yes | `"Flat-rate for up to 15 seats — remove the per-seat anxiety"` | pricing | `evidence_refs` | `PricingOpportunityCard` |
| `pricing_opportunity.risk_warning` | `string\|null` | no | `"Flat-rate may cap ARR at seed stage"` | pricing | optional | `PricingOpportunityCard` |
| `strategic_risks[n].severity` | `number` 0..1 | yes | `0.79` | switch, love | `evidence_refs` | `StrategicRisksList` |
| `strategic_risks[n].mitigation` | `string` | yes | `"Build migration tooling on day-one; reduce switching cost to under 30 min"` | switch | `evidence_refs` | `StrategicRisksList` |
| `recommended_product_move.recommendation` | `string` | yes | `"Ship a reliability SLA dashboard before any new features"` | pain, gap | `evidence_refs` | `FounderActionPlan` |
| `recommended_positioning_move.recommendation` | `string` | yes | `"Lead with 'works out of the box for ops' in all landing copy"` | positioning, gap | `evidence_refs` | `FounderActionPlan` |
| `recommended_growth_move.recommendation` | `string` | yes | `"Target Notion-alternatives subreddits with comparison content"` | switch, pain | `evidence_refs` | `FounderActionPlan` |
| `evidence_refs` (section root) | `EvidenceRef` | yes | `{ signal_ids: ["sig_001","sig_047"], quote_ids: ["q_12"], source_urls: [] }` | all | rollup of all child refs | (metadata only — not rendered directly) |

---

## Frontend Widgets

1. **Widget 1 — Opportunity Score** → `OpportunityScoreWidget` — Radial gauge (0–100) with a spider/radar mini-chart for the six factors.
2. **Widget 2 — Market Opening Summary** → `MarketOpeningCard` — Headline card with target segment pill, main opportunity prose, and a "Why now" callout box; confidence badge in the corner.
3. **Widget 3 — Strengths to Respect** → `StrengthsCarousel` — Horizontally scrollable cards; each card shows title, love summary, and strategic implication in a muted palette (these are things to respect, not celebrate).
4. **Widget 4 — Weaknesses to Attack** → `WeaknessAttackList` — Sortable table/list; severity and frequency rendered as inline progress bars; opportunity implication as a callout line.
5. **Widget 5 — Unmet Needs** → `UnmetNeedsTable` — Tabular view with columns: Need, Segment, Frequency bar, Source Spread count, Opportunity badge (low/medium/high).
6. **Widget 6 — Wedge Recommendation** → `WedgeCard` — Single prominent card; positioning promise in large type; evidence strength and risk level as adjacent badges; why-this-wedge as expandable prose.
7. **Widget 7 — Pricing Opportunity** → `PricingOpportunityCard` — Score ring + main complaint quote + suggested angle text; risk warning shown as amber alert strip when non-null.
8. **Widget 8 — Strategic Risks** → `StrategicRisksList` — Accordion list sorted by severity descending; each row expands to show explanation, why-it-matters, and mitigation.
9. **Widget 9 — Founder Action Plan** → `FounderActionPlan` — Three-column layout (Product / Positioning / Growth); each column shows recommendation, why, and confidence badge; clicking a column expands evidence refs.


---

## ProductViewSection

**Purpose:** The ProductViewSection answers the question *"What should we build or prioritize?"* It surfaces evidence-backed signals that a product owner can act on directly — exposing gaps in the competitor's feature set, clusters of user complaints mapped to product areas, workflows that create friction, features users genuinely love (and why), and concrete roadmap candidates ranked by urgency and confidence. Every insight is evidence-grounded and carries an explicit confidence score; if the signal corpus is thin, scores are low and stated as such. No inference is fabricated.

```typescript
import { z } from "zod";
import {
  signalTypeSchema,
  roleSchema,
  evidenceRefSchema,
  confidenceSchema,
} from "./shared-primitives";

// ──────────────────────────────────────────────
// 1. Product Opportunity Score
// ──────────────────────────────────────────────
// factors are 0..1 intensity weights derived from signal corpus
export const productOpportunityScoreSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string(),
  explanation: z.string(),
  factors: z.object({
    feature_gap_frequency: z.number().min(0).max(1),   // 0..1 normalised rate of gap signals
    pain_severity: z.number().min(0).max(1),           // 0..1 aggregate severity of pain signals
    source_spread: z.number().min(0).max(1),           // 0..1 fraction of ingested platforms with evidence
    user_urgency: z.number().min(0).max(1),            // 0..1 proxy from switching/churn signal density
    competitor_love_strength: z.number().min(0).max(1),// 0..1 inverse: high love → lower opportunity
  }),
});
export type ProductOpportunityScore = z.infer<typeof productOpportunityScoreSchema>;

// ──────────────────────────────────────────────
// 2. Feature Gap Map
// ──────────────────────────────────────────────
// mentions: integer count of posts/comments referencing the gap
// severity: 0..1 intensity of user frustration about the gap
export const featureGapItemSchema = z.object({
  feature_gap: z.string(),
  summary: z.string(),
  mentions: z.number().int().min(0),                   // count of raw signal references
  sources: z.array(z.string()).default([]),             // platform names e.g. ["reddit","g2"]
  severity: z.number().min(0).max(1),                  // 0..1 intensity
  confidence: confidenceSchema,
  user_segment: z.string().nullable().default(null),   // e.g. "enterprise admins"
  suggested_action: z.string().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type FeatureGapItem = z.infer<typeof featureGapItemSchema>;

export const featureGapMapSchema = z.array(featureGapItemSchema).default([]);
export type FeatureGapMap = z.infer<typeof featureGapMapSchema>;

// ──────────────────────────────────────────────
// 3. Complaint Clusters by Product Area
// ──────────────────────────────────────────────
// frequency: integer count of distinct posts/comments in cluster
// severity: 0..1 intensity
// source_spread: 0..1 fraction of platforms where cluster appears
// impact_on_workflow: 0..1 inferred disruption level
export const productAreaSchema = z.enum([
  "onboarding",
  "performance",
  "ux_navigation",
  "collaboration",
  "permissions",
  "integrations",
  "reporting_analytics",
  "pricing_packaging",
  "support_reliability",
]);
export type ProductArea = z.infer<typeof productAreaSchema>;

export const complaintClusterItemSchema = z.object({
  product_area: productAreaSchema,
  complaint_title: z.string(),
  summary: z.string(),
  frequency: z.number().int().min(0),                  // count
  severity: z.number().min(0).max(1),                  // 0..1 intensity
  source_spread: z.number().min(0).max(1),             // 0..1 fraction of platforms
  impact_on_workflow: z.number().min(0).max(1),        // 0..1 disruption intensity
  suggested_product_response: z.string().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type ComplaintClusterItem = z.infer<typeof complaintClusterItemSchema>;

export const complaintClustersByProductAreaSchema = z.array(complaintClusterItemSchema).default([]);
export type ComplaintClustersByProductArea = z.infer<typeof complaintClustersByProductAreaSchema>;

// ──────────────────────────────────────────────
// 4. Loved Competitor Features
// ──────────────────────────────────────────────
// positive_mentions: integer count
// stickiness_level: 0..1 — how deeply embedded in user workflow
export const recommendationSchema = z.enum(["learn", "match", "differentiate", "ignore"]);
export type Recommendation = z.infer<typeof recommendationSchema>;

export const lovedCompetitorFeatureItemSchema = z.object({
  feature_name: z.string(),
  why_users_love_it: z.string(),
  positive_mentions: z.number().int().min(0),          // count
  stickiness_level: z.number().min(0).max(1),          // 0..1 intensity
  recommendation: recommendationSchema,
  product_lesson: z.string().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type LovedCompetitorFeatureItem = z.infer<typeof lovedCompetitorFeatureItemSchema>;

export const lovedCompetitorFeaturesSchema = z.array(lovedCompetitorFeatureItemSchema).default([]);
export type LovedCompetitorFeatures = z.infer<typeof lovedCompetitorFeaturesSchema>;

// ──────────────────────────────────────────────
// 5. Workflow Friction
// ──────────────────────────────────────────────
// frequency: integer count of posts describing this friction
// impact: 0..1 intensity of workflow disruption
export const workflowFrictionItemSchema = z.object({
  workflow_name: z.string(),
  friction_point: z.string(),
  impact: z.number().min(0).max(1),                    // 0..1 intensity
  frequency: z.number().int().min(0),                  // count
  affected_segment: z.string().nullable().default(null),
  suggested_improvement: z.string().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type WorkflowFrictionItem = z.infer<typeof workflowFrictionItemSchema>;

export const workflowFrictionSchema = z.array(workflowFrictionItemSchema).default([]);
export type WorkflowFriction = z.infer<typeof workflowFrictionSchema>;

// ──────────────────────────────────────────────
// 6. Roadmap Opportunities
// ──────────────────────────────────────────────
// expected_impact: 0..1 intensity of potential positive outcome
export const roadmapOpportunityItemSchema = z.object({
  opportunity_title: z.string(),
  user_problem: z.string(),
  suggested_feature: z.string(),
  expected_impact: z.number().min(0).max(1),           // 0..1 intensity
  effort_estimate: z.enum(["low", "medium", "high"]),
  confidence: confidenceSchema,
  why_now: z.string().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type RoadmapOpportunityItem = z.infer<typeof roadmapOpportunityItemSchema>;

export const roadmapOpportunitiesSchema = z.array(roadmapOpportunityItemSchema).default([]);
export type RoadmapOpportunities = z.infer<typeof roadmapOpportunitiesSchema>;

// ──────────────────────────────────────────────
// 7. Build / Avoid / Learn
// ──────────────────────────────────────────────
// evidence_count: integer count of signals supporting the item
export const buildAvoidLearnItemSchema = z.object({
  title: z.string(),
  reason: z.string(),
  evidence_count: z.number().int().min(0),             // count
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type BuildAvoidLearnItem = z.infer<typeof buildAvoidLearnItemSchema>;

export const buildAvoidLearnSchema = z.object({
  build: z.array(buildAvoidLearnItemSchema).default([]),
  avoid: z.array(buildAvoidLearnItemSchema).default([]),
  learn: z.array(buildAvoidLearnItemSchema).default([]),
});
export type BuildAvoidLearn = z.infer<typeof buildAvoidLearnSchema>;

// ──────────────────────────────────────────────
// Root: ProductViewSection
// ──────────────────────────────────────────────
export const productViewSectionSchema = z.object({
  product_opportunity_score: productOpportunityScoreSchema,
  feature_gap_map: featureGapMapSchema,
  complaint_clusters_by_product_area: complaintClustersByProductAreaSchema,
  loved_competitor_features: lovedCompetitorFeaturesSchema,
  workflow_friction: workflowFrictionSchema,
  roadmap_opportunities: roadmapOpportunitiesSchema,
  build_avoid_learn: buildAvoidLearnSchema,
  confidence_summary: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type ProductViewSection = z.infer<typeof productViewSectionSchema>;
```

### Field Contract Table

| Field | Type | Required | Example | Source signal types | Evidence required | Frontend component |
|---|---|---|---|---|---|---|
| `product_opportunity_score` | `ProductOpportunityScore` | Yes | `{ score: 74, label: "High", explanation: "3 high-severity gaps...", factors: { feature_gap_frequency: 0.8, ... } }` | gap, pain, switch | No (derived score) | `ProductOpportunityScoreGauge` |
| `product_opportunity_score.factors.feature_gap_frequency` | `number` 0..1 | Yes | `0.8` | gap | No | part of gauge |
| `product_opportunity_score.factors.pain_severity` | `number` 0..1 | Yes | `0.7` | pain | No | part of gauge |
| `product_opportunity_score.factors.source_spread` | `number` 0..1 | Yes | `0.6` | any | No | part of gauge |
| `product_opportunity_score.factors.user_urgency` | `number` 0..1 | Yes | `0.5` | switch, pain | No | part of gauge |
| `product_opportunity_score.factors.competitor_love_strength` | `number` 0..1 | Yes | `0.3` | love | No | part of gauge |
| `feature_gap_map` | `FeatureGapItem[]` | Yes (default `[]`) | `[{ feature_gap: "Bulk CSV export", mentions: 47, severity: 0.8, ... }]` | gap, feature | Yes — `signal_ids` + `quote_ids` | `FeatureGapTable` |
| `feature_gap_map[].feature_gap` | `string` | Yes | `"Bulk CSV export"` | gap | — | table cell |
| `feature_gap_map[].mentions` | `integer` ≥ 0 | Yes | `47` | gap | — | badge |
| `feature_gap_map[].severity` | `number` 0..1 | Yes | `0.8` | gap, pain | — | severity bar |
| `feature_gap_map[].sources` | `string[]` | Yes (default `[]`) | `["reddit","g2"]` | gap | — | platform pills |
| `feature_gap_map[].user_segment` | `string \| null` | No | `"enterprise admins"` | gap | — | label |
| `feature_gap_map[].confidence` | `Confidence` | Yes | `{ score: 0.7, label: "high", basis: "47 mentions across 3 platforms" }` | — | — | confidence chip |
| `complaint_clusters_by_product_area` | `ComplaintClusterItem[]` | Yes (default `[]`) | `[{ product_area: "onboarding", complaint_title: "Setup takes >2 hours", frequency: 63, ... }]` | pain | Yes — `signal_ids` | `ComplaintClusterHeatmap` |
| `complaint_clusters_by_product_area[].product_area` | `ProductArea` enum | Yes | `"onboarding"` | pain | — | area badge |
| `complaint_clusters_by_product_area[].frequency` | `integer` ≥ 0 | Yes | `63` | pain | — | count badge |
| `complaint_clusters_by_product_area[].severity` | `number` 0..1 | Yes | `0.75` | pain | — | intensity bar |
| `complaint_clusters_by_product_area[].source_spread` | `number` 0..1 | Yes | `0.5` | pain | — | spread indicator |
| `complaint_clusters_by_product_area[].impact_on_workflow` | `number` 0..1 | Yes | `0.9` | pain | — | impact bar |
| `loved_competitor_features` | `LovedCompetitorFeatureItem[]` | Yes (default `[]`) | `[{ feature_name: "One-click Jira sync", positive_mentions: 120, stickiness_level: 0.85, recommendation: "learn", ... }]` | love, feature | Yes — `quote_ids` | `LovedFeaturesGrid` |
| `loved_competitor_features[].positive_mentions` | `integer` ≥ 0 | Yes | `120` | love | — | count |
| `loved_competitor_features[].stickiness_level` | `number` 0..1 | Yes | `0.85` | love | — | stickiness bar |
| `loved_competitor_features[].recommendation` | `"learn"\|"match"\|"differentiate"\|"ignore"` | Yes | `"learn"` | love | — | recommendation chip |
| `workflow_friction` | `WorkflowFrictionItem[]` | Yes (default `[]`) | `[{ workflow_name: "Monthly reporting", friction_point: "No scheduled exports", impact: 0.7, frequency: 38, ... }]` | pain, gap | Yes — `signal_ids` | `WorkflowFrictionList` |
| `workflow_friction[].impact` | `number` 0..1 | Yes | `0.7` | pain | — | impact bar |
| `workflow_friction[].frequency` | `integer` ≥ 0 | Yes | `38` | pain | — | count badge |
| `roadmap_opportunities` | `RoadmapOpportunityItem[]` | Yes (default `[]`) | `[{ opportunity_title: "Scheduled report delivery", expected_impact: 0.8, effort_estimate: "medium", ... }]` | gap, pain, switch | Yes — `signal_ids` + `source_urls` | `RoadmapOpportunityCards` |
| `roadmap_opportunities[].expected_impact` | `number` 0..1 | Yes | `0.8` | gap, pain | — | impact score |
| `roadmap_opportunities[].effort_estimate` | `"low"\|"medium"\|"high"` | Yes | `"medium"` | — | — | effort pill |
| `roadmap_opportunities[].confidence` | `Confidence` | Yes | `{ score: 0.65, label: "medium", basis: "38 signals, 2 platforms" }` | — | — | confidence chip |
| `build_avoid_learn` | `BuildAvoidLearn` | Yes | `{ build: [...], avoid: [...], learn: [...] }` | gap, pain, love, feature | Yes — per item | `BuildAvoidLearnTabs` |
| `build_avoid_learn.build[].evidence_count` | `integer` ≥ 0 | Yes | `54` | gap, pain | — | count badge |
| `build_avoid_learn.avoid[].evidence_count` | `integer` ≥ 0 | Yes | `12` | love, positioning | — | count badge |
| `build_avoid_learn.learn[].evidence_count` | `integer` ≥ 0 | Yes | `29` | love, feature | — | count badge |
| `confidence_summary` | `Confidence` | Yes | `{ score: 0.68, label: "medium", basis: "432 signals across 5 platforms" }` | any | No | `SectionConfidenceBanner` |
| `evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: ["s1","s2"], quote_ids: [], source_urls: [] }` | any | Yes | `EvidenceDrawer` |

### Frontend Widgets

1. **ProductOpportunityScore** → `ProductOpportunityScoreGauge` — radial gauge with five factor sliders beneath it, colour-coded green/amber/red by score band.
2. **FeatureGapMap** → `FeatureGapTable` — sortable table; severity and confidence rendered as inline bars/chips; platform badges on each row; row expands to show evidence drawer.
3. **ComplaintClustersByProductArea** → `ComplaintClusterHeatmap` — grid of product area cards, sorted by `severity × frequency`; each card shows complaint title, frequency badge, and impact bar.
4. **LovedCompetitorFeatures** → `LovedFeaturesGrid` — card grid; each card shows stickiness bar, positive-mention count, and recommendation chip (colour-coded: learn=blue, match=yellow, differentiate=green, ignore=grey).
5. **WorkflowFriction** → `WorkflowFrictionList` — ordered list sorted by `impact × frequency`; each item shows affected segment label and suggested improvement in a collapsed accordion.
6. **RoadmapOpportunities** → `RoadmapOpportunityCards` — kanban-style column cards grouped by effort_estimate; expected_impact shown as a 0–100 bar; confidence chip inline.
7. **BuildAvoidLearn** → `BuildAvoidLearnTabs` — three-tab panel (Build / Avoid / Learn); each tab is a vertical list with evidence-count badge, confidence chip, and link to evidence drawer.


---

## MarketingViewSection

This section answers the question **"What should we say?"** for marketing practitioners — copywriters, demand-gen leads, and growth marketers — who need to translate raw competitor-user signal into words, angles, and creative assets. It surfaces the language real users actually use when describing pain and delight, maps the gap between what a competitor promises and what users experience, and produces ready-to-use copy scaffolding (headlines, ad hooks, comparison bullets, quote picks) with evidence anchors so every assertion can be traced back to a real signal rather than opinion.

```typescript
import { z } from "zod";
import {
  signalTypeSchema,
  evidenceRefSchema,
  confidenceSchema,
} from "@rivaleye/shared";

// ── Sub-schemas ─────────────────────────────────────────────────────────────

export const messagingOpportunityScoreSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string(),
  explanation: z.string(),
  factors: z.object({
    repeated_user_language_strength: z.number().min(0).max(1),
    pain_clarity: z.number().min(0).max(1),
    promise_reality_gap: z.number().min(0).max(1),
    objection_frequency: z.number().min(0).max(1),
    quote_quality: z.number().min(0).max(1),
    source_confidence: z.number().min(0).max(1),
  }),
});

export type MessagingOpportunityScore = z.infer<
  typeof messagingOpportunityScoreSchema
>;

// ── Phrase object (reused across all language bank fields) ───────────────────

export const phraseItemSchema = z.object({
  phrase: z.string(),
  frequency: z.number().int().min(0),
  sentiment: z.number().min(-1).max(1),
  source_count: z.number().int().min(0),
  evidence_refs: evidenceRefSchema,
});

export type PhraseItem = z.infer<typeof phraseItemSchema>;

// ── User Language Bank ────────────────────────────────────────────────────────

export const userLanguageBankSchema = z.object({
  positive_phrases: z.array(phraseItemSchema).default([]),
  negative_phrases: z.array(phraseItemSchema).default([]),
  alternative_seeking_phrases: z.array(phraseItemSchema).default([]),
  emotional_adjectives: z.array(phraseItemSchema).default([]),
  category_language: z.array(phraseItemSchema).default([]),
});

export type UserLanguageBank = z.infer<typeof userLanguageBankSchema>;

// ── Positioning Angles ────────────────────────────────────────────────────────

export const positioningAngleSchema = z.object({
  angle_title: z.string(),
  suggested_message: z.string(),
  pain_targeted: z.string(),
  competitor_weakness: z.string(),
  competitor_strength_to_respect: z.string(),
  best_channel_or_use_case: z.string(),
  risk_warning: z.string().nullable().default(null),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});

export type PositioningAngle = z.infer<typeof positioningAngleSchema>;

// ── Competitor Promise vs User Reality ────────────────────────────────────────

export const promiseVsRealityItemSchema = z.object({
  competitor_claim: z.string(),
  user_reality: z.string(),
  gap_summary: z.string(),
  messaging_opportunity: z.string(),
  evidence_count: z.number().int().min(0),
  evidence_refs: evidenceRefSchema,
});

export type PromiseVsRealityItem = z.infer<typeof promiseVsRealityItemSchema>;

// ── Objections to Handle ──────────────────────────────────────────────────────

export const objectionTypeSchema = z.enum([
  "pricing",
  "migration",
  "trust",
  "feature_completeness",
  "complexity",
  "support",
  "integration",
]);

export type ObjectionType = z.infer<typeof objectionTypeSchema>;

export const objectionItemSchema = z.object({
  objection_title: z.string(),
  objection_type: objectionTypeSchema,
  why_users_hesitate: z.string(),
  frequency: z.number().int().min(0),
  suggested_response: z.string(),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});

export type ObjectionItem = z.infer<typeof objectionItemSchema>;

// ── Comparison Page Bullets ───────────────────────────────────────────────────

export const comparisonPageBulletsSchema = z.object({
  hero_angle: z.string(),
  why_users_look_for_alternatives: z.array(z.string()).default([]),
  where_competitor_is_strong: z.array(z.string()).default([]),
  where_users_struggle: z.array(z.string()).default([]),
  who_should_choose_us: z.array(z.string()).default([]),
  objections_to_handle: z.array(z.string()).default([]),
  proof_quotes: z.array(z.string()).default([]),
});

export type ComparisonPageBullets = z.infer<typeof comparisonPageBulletsSchema>;

// ── Copy Ideas (satisfies landing_page_copy_ideas + ad_angle_ideas) ───────────
// Design decision: landing_page_copy_ideas and ad_angle_ideas are absorbed into
// a single `copy_ideas` object whose sub-arrays map cleanly to both concepts:
//   • homepage_headlines / subheadlines / cta_ideas → landing page copy
//   • ad_hooks / linkedin_hooks → ad angle ideas
//   • comparison_page_headlines → shared
// This avoids two separate top-level arrays that would duplicate structure and
// encourages the frontend to render a single tabbed "Copy Ideas" widget.

export const copyItemSchema = z.object({
  copy: z.string(),
  signal_behind_it: z.string(),
  best_use_case: z.string(),
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});

export type CopyItem = z.infer<typeof copyItemSchema>;

export const copyIdeasSchema = z.object({
  homepage_headlines: z.array(copyItemSchema).default([]),
  subheadlines: z.array(copyItemSchema).default([]),
  ad_hooks: z.array(copyItemSchema).default([]),
  linkedin_hooks: z.array(copyItemSchema).default([]),
  comparison_page_headlines: z.array(copyItemSchema).default([]),
  cta_ideas: z.array(copyItemSchema).default([]),
});

export type CopyIdeas = z.infer<typeof copyIdeasSchema>;

// ── Quote Library ─────────────────────────────────────────────────────────────

export const quoteLibraryItemSchema = z.object({
  quote: z.string(),
  source: z.string(),
  source_date: z.string().nullable().default(null),
  sentiment: z.number().min(-1).max(1),
  signal_type: signalTypeSchema,
  related_positioning_angle: z.string().nullable().default(null),
  copy_usefulness_score: z.number().min(0).max(1),
  source_url: z.string().nullable().default(null),
});

export type QuoteLibraryItem = z.infer<typeof quoteLibraryItemSchema>;

// ── MarketingViewSection (root) ───────────────────────────────────────────────

export const marketingViewSectionSchema = z.object({
  role: z.literal("marketing"),
  competitor_id: z.string(),
  generated_at: z.string(),                         // ISO 8601 UTC
  messaging_opportunity_score: messagingOpportunityScoreSchema,
  messaging_summary: z.string(),
  user_language_bank: userLanguageBankSchema,
  // top-level aliases kept for spec compliance; both point into user_language_bank
  positive_phrases: z.array(phraseItemSchema).default([]),
  negative_phrases: z.array(phraseItemSchema).default([]),
  positioning_angles: z.array(positioningAngleSchema).default([]),
  competitor_promise_vs_user_reality: z.array(promiseVsRealityItemSchema).default([]),
  objections_to_handle: z.array(objectionItemSchema).default([]),
  comparison_page_bullets: comparisonPageBulletsSchema,
  copy_ideas: copyIdeasSchema,                       // covers landing_page_copy_ideas + ad_angle_ideas
  quote_library: z.array(quoteLibraryItemSchema).default([]),
  evidence_refs: evidenceRefSchema,                  // section-level aggregate evidence
});

export type MarketingViewSection = z.infer<typeof marketingViewSectionSchema>;
```

### Field Contract Table

| Field | Type | Required | Example | Source signal types | Evidence required | Frontend component |
|---|---|---|---|---|---|---|
| `role` | `"marketing"` literal | Yes | `"marketing"` | — | No | — (discriminant) |
| `competitor_id` | `string` | Yes | `"competitor_abc123"` | — | No | — |
| `generated_at` | `string` (ISO 8601) | Yes | `"2026-05-22T10:00:00Z"` | — | No | — |
| `messaging_opportunity_score` | `MessagingOpportunityScore` | Yes | `{ score: 72, label: "Strong", ... }` | all | No (section aggregate) | `<MessagingOpportunityScoreWidget>` |
| `messaging_summary` | `string` | Yes | `"Users consistently describe onboarding as painful..."` | pain, gap, positioning | No | `<MessagingSummaryCard>` |
| `user_language_bank` | `UserLanguageBank` | Yes | `{ positive_phrases: [...], ... }` | love, pain, switch | Yes (per phrase) | `<UserLanguageBankWidget>` |
| `positive_phrases` | `PhraseItem[]` | Yes | `[{ phrase: "just works", frequency: 14, ... }]` | love, feature | Yes | `<UserLanguageBankWidget>` (mirrored from bank) |
| `negative_phrases` | `PhraseItem[]` | Yes | `[{ phrase: "impossible to export", frequency: 9, ... }]` | pain, gap | Yes | `<UserLanguageBankWidget>` (mirrored from bank) |
| `positioning_angles` | `PositioningAngle[]` | Yes | `[{ angle_title: "Painless Migration", ... }]` | gap, switch, positioning | Yes | `<PositioningAnglesWidget>` |
| `competitor_promise_vs_user_reality` | `PromiseVsRealityItem[]` | Yes | `[{ competitor_claim: "Setup in minutes", user_reality: "Took 3 days", ... }]` | gap, pain, positioning | Yes | `<PromiseVsRealityWidget>` |
| `objections_to_handle` | `ObjectionItem[]` | Yes | `[{ objection_title: "Too expensive", objection_type: "pricing", ... }]` | pricing, pain, switch | Yes | `<ObjectionsWidget>` |
| `comparison_page_bullets` | `ComparisonPageBullets` | Yes | `{ hero_angle: "No spreadsheet exports required", ... }` | gap, switch, love | No (prose synthesis) | `<ComparisonPageBulletsWidget>` |
| `copy_ideas` | `CopyIdeas` | Yes | `{ homepage_headlines: [{ copy: "Stop losing to onboarding", ... }] }` | pain, gap, positioning | Yes (per item) | `<CopyIdeasWidget>` |
| `quote_library` | `QuoteLibraryItem[]` | Yes | `[{ quote: "Took 3 days to onboard...", sentiment: -0.8, ... }]` | all | Yes (source_url) | `<QuoteLibraryWidget>` |
| `evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: [...], quote_ids: [...] }` | all | Yes | — (section-level audit link) |

**Sub-field details for nested objects:**

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `messaging_opportunity_score.factors.repeated_user_language_strength` | `number` 0–1 | Yes | `0.82` | How many phrases appear ≥3 times |
| `messaging_opportunity_score.factors.pain_clarity` | `number` 0–1 | Yes | `0.74` | LLM confidence that pain points are distinct and clear |
| `messaging_opportunity_score.factors.promise_reality_gap` | `number` 0–1 | Yes | `0.91` | Gap between competitor marketing claims and user reports |
| `messaging_opportunity_score.factors.objection_frequency` | `number` 0–1 | Yes | `0.60` | Normalized rate of objection-type signals |
| `messaging_opportunity_score.factors.quote_quality` | `number` 0–1 | Yes | `0.77` | Average copy_usefulness_score across quote_library |
| `messaging_opportunity_score.factors.source_confidence` | `number` 0–1 | Yes | `0.85` | Weighted source diversity / recency |
| `user_language_bank.alternative_seeking_phrases` | `PhraseItem[]` | Yes | `[{ phrase: "looking for something like X but", ... }]` | switch signals |
| `user_language_bank.emotional_adjectives` | `PhraseItem[]` | Yes | `[{ phrase: "overwhelming", frequency: 11, ... }]` | tone/copy voice |
| `user_language_bank.category_language` | `PhraseItem[]` | Yes | `[{ phrase: "project tracker", frequency: 22, ... }]` | SEO / ICP language |
| `positioning_angles[].competitor_strength_to_respect` | `string` | Yes | `"Deeply integrated with Salesforce"` | prevents overreach in copy |
| `positioning_angles[].risk_warning` | `string \| null` | No | `"Weak evidence; only 2 sources mention this"` | surface to copywriter |
| `objections_to_handle[].objection_type` | enum | Yes | `"migration"` | drives UI icon and filter |
| `copy_ideas.ad_hooks` | `CopyItem[]` | Yes | `[{ copy: "Your team loses 4h/week to X", ... }]` | maps to ad_angle_ideas spec field |
| `copy_ideas.linkedin_hooks` | `CopyItem[]` | Yes | `[{ copy: "We switched from X because...", ... }]` | maps to ad_angle_ideas spec field |
| `copy_ideas.homepage_headlines` | `CopyItem[]` | Yes | `[{ copy: "The onboarding your users deserve", ... }]` | maps to landing_page_copy_ideas spec field |
| `quote_library[].copy_usefulness_score` | `number` 0–1 | Yes | `0.88` | LLM-rated likelihood the quote works in marketing copy |
| `quote_library[].source_date` | `string \| null` | No | `"2025-11-03"` | ISO date; null when unknown |

---

### Frontend Widgets

1. **`<MessagingOpportunityScoreWidget>`** — Radar/spider chart of the six factor scores, composite dial 0–100, plain-English label and explanation text beneath.
2. **`<UserLanguageBankWidget>`** — Five tabbed tag-cloud panels (positive, negative, alternative-seeking, emotional adjectives, category language); each tag shows frequency badge; click-to-copy phrase.
3. **`<PositioningAnglesWidget>`** — Expandable card list; each card shows angle title, suggested message, pain targeted, weakness/strength pair, channel, risk warning badge, and confidence pill.
4. **`<PromiseVsRealityWidget>`** — Two-column comparison table: left = competitor claim (italicised), right = user reality (bold); gap summary and messaging opportunity below each row; evidence count badge.
5. **`<ObjectionsWidget>`** — Filterable list grouped by `objection_type`; each row shows frequency bar, hesitation summary, and suggested response in an accordion; confidence label.
6. **`<ComparisonPageBulletsWidget>`** — Structured preview of a VS page section: hero angle header, then five bullet-list subsections (why alternatives, strong points, struggle points, who to choose us, objections, proof quotes) — suitable for direct copy-paste into a landing page template.
7. **`<CopyIdeasWidget>`** — Six-tab panel (Homepage Headlines / Subheadlines / Ad Hooks / LinkedIn Hooks / Comparison Headlines / CTAs); each copy item shows text, signal behind it, best use case, confidence chip, and evidence link; one-click copy-to-clipboard.
8. **`<QuoteLibraryWidget>`** — Sortable, filterable table of quotes with columns: quote (truncated), source, date, sentiment bar, signal type badge, copy-usefulness score, and a "copy quote" action; clicking a row expands full text + source URL + related positioning angle.


---

## GrowthViewSection

The GrowthViewSection answers the question: **"Where are people showing buying or switching intent right now, and how should we engage without spamming?"** It surfaces publicly visible conversations where users of competing tools are actively frustrated, seeking alternatives, or questioning pricing — then structures each finding into actionable outreach angles for growth and marketing practitioners. Every insight is evidence-backed; confidence degrades gracefully when signal volume is low.

```typescript
import { z } from "zod";
import {
  signalTypeSchema,
  roleSchema,
  evidenceRefSchema,
  confidenceSchema,
} from "../shared-primitives";

// ── Sub-schemas ────────────────────────────────────────────────────────────────

export const switchIntentTypeSchema = z.enum([
  "looking_for_alternative",
  "pricing_complaint",
  "migration_question",
  "tool_recommendation_request",
  "missing_feature_request",
  "competitor_frustration",
  "churn_signal",
  "what_do_you_use_instead",
]);

const lowMedHighSchema = z.enum(["low", "medium", "high"]);

// 1. Switch Intent Score
export const switchIntentScoreSchema = z.object({
  score: z.number().min(0).max(100),
  label: z.string(),
  explanation: z.string(),
  factors: z.object({
    alternative_seeking_posts: z.number().min(0).max(1),
    pricing_complaints: z.number().min(0).max(1),
    explicit_competitor_frustration: z.number().min(0).max(1),
    recency: z.number().min(0).max(1),
    engagement_level: z.number().min(0).max(1),
    source_quality: z.number().min(0).max(1),
  }),
});
export type SwitchIntentScore = z.infer<typeof switchIntentScoreSchema>;

// 2. Switch-Intent Feed item
export const switchIntentFeedItemSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  user_or_context: z.string().nullable().default(null),
  source_date: z.string().nullable().default(null), // ISO 8601
  intent_type: switchIntentTypeSchema,
  competitor_mentioned: z.string().nullable().default(null),
  pain_mentioned: z.string().nullable().default(null),
  urgency: lowMedHighSchema,
  engagement_level: lowMedHighSchema,
  intent_score: z.number().min(0).max(1),
  suggested_angle: z.string().nullable().default(null),
  source_url: z.string().url().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type SwitchIntentFeedItem = z.infer<typeof switchIntentFeedItemSchema>;

// 3. Highest Priority Conversations (satisfies conversation_priority_scores spec)
// Note: `conversation_priority_scores` from the product spec maps 1:1 to this
// array — each item carries its own priority rank via the `priority` enum.
export const conversationPrioritySchema = z.enum(["hot", "warm", "research_only"]);

export const highestPriorityConversationSchema = z.object({
  priority: conversationPrioritySchema,
  conversation_title: z.string(),
  intent_type: switchIntentTypeSchema,
  pain: z.string().nullable().default(null),
  source: z.string(),
  source_date: z.string().nullable().default(null), // ISO 8601
  suggested_action: z.string(),
  source_url: z.string().url().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type HighestPriorityConversation = z.infer<typeof highestPriorityConversationSchema>;

// 4. Pricing Pain Leads
export const pricingPainLeadSchema = z.object({
  title: z.string(),
  pricing_issue: z.string(),
  plan_limitation: z.string().nullable().default(null),
  team_size_hint: z.string().nullable().default(null),
  budget_sensitivity: lowMedHighSchema,
  alternative_interest: z.string().nullable().default(null),
  suggested_pricing_angle: z.string().nullable().default(null),
  source_url: z.string().url().nullable().default(null),
  evidence_refs: evidenceRefSchema,
});
export type PricingPainLead = z.infer<typeof pricingPainLeadSchema>;

// 5. Communities to Engage
export const communityToEngageSchema = z.object({
  community_name: z.string(),
  source: z.string(),
  relevant_posts_count: z.number().int().nonnegative(),
  dominant_pain: z.string().nullable().default(null),
  engagement_level: lowMedHighSchema,
  community_fit_score: z.number().min(0).max(1),
  recommended_approach: z.string().nullable().default(null),
  spam_risk: lowMedHighSchema,
  evidence_refs: evidenceRefSchema,
});
export type CommunityToEngage = z.infer<typeof communityToEngageSchema>;

// 6. Suggested Reply Angles
export const suggestedReplyAngleSchema = z.object({
  related_conversation_id: z.string(), // references switchIntentFeedItemSchema.id
  context_summary: z.string(),
  what_to_acknowledge: z.string(),
  what_not_to_say: z.string(),
  helpful_reply_angle: z.string(),
  soft_cta_suggestion: z.string().nullable().default(null),
  spam_risk: lowMedHighSchema,
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type SuggestedReplyAngle = z.infer<typeof suggestedReplyAngleSchema>;

// 7. Segment Hints
export const segmentHintSchema = z.object({
  role_hint: z.string().nullable().default(null),
  company_or_team_size_hint: z.string().nullable().default(null),
  use_case: z.string().nullable().default(null),
  industry: z.string().nullable().default(null),
  urgency: lowMedHighSchema,
  budget_sensitivity: lowMedHighSchema,
  technical_maturity: lowMedHighSchema,
  confidence: confidenceSchema,
  evidence_refs: evidenceRefSchema,
});
export type SegmentHint = z.infer<typeof segmentHintSchema>;

// Source link
const sourceLinkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

// ── Root section schema ────────────────────────────────────────────────────────

export const growthViewSectionSchema = z.object({
  // Scalar summary
  highest_opportunity_summary: z.string().nullable().default(null),

  // Widget 1
  switch_intent_score: switchIntentScoreSchema,

  // Widget 2 — switch_intent_feed (feeds related_conversation_id references in widget 6)
  switch_intent_feed: z.array(switchIntentFeedItemSchema).default([]),

  // Widget 3 — satisfies conversation_priority_scores product-spec requirement
  highest_priority_conversations: z.array(highestPriorityConversationSchema).default([]),

  // Widget 4
  pricing_pain_leads: z.array(pricingPainLeadSchema).default([]),

  // Widget 5
  communities_to_engage: z.array(communityToEngageSchema).default([]),

  // Widget 6
  suggested_reply_angles: z.array(suggestedReplyAngleSchema).default([]),

  // Widget 7
  segment_hints: z.array(segmentHintSchema).default([]),

  // Section-level references
  spam_risk_notes: z.string().nullable().default(null),
  source_links: z.array(sourceLinkSchema).default([]),
  evidence_refs: evidenceRefSchema,
});

export type GrowthViewSection = z.infer<typeof growthViewSectionSchema>;
```

---

### Field contract table

| Field | Type | Required | Example value | Source signal types | Evidence required | Frontend component |
|---|---|---|---|---|---|---|
| `highest_opportunity_summary` | `string \| null` | No | `"15 Reddit threads seeking Notion alternatives this week"` | gap, switch, pain | No (scalar summary) | `OpportunitySummaryBanner` |
| `switch_intent_score` | `SwitchIntentScore` | Yes | `{ score: 72, label: "High", explanation: "...", factors: { … } }` | switch, pain, pricing | Aggregated from feed | `SwitchIntentScoreWidget` |
| `switch_intent_feed` | `SwitchIntentFeedItem[]` | Yes (default `[]`) | See item spec below | switch, pain, pricing, gap | Each item: yes | `SwitchIntentFeed` |
| `switch_intent_feed[].id` | `string` | Yes | `"sif_abc123"` | — | — | (row key) |
| `switch_intent_feed[].source` | `string` | Yes | `"Reddit"` | — | — | `PlatformBadge` |
| `switch_intent_feed[].title` | `string` | Yes | `"Looking for a cheaper Notion alternative"` | — | — | `ConversationTitle` |
| `switch_intent_feed[].user_or_context` | `string \| null` | No | `"r/productivity"` | — | — | `ContextLabel` |
| `switch_intent_feed[].source_date` | `string \| null` | No | `"2026-05-18T14:32:00Z"` | — | — | `RelativeDate` |
| `switch_intent_feed[].intent_type` | `SwitchIntentType` enum | Yes | `"looking_for_alternative"` | switch, gap | — | `IntentTypeBadge` |
| `switch_intent_feed[].competitor_mentioned` | `string \| null` | No | `"Notion"` | switch | — | `CompetitorTag` |
| `switch_intent_feed[].pain_mentioned` | `string \| null` | No | `"Too expensive for solo teams"` | pain, pricing | — | `PainLabel` |
| `switch_intent_feed[].urgency` | `low\|medium\|high` | Yes | `"high"` | switch | — | `UrgencyBadge` |
| `switch_intent_feed[].engagement_level` | `low\|medium\|high` | Yes | `"medium"` | — | — | `EngagementIndicator` |
| `switch_intent_feed[].intent_score` | `number 0–1` | Yes | `0.87` | switch | — | `IntentScoreBar` |
| `switch_intent_feed[].suggested_angle` | `string \| null` | No | `"Lead with free tier; mention per-seat pricing"` | — | — | `AngleSuggestion` |
| `switch_intent_feed[].source_url` | `string (URL) \| null` | No | `"https://reddit.com/r/…"` | — | — | `ExternalLink` |
| `switch_intent_feed[].evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | all | Yes | (hover tooltip) |
| `highest_priority_conversations` | `HighestPriorityConversation[]` | Yes (default `[]`) | See item spec | switch, pain, pricing | Each item: yes | `ConversationPriorityQueue` |
| `highest_priority_conversations[].priority` | `hot\|warm\|research_only` | Yes | `"hot"` | — | — | `PriorityBadge` |
| `highest_priority_conversations[].conversation_title` | `string` | Yes | `"How do you migrate off Notion?"` | — | — | `ConversationTitle` |
| `highest_priority_conversations[].intent_type` | `SwitchIntentType` enum | Yes | `"migration_question"` | switch | — | `IntentTypeBadge` |
| `highest_priority_conversations[].pain` | `string \| null` | No | `"No offline mode"` | pain | — | `PainLabel` |
| `highest_priority_conversations[].source` | `string` | Yes | `"Hacker News"` | — | — | `PlatformBadge` |
| `highest_priority_conversations[].source_date` | `string \| null` | No | `"2026-05-20T09:00:00Z"` | — | — | `RelativeDate` |
| `highest_priority_conversations[].suggested_action` | `string` | Yes | `"Reply with comparison post link"` | — | — | `ActionCard` |
| `highest_priority_conversations[].source_url` | `string (URL) \| null` | No | `"https://news.ycombinator.com/…"` | — | — | `ExternalLink` |
| `highest_priority_conversations[].evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | all | Yes | (hover tooltip) |
| `pricing_pain_leads` | `PricingPainLead[]` | Yes (default `[]`) | See item spec | pricing, pain | Each item: yes | `PricingPainLeadsTable` |
| `pricing_pain_leads[].title` | `string` | Yes | `"Team of 10 hitting seat limit on Notion Pro"` | pricing | — | (table row label) |
| `pricing_pain_leads[].pricing_issue` | `string` | Yes | `"Per-seat cost balloons past 8 users"` | pricing | — | `PricingIssueTag` |
| `pricing_pain_leads[].plan_limitation` | `string \| null` | No | `"Blocks API on free plan"` | gap | — | (detail cell) |
| `pricing_pain_leads[].team_size_hint` | `string \| null` | No | `"10–50 people"` | — | — | `TeamSizeChip` |
| `pricing_pain_leads[].budget_sensitivity` | `low\|medium\|high` | Yes | `"high"` | pricing | — | `SensitivityBadge` |
| `pricing_pain_leads[].alternative_interest` | `string \| null` | No | `"Coda, Confluence"` | switch | — | (detail cell) |
| `pricing_pain_leads[].suggested_pricing_angle` | `string \| null` | No | `"Flat-team pricing under $100/mo"` | — | — | `AngleSuggestion` |
| `pricing_pain_leads[].source_url` | `string (URL) \| null` | No | `"https://reddit.com/r/…"` | — | — | `ExternalLink` |
| `pricing_pain_leads[].evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | pricing | Yes | (hover tooltip) |
| `communities_to_engage` | `CommunityToEngage[]` | Yes (default `[]`) | See item spec | all | Each item: yes | `CommunityEngagementList` |
| `communities_to_engage[].community_name` | `string` | Yes | `"r/productivity"` | — | — | (card title) |
| `communities_to_engage[].source` | `string` | Yes | `"Reddit"` | — | — | `PlatformBadge` |
| `communities_to_engage[].relevant_posts_count` | `integer ≥ 0` | Yes | `23` | — | — | `PostCountBadge` |
| `communities_to_engage[].dominant_pain` | `string \| null` | No | `"Pricing too complex"` | pain | — | `DominantPainLabel` |
| `communities_to_engage[].engagement_level` | `low\|medium\|high` | Yes | `"high"` | — | — | `EngagementIndicator` |
| `communities_to_engage[].community_fit_score` | `number 0–1` | Yes | `0.82` | — | — | `FitScoreBar` |
| `communities_to_engage[].recommended_approach` | `string \| null` | No | `"Answer questions; link to comparison post"` | — | — | `ApproachCard` |
| `communities_to_engage[].spam_risk` | `low\|medium\|high` | Yes | `"low"` | — | — | `SpamRiskBadge` |
| `communities_to_engage[].evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | all | Yes | (hover tooltip) |
| `suggested_reply_angles` | `SuggestedReplyAngle[]` | Yes (default `[]`) | See item spec | all | Each item: yes | `ReplyAngleCards` |
| `suggested_reply_angles[].related_conversation_id` | `string` | Yes | `"sif_abc123"` | — | — | (links back to feed item) |
| `suggested_reply_angles[].context_summary` | `string` | Yes | `"User migrating off Notion due to API cost"` | — | — | `ContextSummary` |
| `suggested_reply_angles[].what_to_acknowledge` | `string` | Yes | `"Acknowledge the pricing frustration"` | — | — | `DoCard` |
| `suggested_reply_angles[].what_not_to_say` | `string` | Yes | `"Don't name-drop competitors unprompted"` | — | — | `DontCard` |
| `suggested_reply_angles[].helpful_reply_angle` | `string` | Yes | `"Share transparent pricing breakdown"` | — | — | `ReplyAngleSuggestion` |
| `suggested_reply_angles[].soft_cta_suggestion` | `string \| null` | No | `"Link to pricing FAQ or trial"` | — | — | `CtaSuggestion` |
| `suggested_reply_angles[].spam_risk` | `low\|medium\|high` | Yes | `"low"` | — | — | `SpamRiskBadge` |
| `suggested_reply_angles[].confidence` | `Confidence` | Yes | `{ score: 0.75, label: "high", basis: "3 matching posts" }` | — | — | `ConfidenceIndicator` |
| `suggested_reply_angles[].evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | all | Yes | (hover tooltip) |
| `segment_hints` | `SegmentHint[]` | Yes (default `[]`) | See item spec | all | Each item: yes | `SegmentHintCards` |
| `segment_hints[].role_hint` | `string \| null` | No | `"Head of Ops"` | — | — | `RoleChip` |
| `segment_hints[].company_or_team_size_hint` | `string \| null` | No | `"10–50"` | — | — | `TeamSizeChip` |
| `segment_hints[].use_case` | `string \| null` | No | `"Internal knowledge base"` | — | — | `UseCaseTag` |
| `segment_hints[].industry` | `string \| null` | No | `"SaaS / B2B"` | — | — | `IndustryTag` |
| `segment_hints[].urgency` | `low\|medium\|high` | Yes | `"high"` | switch | — | `UrgencyBadge` |
| `segment_hints[].budget_sensitivity` | `low\|medium\|high` | Yes | `"medium"` | pricing | — | `SensitivityBadge` |
| `segment_hints[].technical_maturity` | `low\|medium\|high` | Yes | `"medium"` | — | — | `TechMaturityBadge` |
| `segment_hints[].confidence` | `Confidence` | Yes | `{ score: 0.6, label: "medium", basis: null }` | — | — | `ConfidenceIndicator` |
| `segment_hints[].evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | all | Yes | (hover tooltip) |
| `spam_risk_notes` | `string \| null` | No | `"r/SaaS has strict self-promo rules"` | — | No | `SpamRiskBanner` |
| `source_links` | `{ label: string, url: string }[]` | Yes (default `[]`) | `[{ label: "Reddit thread", url: "https://…" }]` | — | No | `SourceLinkList` |
| `evidence_refs` | `EvidenceRef` | Yes | `{ signal_ids: […], … }` | all | Yes | (section footer) |

---

### Frontend widgets

1. **SwitchIntentScoreWidget** — renders `switch_intent_score`; hexagonal gauge or radial chart with factor breakdown bars.
2. **SwitchIntentFeed** — card list or table rendering `switch_intent_feed`; filterable by `intent_type`, `urgency`, `source`; clicking a row opens linked reply angle.
3. **ConversationPriorityQueue** — renders `highest_priority_conversations`; three-column kanban-style (hot / warm / research_only) or priority-sorted list with `suggested_action` CTA chips.
4. **PricingPainLeadsTable** — tabular rendering of `pricing_pain_leads`; columns: Team, Pricing Issue, Sensitivity, Suggested Angle, Source.
5. **CommunityEngagementList** — card grid for `communities_to_engage`; each card shows fit score bar, spam risk badge, and recommended approach.
6. **ReplyAngleCards** — renders `suggested_reply_angles`; each card links back to the referenced feed item via `related_conversation_id`; Do / Don't / Angle / CTA layout.
7. **SegmentHintCards** — renders `segment_hints`; tag-cloud of role/industry/use-case with urgency + budget sensitivity badges and confidence indicator.


---

## EvidenceSection

EvidenceSection is the trust layer and single source of truth for all signal-scoped dashboard sections (Founder, Product, Marketing, Growth, Overview). Every insight emitted by the LLM pipeline must reference one or more evidence items by `quote_ids`; if no credible evidence exists the insight must carry a `low` confidence label. EvidenceSection stores the canonical quote pool, the underlying raw source posts, and a curated list of source links — meaning no other section ever stores a verbatim quote; they only carry `evidence_refs` pointers back into this pool. This design makes the dashboard auditable: a frontend can always trace any claim to the exact post or review that generated it.

```typescript
import { z } from "zod";
// Shared primitives are imported — not redefined here.
// import { signalTypeSchema, roleSchema, evidenceRefSchema, confidenceSchema } from "@rivaleye/shared";

// ── Sub-schemas ──────────────────────────────────────────────────────────────

/** Platforms that can produce evidence. Extend as new scrapers are added. */
export const evidenceSourceSchema = z.enum([
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "website",
]);
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;

/**
 * Dashboard sections that can be cross-referenced.
 * "overview" maps to the top-level summary section.
 */
export const dashboardSectionSchema = z.enum([
  "overview",
  "founder",
  "product",
  "marketing",
  "growth",
]);
export type DashboardSection = z.infer<typeof dashboardSectionSchema>;

/** A curated source link shown in the UI as a labelled hyperlink. */
export const sourceLinkSchema = z.object({
  /** Human-readable label, e.g. "Reddit r/saasdiscussion". */
  label: z.string(),
  /** Canonical URL for the source thread, page, or review. */
  url: z.string().url(),
});
export type SourceLink = z.infer<typeof sourceLinkSchema>;

// ── Evidence item ─────────────────────────────────────────────────────────────

/**
 * A single evidence quote extracted from a source post.
 * This is the atomic unit that all other sections reference by `id`.
 */
export const evidenceItemSchema = z.object({
  /** Stable UUID assigned by the LLM pipeline. Used as the reference key in `quote_ids`. */
  id: z.string().uuid(),

  /** Verbatim or lightly cleaned quote from the source material. */
  quote: z.string(),

  /** Platform that produced this quote. */
  source: evidenceSourceSchema,

  /**
   * ID of the source item (raw_item.id) this quote was extracted from.
   * Allows the frontend to open the full raw_item on demand.
   */
  source_item_id: z.string(),

  /** Direct URL to the post, comment, or review page. */
  source_url: z.string().url(),

  /**
   * ISO-8601 date string of when the source was published.
   * Nullable when the platform does not expose publish date.
   */
  source_date: z.string().datetime({ offset: true }).nullable().default(null),

  /**
   * Username, display name, or brief context (e.g. "G2 reviewer, 50-200 employees").
   * Nullable — only populated when the platform exposes identity or role context.
   */
  author_or_context: z.string().nullable().default(null),

  /** Signal type this quote was classified under. */
  signal_type: signalTypeSchema,

  /**
   * Sentiment polarity: -1 (strongly negative) to +1 (strongly positive).
   * 0 is neutral. Used for frontend sentiment filter.
   */
  sentiment: z.number().min(-1).max(1),

  /** LLM confidence in the classification of this quote. */
  confidence: confidenceSchema,

  /**
   * IDs of signals (from SignalsSection / other pipeline output) that cite this quote.
   * Enables reverse-lookup from evidence → signals.
   */
  related_signal_ids: z.array(z.string()).default([]),

  /**
   * Dashboard sections that reference this evidence item.
   * Used for the `dashboard_section` filter in the evidence browser.
   */
  related_dashboard_sections: z.array(dashboardSectionSchema).default([]),

  /**
   * Roles for which this evidence is relevant.
   * Used for the `role_relevance` filter in the evidence browser.
   * Derived by the LLM based on signal_type and dashboard_section mapping.
   */
  role_relevance: z.array(roleSchema).default([]),

  /**
   * Raw text surrounding the extracted quote for additional context.
   * May be a sentence or two above/below the quote.
   */
  raw_text_excerpt: z.string().nullable().default(null),

  /**
   * Freeform platform-specific metadata (upvotes, rating, verified purchase flag, etc.).
   * Keys and value shapes vary per source; treat as opaque on the frontend.
   */
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

// ── Raw item ──────────────────────────────────────────────────────────────────

/**
 * The underlying source post, thread, review, or page from which quotes are extracted.
 * Stored for auditability; not shown inline but available for deep-dive.
 */
export const rawItemSchema = z.object({
  /** Stable UUID assigned by the scraper/pipeline. Matches source_item_id on EvidenceItem. */
  id: z.string().uuid(),

  /** Platform that produced this item. */
  source: evidenceSourceSchema,

  /** Canonical URL of the post, thread, review, or page. */
  source_url: z.string().url(),

  /**
   * ISO-8601 publish date.
   * Nullable when the platform does not expose it.
   */
  source_date: z.string().datetime({ offset: true }).nullable().default(null),

  /**
   * Title of the post or review.
   * Nullable for platforms that have no title (e.g. Reddit comments, App Store reviews).
   */
  title: z.string().nullable().default(null),

  /**
   * Truncated body text (first ~500 chars or a meaningful excerpt).
   * Full text is not stored here; this is for quick preview.
   */
  body_excerpt: z.string(),

  /**
   * Author username or display name.
   * Nullable when the platform anonymises authorship.
   */
  author: z.string().nullable().default(null),

  /**
   * Platform engagement score: upvotes, star rating, helpful-count, etc.
   * Normalised to a numeric nullable — interpretation depends on source.
   */
  score: z.number().nullable().default(null),
});
export type RawItem = z.infer<typeof rawItemSchema>;

// ── Section ───────────────────────────────────────────────────────────────────

export const evidenceSectionSchema = z.object({
  /**
   * The canonical pool of extracted quotes.
   * All other dashboard sections reference items here by id via evidence_refs.quote_ids.
   */
  quotes: z.array(evidenceItemSchema).default([]),

  /**
   * Curated labelled links to the source threads / pages.
   * Shown in the UI as a "Sources" list alongside the evidence browser.
   */
  source_links: z.array(sourceLinkSchema).default([]),

  /**
   * Full raw source items (posts, threads, reviews) from which quotes were extracted.
   * Not rendered inline; available for audit / expandable deep-dive panels.
   */
  raw_items: z.array(rawItemSchema).default([]),

  /**
   * Self-describing list of filterable dimensions supported by the evidence browser.
   * Kept on the section so the frontend contract is explicit without inspecting item fields.
   */
  filters_supported: z
    .array(z.string())
    .default([
      "source",
      "signal_type",
      "sentiment",
      "confidence",
      "dashboard_section",
      "date",
      "role_relevance",
    ]),
});

export type EvidenceSection = z.infer<typeof evidenceSectionSchema>;
```

### Field Contract

#### `EvidenceSection` (section-level)

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `quotes` | `EvidenceItem[]` | yes (default `[]`) | `[{ id: "uuid", quote: "…", … }]` | Main pool; all other sections reference by `id` |
| `source_links` | `SourceLink[]` | yes (default `[]`) | `[{ label: "Reddit r/saas", url: "https://…" }]` | Curated display links for the "Sources" panel |
| `raw_items` | `RawItem[]` | yes (default `[]`) | `[{ id: "uuid", source: "reddit", … }]` | Underlying posts; used for audit / deep-dive |
| `filters_supported` | `string[]` | yes (default populated) | `["source","signal_type",…]` | Self-describing filterable dimensions |

#### `EvidenceItem` (per quote)

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `id` | `string` (UUID) | yes | `"3fa85f64-…"` | Reference key used in `evidence_refs.quote_ids` |
| `quote` | `string` | yes | `"The CSV export just breaks silently."` | Verbatim or lightly cleaned |
| `source` | `EvidenceSource` enum | yes | `"reddit"` | Platform; drives source filter |
| `source_item_id` | `string` | yes | `"raw-item-uuid"` | Foreign key into `raw_items[].id` |
| `source_url` | `string` (URL) | yes | `"https://reddit.com/r/…/comments/…"` | Deep link shown in evidence card |
| `source_date` | `string` (ISO-8601) \| `null` | yes | `"2025-11-03T14:22:00Z"` | Nullable when platform omits date |
| `author_or_context` | `string` \| `null` | yes (nullable) | `"u/user123"` or `"G2 reviewer, SMB"` | Null when platform anonymises |
| `signal_type` | `SignalType` enum | yes | `"pain"` | Drives signal_type filter |
| `sentiment` | `number` (-1..1) | yes | `-0.8` | -1 negative, 0 neutral, +1 positive |
| `confidence` | `Confidence` object | yes | `{ score: 0.82, label: "high", basis: "…" }` | Drives confidence filter |
| `related_signal_ids` | `string[]` | yes (default `[]`) | `["sig-001"]` | Reverse-lookup from evidence → signals |
| `related_dashboard_sections` | `DashboardSection[]` | yes (default `[]`) | `["product","growth"]` | Drives dashboard_section filter |
| `role_relevance` | `Role[]` | yes (default `[]`) | `["product","founder"]` | Drives role_relevance filter |
| `raw_text_excerpt` | `string` \| `null` | yes (nullable) | `"…two sentences of surrounding context…"` | Shown in expandable evidence card |
| `metadata` | `Record<string, unknown>` | yes (default `{}`) | `{ "upvotes": 142, "flair": "Feedback" }` | Opaque per-platform extras |

#### `RawItem` (per source post)

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `id` | `string` (UUID) | yes | `"9b1deb4d-…"` | Matches `EvidenceItem.source_item_id` |
| `source` | `EvidenceSource` enum | yes | `"hackernews"` | Platform |
| `source_url` | `string` (URL) | yes | `"https://news.ycombinator.com/item?id=…"` | Canonical post URL |
| `source_date` | `string` (ISO-8601) \| `null` | yes (nullable) | `"2025-10-15T09:00:00Z"` | Null when not exposed |
| `title` | `string` \| `null` | yes (nullable) | `"Ask HN: Why did you leave Notion?"` | Null for App Store / comment-only sources |
| `body_excerpt` | `string` | yes | `"We switched because the API rate limits…"` | First ~500 chars or meaningful excerpt |
| `author` | `string` \| `null` | yes (nullable) | `"throwaway_founder"` | Null when anonymised |
| `score` | `number` \| `null` | yes (nullable) | `312` | Upvotes / star rating / helpful-count; null when unavailable |

#### `SourceLink`

| Field | Type | Required | Example | Notes |
|---|---|---|---|---|
| `label` | `string` | yes | `"Reddit r/projectmanagement"` | Human-readable display label |
| `url` | `string` (URL) | yes | `"https://reddit.com/r/projectmanagement"` | Thread or listing URL |

---

### Frontend

**Evidence Browser component** (`<EvidenceBrowser />`) receives the full `EvidenceSection` and renders a filterable, paginated list of `EvidenceItem` cards. Each card shows: quote, source badge, date, author_or_context, signal_type chip, sentiment bar, confidence label, and an expandable raw_text_excerpt panel. A "Sources" sidebar lists `source_links`. Clicking a raw-post link opens the `raw_items` entry for audit.

**Supported filters** (derived from `filters_supported` on the section):

- **`source`** — filter by platform (`reddit`, `appstore`, `playstore`, `hackernews`, `producthunt`, `devto`, `website`) using `EvidenceItem.source`
- **`signal_type`** — filter by signal class (`love`, `pain`, `gap`, `switch`, `pricing`, `feature`, `positioning`) using `EvidenceItem.signal_type`
- **`sentiment`** — range slider (-1 to +1) against `EvidenceItem.sentiment`
- **`confidence`** — checkbox group (`low`, `medium`, `high`) using `EvidenceItem.confidence.label`
- **`dashboard_section`** — multi-select (`overview`, `founder`, `product`, `marketing`, `growth`) using `EvidenceItem.related_dashboard_sections`
- **`date`** — date-range picker against `EvidenceItem.source_date` (items with `null` date appear in an "Unknown date" bucket)
- **`role_relevance`** — multi-select (`founder`, `product`, `marketing`, `growth`) using `EvidenceItem.role_relevance`
