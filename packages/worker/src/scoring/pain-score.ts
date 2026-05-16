// Pain score formula:
// painScore = (frequency_score * 0.35) + (intensity_score * 0.30) + (recency_score * 0.20) + (specificity_score * 0.15)
// Weights sum: 0.35 + 0.30 + 0.20 + 0.15 = 1.00

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computePainScore(input: {
  frequency: number;
  intensity: number; // 1-5
  recencyDays: number;
  specificity: number; // 1-5
}): number {
  const frequencyScore = clamp(input.frequency / 10, 0, 1) * 100;
  const intensityScore = ((input.intensity - 1) / 4) * 100;
  const recencyScore = clamp(1 - input.recencyDays / 365, 0, 1) * 100;
  const specificityScore = ((input.specificity - 1) / 4) * 100;

  const weighted =
    frequencyScore * 0.35 +
    intensityScore * 0.30 +
    recencyScore * 0.20 +
    specificityScore * 0.15;

  return clamp(Math.round(weighted), 0, 100);
}

export function computeClusterMetadata(
  evidencePostIds: string[],
  allMentions: Array<{ externalId: string; createdAt: Date | string | number }>
): { frequency: number; recencyDays: number } {
  const frequency = evidencePostIds.length;

  const evidenceSet = new Set(evidencePostIds);
  const matchedMentions = allMentions.filter((m) => evidenceSet.has(m.externalId));

  if (matchedMentions.length === 0) {
    return { frequency, recencyDays: 365 };
  }

  const nowMs = Date.now();
  const ageDays = matchedMentions
    .map((m) => {
      const ts =
        m.createdAt instanceof Date
          ? m.createdAt.getTime()
          : typeof m.createdAt === "number"
          ? m.createdAt
          : new Date(m.createdAt).getTime();
      return (nowMs - ts) / (1000 * 60 * 60 * 24);
    })
    .sort((a, b) => a - b);

  const mid = Math.floor(ageDays.length / 2);
  const recencyDays =
    ageDays.length % 2 === 1
      ? (ageDays[mid] as number)
      : (((ageDays[mid - 1] as number) + (ageDays[mid] as number)) / 2);

  return { frequency, recencyDays };
}
