import type { PainReportOutput } from "@rivaleye/shared";

export type ReportOutput = PainReportOutput;

export function pickAnswerHeroData(output: PainReportOutput): {
  topOpportunities: string[];
  positioningAngle: string | null;
  wedge: string | null;
} {
  return {
    topOpportunities: output.productOpportunities?.slice(0, 3) ?? [],
    positioningAngle: output.positioningAngles?.[0] ?? null,
    wedge: output.competitorWeaknesses?.[0] ?? output.painClusters?.[0]?.title ?? null,
  };
}
