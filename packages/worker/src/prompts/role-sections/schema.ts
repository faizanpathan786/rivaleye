import { z } from "zod";
import {
  signalTypeSchema,
  roleSchema,
  evidenceRefSchema,
  confidenceSchema,
} from "./primitives";

// Re-export primitives so consumers can import from a single place if desired.
export {
  signalTypeSchema,
  roleSchema,
  evidenceRefSchema,
  confidenceSchema,
} from "./primitives";
export type {
  SignalType,
  Role,
  EvidenceRef,
  Confidence,
} from "./primitives";

// =============================================================================
// OverviewSection
// =============================================================================

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

// =============================================================================
// FounderViewSection
// =============================================================================

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

// =============================================================================
// ProductViewSection
// =============================================================================

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

// =============================================================================
// MarketingViewSection
// =============================================================================

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

// =============================================================================
// GrowthViewSection
// =============================================================================

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

// Note: lowMedHighSchema is local to this section (also used by EvidenceSection's
// sourceLinkSchema is separate). Named with a `growth` prefix to avoid collision
// with the growth-local sourceLinkSchema below.
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

// Source link (growth-local — EvidenceSection defines its own sourceLinkSchema below)
const growthSourceLinkSchema = z.object({
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
  source_links: z.array(growthSourceLinkSchema).default([]),
  evidence_refs: evidenceRefSchema,
});

export type GrowthViewSection = z.infer<typeof growthViewSectionSchema>;

// =============================================================================
// EvidenceSection
// =============================================================================

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

  /** Direct URL to the post, comment, or review page.
   *  Nullable — some sources (e.g. app-store review aggregators) have no per-item URL. */
  source_url: z.string().url().nullable(),

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

// =============================================================================
// roleSectionsSchema — wrapper for all six sections
// =============================================================================

export const roleSectionsSchema = z.object({
  overview: overviewSectionSchema,
  founder: founderViewSectionSchema,
  product: productViewSectionSchema,
  marketing: marketingViewSectionSchema,
  growth: growthViewSectionSchema,
  evidence: evidenceSectionSchema,
});
export type RoleSections = z.infer<typeof roleSectionsSchema>;
