export { computePainScore, computeClusterMetadata } from "./pain-score.js";
export { computeOpportunityScore, pickTopOpportunities } from "./opportunity-score.js";

export type ClusterScores = {
  pain_score: number;
  intensity: number;
  specificity: number;
  recency_days: number;
  frequency: number;
};

export type OpportunityScores = {
  opportunity_score: number;
  market_pain: number;
  differentiation: number;
  evidence_count: number;
};
