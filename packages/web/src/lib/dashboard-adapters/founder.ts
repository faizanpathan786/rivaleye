/**
 * founder.ts — Adapter: FounderViewSection (doc-16) → FounderViewProps
 *
 * Pure function, no side effects, no React.
 * Maps the doc-16 contract to the shape `routes/founder.tsx` will consume.
 *
 * Dropped mock-only fields (per plan header):
 *   - delta / weeklyDelta / trends[]
 *   - score.insight / score.focus / score.coverage[]
 *   - wedge.evidence.{mentions,threads,sources}
 *   - actions[].evidence / actions[].next
 *   - inline quote / who on every item
 *   - pricingLeads[].quote (inline blockquote)
 */

import type { Confidence, EvidenceRef } from "../dashboard-helpers";

// ─── Input: FounderViewSection (doc-16 contract) ─────────────────────────────

export type OpportunityScoreFactors = {
  pain_frequency: number;
  gap_severity: number;
  switch_intent: number;
  competitor_love_strength: number;
  pricing_pain: number;
  source_confidence: number;
};

export type FounderViewSection = {
  opportunity_score: {
    score: number;
    label: string;
    explanation: string;
    factors: OpportunityScoreFactors;
  };
  market_opening_summary: {
    summary: string;
    target_segment: string;
    main_opportunity: string;
    why_now: string;
    confidence: Confidence;
    evidence_refs: EvidenceRef;
  };
  strengths_to_respect: Array<{
    title: string;
    summary: string;
    why_users_love_it: string;
    strategic_implication: string;
    confidence: Confidence;
    evidence_refs: EvidenceRef;
  }>;
  weaknesses_to_attack: Array<{
    title: string;
    summary: string;
    severity: number;
    frequency: number;
    opportunity_implication: string;
    confidence: Confidence;
    evidence_refs: EvidenceRef;
  }>;
  unmet_needs: Array<{
    need: string;
    user_segment: string;
    frequency: number;
    source_spread: number;
    opportunity_level: "low" | "medium" | "high";
    evidence_refs: EvidenceRef;
  }>;
  wedge_recommendation: {
    target_segment: string;
    core_pain: string;
    positioning_promise: string;
    why_this_wedge_exists: string;
    evidence_strength: "low" | "medium" | "high";
    risk_level: "low" | "medium" | "high";
    evidence_refs: EvidenceRef;
  };
  pricing_opportunity: {
    pricing_pain_score: number;
    main_pricing_complaint: string;
    affected_segment: string;
    suggested_pricing_angle: string;
    risk_warning: string | null;
    evidence_refs: EvidenceRef;
  };
  strategic_risks: Array<{
    risk_title: string;
    explanation: string;
    why_it_matters: string;
    mitigation: string;
    severity: number;
    evidence_refs: EvidenceRef;
  }>;
  recommended_product_move: {
    recommendation: string;
    why: string;
    confidence: Confidence;
    evidence_refs: EvidenceRef;
  };
  recommended_positioning_move: {
    recommendation: string;
    why: string;
    confidence: Confidence;
    evidence_refs: EvidenceRef;
  };
  recommended_growth_move: {
    recommendation: string;
    why: string;
    confidence: Confidence;
    evidence_refs: EvidenceRef;
  };
  evidence_refs: EvidenceRef;
};

// ─── Output: FounderViewProps ─────────────────────────────────────────────────
// Shape that routes/founder.tsx accepts as its `data` prop.
// Mock-only fields have been removed (see plan header for full list).

export type FounderScoreFactor = {
  key: string;
  value: number;
};

export type FounderOpportunity = {
  score: number;
  label: string;
  headline: string;
  factors: FounderScoreFactor[];
};

export type FounderMarketOpeningSummary = {
  summary: string;
  target: string;
  main_opportunity: string;
  why_now: string;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type FounderStrength = {
  title: string;
  explanation: string;
  why_users_love_it: string;
  implication: string;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type FounderWeakness = {
  title: string;
  summary: string;
  severity: number;
  frequency: number;
  opportunity_implication: string;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type FounderUnmetNeed = {
  need: string;
  segment: string;
  frequency: number;
  source_spread: number;
  opportunity_level: "low" | "medium" | "high";
  evidence_refs: EvidenceRef;
};

export type FounderWedge = {
  title: string;
  target: string;
  pain: string;
  promise: string;
  why: string;
  evidence_strength: "low" | "medium" | "high";
  risk_level: "low" | "medium" | "high";
  evidence_refs: EvidenceRef;
};

export type FounderPricing = {
  score: number;
  main: string;
  who: string;
  opportunity: string;
  risk: string | null;
  evidence_refs: EvidenceRef;
};

export type FounderRisk = {
  title: string;
  severity: number;
  explanation: string;
  why_it_matters: string;
  recommendation: string;
  evidence_refs: EvidenceRef;
};

export type FounderAction = {
  kind: "product" | "positioning" | "growth";
  title: string;
  why: string;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type FounderViewProps = {
  opportunity: FounderOpportunity;
  market_opening_summary: FounderMarketOpeningSummary;
  loves: FounderStrength[];
  frustrations: FounderWeakness[];
  unmet: FounderUnmetNeed[];
  wedge: FounderWedge;
  pricing: FounderPricing;
  risks: FounderRisk[];
  actions: FounderAction[];
};

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * Map a `FounderViewSection` (doc-16 pipeline output) to a `FounderViewProps`
 * object ready for consumption by `routes/founder.tsx`.
 *
 * Renames applied:
 *   market_opening_summary.target_segment → market_opening_summary.target
 *   strengths[].summary                   → loves[].explanation
 *   strengths[].strategic_implication     → loves[].implication
 *   weaknesses_to_attack                  → frustrations
 *   unmet_needs[].user_segment            → unmet[].segment
 *   wedge_recommendation.core_pain        → wedge.pain
 *   wedge_recommendation.positioning_promise → wedge.promise
 *   wedge_recommendation.why_this_wedge_exists → wedge.why
 *   pricing_opportunity.pricing_pain_score (0..1 kept; UI adapts)
 *   pricing_opportunity.main_pricing_complaint → pricing.main
 *   pricing_opportunity.affected_segment  → pricing.who
 *   pricing_opportunity.suggested_pricing_angle → pricing.opportunity
 *   pricing_opportunity.risk_warning      → pricing.risk
 *   strategic_risks[].risk_title          → risks[].title
 *   strategic_risks[].mitigation          → risks[].recommendation
 *   recommended_*_move                    → actions[] (kind: "product"|"positioning"|"growth")
 *   founderMove.recommendation            → action.title
 */
export function toFounderViewProps(section: FounderViewSection): FounderViewProps {
  const os = section.opportunity_score;

  const opportunity: FounderOpportunity = {
    score: os.score,
    label: os.label,
    headline: os.explanation,
    factors: [
      { key: "pain_frequency", value: os.factors.pain_frequency },
      { key: "gap_severity", value: os.factors.gap_severity },
      { key: "switch_intent", value: os.factors.switch_intent },
      { key: "competitor_love_strength", value: os.factors.competitor_love_strength },
      { key: "pricing_pain", value: os.factors.pricing_pain },
      { key: "source_confidence", value: os.factors.source_confidence },
    ],
  };

  const mos = section.market_opening_summary;
  const market_opening_summary: FounderMarketOpeningSummary = {
    summary: mos.summary,
    target: mos.target_segment,
    main_opportunity: mos.main_opportunity,
    why_now: mos.why_now,
    confidence: mos.confidence,
    evidence_refs: mos.evidence_refs,
  };

  const loves: FounderStrength[] = section.strengths_to_respect.map((s) => ({
    title: s.title,
    explanation: s.summary,
    why_users_love_it: s.why_users_love_it,
    implication: s.strategic_implication,
    confidence: s.confidence,
    evidence_refs: s.evidence_refs,
  }));

  const frustrations: FounderWeakness[] = section.weaknesses_to_attack.map((w) => ({
    title: w.title,
    summary: w.summary,
    severity: w.severity,
    frequency: w.frequency,
    opportunity_implication: w.opportunity_implication,
    confidence: w.confidence,
    evidence_refs: w.evidence_refs,
  }));

  const unmet: FounderUnmetNeed[] = section.unmet_needs.map((u) => ({
    need: u.need,
    segment: u.user_segment,
    frequency: u.frequency,
    source_spread: u.source_spread,
    opportunity_level: u.opportunity_level,
    evidence_refs: u.evidence_refs,
  }));

  const wr = section.wedge_recommendation;
  const wedge: FounderWedge = {
    title: wr.positioning_promise,
    target: wr.target_segment,
    pain: wr.core_pain,
    promise: wr.positioning_promise,
    why: wr.why_this_wedge_exists,
    evidence_strength: wr.evidence_strength,
    risk_level: wr.risk_level,
    evidence_refs: wr.evidence_refs,
  };

  const po = section.pricing_opportunity;
  const pricing: FounderPricing = {
    score: po.pricing_pain_score,
    main: po.main_pricing_complaint,
    who: po.affected_segment,
    opportunity: po.suggested_pricing_angle,
    risk: po.risk_warning,
    evidence_refs: po.evidence_refs,
  };

  const risks: FounderRisk[] = section.strategic_risks.map((r) => ({
    title: r.risk_title,
    severity: r.severity,
    explanation: r.explanation,
    why_it_matters: r.why_it_matters,
    recommendation: r.mitigation,
    evidence_refs: r.evidence_refs,
  }));

  const actions: FounderAction[] = [
    {
      kind: "product",
      title: section.recommended_product_move.recommendation,
      why: section.recommended_product_move.why,
      confidence: section.recommended_product_move.confidence,
      evidence_refs: section.recommended_product_move.evidence_refs,
    },
    {
      kind: "positioning",
      title: section.recommended_positioning_move.recommendation,
      why: section.recommended_positioning_move.why,
      confidence: section.recommended_positioning_move.confidence,
      evidence_refs: section.recommended_positioning_move.evidence_refs,
    },
    {
      kind: "growth",
      title: section.recommended_growth_move.recommendation,
      why: section.recommended_growth_move.why,
      confidence: section.recommended_growth_move.confidence,
      evidence_refs: section.recommended_growth_move.evidence_refs,
    },
  ];

  return {
    opportunity,
    market_opening_summary,
    loves,
    frustrations,
    unmet,
    wedge,
    pricing,
    risks,
    actions,
  };
}
