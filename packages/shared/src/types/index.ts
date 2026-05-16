export type ReportStatus = "queued" | "running" | "completed" | "failed";

export interface PainCluster {
  title: string;
  description: string;
  evidence: string[];
}

/** @deprecated Use ReportOutput from schemas/report.ts instead */
export interface PainReportOutput {
  summary: string;
  painClusters: PainCluster[];
  featureGaps: string[];
  pricingPain: string;
  switchingSignals: string[];
  voiceOfCustomer: string[];
  competitorWeaknesses: string[];
  productOpportunities: string[];
  positioningAngles: string[];
  recommendedActions: string[];
}
