/**
 * product.ts — Product adapter (Phase 5b, Task G3)
 *
 * Maps `ProductViewSection` (doc-16 contract) to `ProductViewProps` (the
 * adapted prop shape the product.tsx page consumes).
 *
 * Drop list (mock-only fields with no contract source):
 *   - score.insight / score.focus / score.coverage
 *   - gaps[].requirement / effort / risk
 *   - decisions.*[].quote
 *   - clusterCards[].trend
 *   - roadmap[].impact enum (contract has expected_impact: number 0..1 — passed through)
 *
 * Renames applied:
 *   title → opportunity_title (roadmap items)
 *   problem → user_problem
 *   feature → suggested_feature
 *   why → why_now
 *   loves[].why → why_users_love_it
 *   loves[].lesson → product_lesson
 *   workflow[].step → workflow_name
 *   decisions.*[].evidence → evidence_count
 *
 * Derivations:
 *   - productAreas[] — heatmap rows aggregated from complaint_clusters_by_product_area
 *   - workflow friction enum — derived from impact 0..1 via bucketFloat
 *   - loves[].rec PascalCase → lowercase normalisation
 */

import {
  bucketFloat,
  type Confidence,
  type EvidenceRef,
} from "../dashboard-helpers";

// ─── Doc-16 input types ───────────────────────────────────────────────────────

type ProductArea =
  | "onboarding"
  | "performance"
  | "ux_navigation"
  | "collaboration"
  | "permissions"
  | "integrations"
  | "reporting_analytics"
  | "pricing_packaging"
  | "support_reliability";

type Recommendation = "learn" | "match" | "differentiate" | "ignore";

export type ComplaintClusterItem = {
  product_area: ProductArea;
  complaint_title: string;
  summary: string;
  frequency: number;
  severity: number;
  source_spread: number;
  impact_on_workflow: number;
  suggested_product_response: string | null;
  evidence_refs: EvidenceRef;
};

export type FeatureGapItem = {
  feature_gap: string;
  summary: string;
  mentions: number;
  sources: string[];
  severity: number;
  confidence: Confidence;
  user_segment: string | null;
  suggested_action: string | null;
  evidence_refs: EvidenceRef;
};

export type LovedCompetitorFeatureItem = {
  feature_name: string;
  why_users_love_it: string;
  positive_mentions: number;
  stickiness_level: number;
  recommendation: Recommendation;
  product_lesson: string | null;
  evidence_refs: EvidenceRef;
};

export type WorkflowFrictionItem = {
  workflow_name: string;
  friction_point: string;
  impact: number;
  frequency: number;
  affected_segment: string | null;
  suggested_improvement: string | null;
  evidence_refs: EvidenceRef;
};

export type RoadmapOpportunityItem = {
  opportunity_title: string;
  user_problem: string;
  suggested_feature: string;
  expected_impact: number;
  effort_estimate: "low" | "medium" | "high";
  confidence: Confidence;
  why_now: string | null;
  evidence_refs: EvidenceRef;
};

export type BuildAvoidLearnItem = {
  title: string;
  reason: string;
  evidence_count: number;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type ProductViewSection = {
  product_opportunity_score: {
    score: number;
    label: string;
    explanation: string;
    factors: {
      feature_gap_frequency: number;
      pain_severity: number;
      source_spread: number;
      user_urgency: number;
      competitor_love_strength: number;
    };
  };
  feature_gap_map: FeatureGapItem[];
  complaint_clusters_by_product_area: ComplaintClusterItem[];
  loved_competitor_features: LovedCompetitorFeatureItem[];
  workflow_friction: WorkflowFrictionItem[];
  roadmap_opportunities: RoadmapOpportunityItem[];
  build_avoid_learn: {
    build: BuildAvoidLearnItem[];
    avoid: BuildAvoidLearnItem[];
    learn: BuildAvoidLearnItem[];
  };
  confidence_summary: Confidence;
  evidence_refs: EvidenceRef;
};

// ─── Heatmap row (aggregated per product_area) ────────────────────────────────

/**
 * One row in the product-area heatmap.
 * Aggregated from all ComplaintClusterItem entries sharing the same product_area.
 *
 * - area          human-readable area label (formatted from enum key)
 * - volume        normalised cluster count (total clusters / max clusters in set)
 * - severity      average severity across clusters in this area (0..1)
 * - source_spread average source_spread across clusters (0..1)
 * - cluster_count raw number of distinct complaint clusters in this area
 */
export type HeatmapRow = {
  area: string;
  volume: number;
  severity: number;
  source_spread: number;
  cluster_count: number;
};

// ─── Output shape ─────────────────────────────────────────────────────────────

/** Adapted gap item — drops requirement/effort/risk, keeps severity as 0..1 float. */
export type AdaptedFeatureGap = {
  feature_gap: string;
  summary: string;
  mentions: number;
  sources: string[];
  severity: number;
  confidence: Confidence;
  user_segment: string | null;
  suggested_action: string | null;
  evidence_refs: EvidenceRef;
};

/** Adapted loved-feature item — rec is lowercase, field names match contract. */
export type AdaptedLovedFeature = {
  feature_name: string;
  why_users_love_it: string;
  positive_mentions: number;
  stickiness_level: number;
  recommendation: Recommendation;
  product_lesson: string | null;
  evidence_refs: EvidenceRef;
};

/** Adapted workflow step — friction bucket derived from impact 0..1. */
export type AdaptedWorkflowStep = {
  workflow_name: string;
  friction_point: string;
  friction: "low" | "medium" | "high";
  impact: number;
  frequency: number;
  affected_segment: string | null;
  suggested_improvement: string | null;
  evidence_refs: EvidenceRef;
};

/** Adapted roadmap item — impact kept as 0..1 float; dropped mock impact enum. */
export type AdaptedRoadmapItem = {
  opportunity_title: string;
  user_problem: string;
  suggested_feature: string;
  expected_impact: number;
  effort_estimate: "low" | "medium" | "high";
  confidence: Confidence;
  why_now: string | null;
  evidence_refs: EvidenceRef;
};

/** Adapted build/avoid/learn item — evidence_count is the integer count. */
export type AdaptedBuildAvoidLearnItem = {
  title: string;
  reason: string;
  evidence_count: number;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type AdaptedBuildAvoidLearn = {
  build: AdaptedBuildAvoidLearnItem[];
  avoid: AdaptedBuildAvoidLearnItem[];
  learn: AdaptedBuildAvoidLearnItem[];
};

/**
 * ProductViewProps — the adapted shape passed to the product page components.
 *
 * Dropped (mock-only, no contract source):
 *   - score.insight, score.focus, score.coverage
 *   - gaps[].requirement, effort, risk
 *   - decisions.*[].quote
 *   - clusterCards[].trend
 *   - roadmap[].impact enum (replaced by expected_impact 0..1 float)
 */
export type ProductViewProps = {
  /** Opportunity score widget — factors are the 5 fixed keys from the contract. */
  score: {
    value: number;
    label: string;
    explanation: string;
    factors: {
      feature_gap_frequency: number;
      pain_severity: number;
      source_spread: number;
      user_urgency: number;
      competitor_love_strength: number;
    };
  };

  /** Feature gap table rows. */
  gaps: AdaptedFeatureGap[];

  /**
   * Heatmap rows, one per distinct product_area found in
   * complaint_clusters_by_product_area.
   */
  productAreas: HeatmapRow[];

  /** Raw complaint cluster cards (severity/frequency for grid display). */
  clusterCards: Array<{
    complaint_title: string;
    product_area: string;
    frequency: number;
    severity: number;
    sources: string[];
    impact_on_workflow: number;
    suggested_product_response: string | null;
    evidence_refs: EvidenceRef;
  }>;

  /** Loved competitor features — rec is lowercase. */
  loves: AdaptedLovedFeature[];

  /** Workflow steps with derived friction bucket. */
  workflow: AdaptedWorkflowStep[];

  /** Roadmap opportunities — impact is 0..1 float (use bucketFloat in UI). */
  roadmap: AdaptedRoadmapItem[];

  /** Build / Avoid / Learn decision board. */
  decisions: AdaptedBuildAvoidLearn;

  /** Section-level confidence. */
  confidence_summary: Confidence;

  /** Section-level evidence rollup. */
  evidence_refs: EvidenceRef;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a ProductArea enum value into a human-readable label.
 * e.g. "ux_navigation" → "UX / Navigation"
 */
function formatAreaLabel(area: ProductArea): string {
  const overrides: Record<ProductArea, string> = {
    onboarding: "Onboarding",
    performance: "Performance",
    ux_navigation: "UX / Navigation",
    collaboration: "Collaboration",
    permissions: "Permissions / Admin",
    integrations: "Integrations",
    reporting_analytics: "Reporting / Analytics",
    pricing_packaging: "Pricing / Packaging",
    support_reliability: "Support / Reliability",
  };
  return overrides[area];
}

/**
 * Aggregate complaint clusters into one heatmap row per product_area.
 *
 * volume        = normalised cluster count within this run (count / max_count)
 * severity      = average severity across clusters in the area
 * source_spread = average source_spread across clusters in the area
 * cluster_count = raw count of distinct complaint clusters
 */
function aggregateHeatmapRows(clusters: ComplaintClusterItem[]): HeatmapRow[] {
  if (clusters.length === 0) return [];

  // Group by product_area
  const grouped = new Map<
    ProductArea,
    { severity: number; source_spread: number; count: number }
  >();

  for (const cluster of clusters) {
    const existing = grouped.get(cluster.product_area);
    if (existing === undefined) {
      grouped.set(cluster.product_area, {
        severity: cluster.severity,
        source_spread: cluster.source_spread,
        count: 1,
      });
    } else {
      existing.severity += cluster.severity;
      existing.source_spread += cluster.source_spread;
      existing.count += 1;
    }
  }

  // Find max count for volume normalisation
  let maxCount = 0;
  for (const entry of grouped.values()) {
    if (entry.count > maxCount) {
      maxCount = entry.count;
    }
  }

  const rows: HeatmapRow[] = [];
  for (const [area, entry] of grouped.entries()) {
    rows.push({
      area: formatAreaLabel(area),
      volume: maxCount > 0 ? entry.count / maxCount : 0,
      severity: entry.severity / entry.count,
      source_spread: entry.source_spread / entry.count,
      cluster_count: entry.count,
    });
  }

  return rows;
}

/** Normalise recommendation to lowercase. */
function normaliseRec(raw: string): Recommendation {
  const lower = raw.toLowerCase();
  if (
    lower === "learn" ||
    lower === "match" ||
    lower === "differentiate" ||
    lower === "ignore"
  ) {
    return lower;
  }
  // Fallback — if an unexpected value arrives, treat as "learn".
  return "learn";
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

/**
 * toProductViewProps — maps a doc-16 ProductViewSection to ProductViewProps.
 *
 * Pure function. No side effects. No `any`.
 */
export function toProductViewProps(section: ProductViewSection): ProductViewProps {
  // Score — keep factors object as-is (matches contract exactly)
  const score: ProductViewProps["score"] = {
    value: section.product_opportunity_score.score,
    label: section.product_opportunity_score.label,
    explanation: section.product_opportunity_score.explanation,
    factors: { ...section.product_opportunity_score.factors },
  };

  // Feature gaps — drop requirement/effort/risk (no contract source)
  const gaps: AdaptedFeatureGap[] = section.feature_gap_map.map((g) => ({
    feature_gap: g.feature_gap,
    summary: g.summary,
    mentions: g.mentions,
    sources: g.sources,
    severity: g.severity,
    confidence: g.confidence,
    user_segment: g.user_segment,
    suggested_action: g.suggested_action,
    evidence_refs: g.evidence_refs,
  }));

  // Heatmap — aggregate clusters by product_area
  const productAreas = aggregateHeatmapRows(
    section.complaint_clusters_by_product_area,
  );

  // Cluster cards — drop trend (mock-only), pass through everything else
  const clusterCards: ProductViewProps["clusterCards"] =
    section.complaint_clusters_by_product_area.map((c) => ({
      complaint_title: c.complaint_title,
      product_area: formatAreaLabel(c.product_area),
      frequency: c.frequency,
      severity: c.severity,
      // sources is not on ComplaintClusterItem in the contract — use empty array
      sources: [],
      impact_on_workflow: c.impact_on_workflow,
      suggested_product_response: c.suggested_product_response,
      evidence_refs: c.evidence_refs,
    }));

  // Loved features — normalise rec to lowercase
  const loves: AdaptedLovedFeature[] = section.loved_competitor_features.map(
    (l) => ({
      feature_name: l.feature_name,
      why_users_love_it: l.why_users_love_it,
      positive_mentions: l.positive_mentions,
      stickiness_level: l.stickiness_level,
      recommendation: normaliseRec(l.recommendation),
      product_lesson: l.product_lesson,
      evidence_refs: l.evidence_refs,
    }),
  );

  // Workflow — derive friction from impact via bucketFloat
  const workflow: AdaptedWorkflowStep[] = section.workflow_friction.map(
    (w) => ({
      workflow_name: w.workflow_name,
      friction_point: w.friction_point,
      friction: bucketFloat(w.impact),
      impact: w.impact,
      frequency: w.frequency,
      affected_segment: w.affected_segment,
      suggested_improvement: w.suggested_improvement,
      evidence_refs: w.evidence_refs,
    }),
  );

  // Roadmap — expected_impact passes through as 0..1 (UI buckets via bucketFloat)
  // Dropped: mock impact enum
  const roadmap: AdaptedRoadmapItem[] = section.roadmap_opportunities.map(
    (r) => ({
      opportunity_title: r.opportunity_title,
      user_problem: r.user_problem,
      suggested_feature: r.suggested_feature,
      expected_impact: r.expected_impact,
      effort_estimate: r.effort_estimate,
      confidence: r.confidence,
      why_now: r.why_now,
      evidence_refs: r.evidence_refs,
    }),
  );

  // Build / Avoid / Learn — evidence_count is already the integer count; drop quote
  const adaptDecisions = (
    items: BuildAvoidLearnItem[],
  ): AdaptedBuildAvoidLearnItem[] =>
    items.map((it) => ({
      title: it.title,
      reason: it.reason,
      evidence_count: it.evidence_count,
      confidence: it.confidence,
      evidence_refs: it.evidence_refs,
    }));

  const decisions: AdaptedBuildAvoidLearn = {
    build: adaptDecisions(section.build_avoid_learn.build),
    avoid: adaptDecisions(section.build_avoid_learn.avoid),
    learn: adaptDecisions(section.build_avoid_learn.learn),
  };

  return {
    score,
    gaps,
    productAreas,
    clusterCards,
    loves,
    workflow,
    roadmap,
    decisions,
    confidence_summary: section.confidence_summary,
    evidence_refs: section.evidence_refs,
  };
}
