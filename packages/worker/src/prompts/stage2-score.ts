import type { Stage2Input } from "./types";

export function buildStage2Prompt(input: Stage2Input): { system: string; user: string } {
  const system = `Rate each pain cluster for intensity and specificity. Output JSON only. No markdown fences.

Intensity (1-5): How strongly do users feel this pain?
  1 = vague frustration, passing mention
  2 = repeated annoyance, workarounds used
  3 = users actively complaining, productiviy impact
  4 = users threatening to leave or trying alternatives
  5 = users saying they cancelled, refunded, or switched because of this

Specificity (1-5): How concrete and actionable is this pain?
  1 = generic ("it's slow", "bad UX")
  2 = somewhat specific (a feature area is named)
  3 = specific (exact feature + failure mode named)
  4 = very specific (exact steps to reproduce, named workflows)
  5 = precise (named field, exact error, reproducible steps with context)

NOTE: Do not score frequency or recency — those are computed separately and will be merged later.

Output this exact JSON shape and nothing else:
{
  "scores": [
    {
      "cluster_id": "c001",
      "intensity": 4,
      "specificity": 3
    }
  ]
}`;

  const clustersText = input.clusters
    .map(
      (c) =>
        `Cluster ${c.id}: ${c.title}\nDescription: ${c.description}\nTop quotes:\n${c.top_quotes.map((q) => `  - "${q}"`).join("\n")}`,
    )
    .join("\n\n");

  const user = `Rate each of the following pain clusters:

${clustersText}`;

  return { system, user };
}
