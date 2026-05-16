import { reportOutputSchema, type ReportOutput } from "@rivaleye/shared";
import { FinalShapeError } from "./errors.js";

type InternalCluster = {
  id: string;
  title: string;
  description: string;
  frequency: number;
  evidence: { post_ids: string[]; top_quotes: string[] };
  scores?: { pain_score: number; intensity: number; specificity: number; recency_days: number };
};

type InternalShape = {
  executiveSummary: string;
  topOpportunities: Array<{
    title: string;
    description: string;
    evidence: { post_ids: string[]; top_quotes: string[] };
    scores?: { opportunity_score: number; market_pain: number; differentiation: number; evidence_count: number };
  }>;
  strongestPositioningAngle: string;
  bestWedge: string;
  painClusters: InternalCluster[];
  extraClusters?: InternalCluster[];
  featureGaps: Array<{ title: string; description: string; evidence: { post_ids: string[]; top_quotes: string[] }; priority?: "high" | "medium" | "low" }>;
  pricingPain: string;
  switchingSignals: Array<{ signal: string; evidence: { post_ids: string[]; top_quotes: string[] } }>;
  voiceOfCustomer: string[];
  competitorWeaknesses: string[];
  productOpportunities: string[];
  positioningAngles: string[];
  nextActions: string[];
  sources: Array<{ post_id: string; url?: string; title?: string; subreddit?: string; score?: number; created_utc?: number }>;
  meta?: { pipeline_version: string; model_tier?: string; warnings?: string[] };
};

export function toWireShape(internal: InternalShape): ReportOutput {
  const wire = {
    executive_summary: internal.executiveSummary,
    top_opportunities: internal.topOpportunities.slice(0, 3).map((o) => ({
      title: o.title,
      description: o.description,
      evidence: o.evidence,
      scores: o.scores,
    })),
    strongest_positioning_angle: internal.strongestPositioningAngle,
    best_wedge: internal.bestWedge,
    pain_clusters: internal.painClusters.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      frequency: c.frequency,
      evidence: c.evidence,
      scores: c.scores,
    })),
    extra_clusters: internal.extraClusters?.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      frequency: c.frequency,
      evidence: c.evidence,
      scores: c.scores,
    })),
    feature_gaps: internal.featureGaps.map((f) => ({
      title: f.title,
      description: f.description,
      evidence: f.evidence,
      priority: f.priority,
    })),
    pricing_pain: internal.pricingPain,
    switching_signals: internal.switchingSignals.map((s) => ({
      signal: s.signal,
      evidence: s.evidence,
    })),
    voice_of_customer: internal.voiceOfCustomer,
    competitor_weaknesses: internal.competitorWeaknesses,
    product_opportunities: internal.productOpportunities,
    positioning_angles: internal.positioningAngles,
    next_actions: internal.nextActions,
    sources: internal.sources,
    meta: internal.meta,
  };

  try {
    return reportOutputSchema.parse(wire);
  } catch (err) {
    throw new FinalShapeError(err);
  }
}
