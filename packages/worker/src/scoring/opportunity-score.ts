// Opportunity score formula:
// opportunityScore = Math.round((marketPain * 0.50) + (differentiation * 0.35) + (evidenceCount_score * 0.15))
// Weights sum: 0.50 + 0.35 + 0.15 = 1.00

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeOpportunityScore(input: {
  marketPain: number; // 0-100
  differentiation: number; // 0-100
  evidenceCount: number;
}): number {
  const evidenceCountScore = clamp(input.evidenceCount / 20, 0, 1) * 100;

  const weighted =
    input.marketPain * 0.50 +
    input.differentiation * 0.35 +
    evidenceCountScore * 0.15;

  return clamp(Math.round(weighted), 0, 100);
}

export function pickTopOpportunities<
  T extends { scores?: { opportunity_score?: number; evidence_count?: number } }
>(opportunities: T[], n = 3): T[] {
  return [...opportunities]
    .sort((a, b) => {
      const scoreA = a.scores?.opportunity_score ?? 0;
      const scoreB = b.scores?.opportunity_score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const evidenceA = a.scores?.evidence_count ?? 0;
      const evidenceB = b.scores?.evidence_count ?? 0;
      return evidenceB - evidenceA;
    })
    .slice(0, n);
}
