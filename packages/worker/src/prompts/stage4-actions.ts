import type { Stage4Input } from "./types";

const GOAL_ACTION_VARIANTS: Record<string, string> = {
  validate_idea:
    "Prioritize actions that get the founder talking to real users fast. Include specific subreddits to post in, communities to join, and questions to ask.",
  find_user_pain:
    "Prioritize actions that surface more pain data. Name specific places to find users, exact interview questions to ask, and signals to watch.",
  improve_positioning:
    "Prioritize actions that sharpen messaging. Include specific copy to test, landing page angles to try, and competitor comparisons to make explicit.",
  decide_mvp_features:
    "Prioritize actions that validate the top feature gaps. Include prototype ideas, specific users to recruit for testing, and success metrics.",
  compare_alternatives:
    "Prioritize actions that intercept users switching away from the competitor. Name specific communities, comparison keywords, and acquisition angles.",
  find_weaknesses:
    "Prioritize actions that exploit the competitor's specific vulnerabilities. Name the exact weakness to attack and how to make it visible to buyers.",
};

export function buildStage4Prompt(input: Stage4Input): { system: string; user: string } {
  const goalInstruction =
    GOAL_ACTION_VARIANTS[input.founderGoal] ??
    "Prioritize the actions most likely to move the needle for a founder this week.";

  const system = `Generate 3-7 concrete next actions for a founder. Output JSON only. No markdown fences.

Action rules — non-negotiable:
- Every action must cite ≥1 cluster_id from the pain clusters provided.
- No vague advice.
  Bad: "improve your marketing"
  Good: "Post in r/entrepreneur with a specific angle about ${input.competitor} pricing — cluster c002 shows users hate the per-seat model"
- Each action must be something a founder can do within the next 7 days.
- Include the specific "why" grounded in the cluster evidence, not generic reasoning.

Goal-specific emphasis: ${goalInstruction}

Output this exact JSON shape and nothing else:
{
  "actions": [
    {
      "action": "string — specific, concrete, doable this week",
      "cluster_ids": ["c001"],
      "why": "string — cite the specific pain and evidence that makes this action worth doing"
    }
  ]
}`;

  const opportunitiesText = input.stage3Summary.topOpportunities
    .map((o, i) => `  ${i + 1}. ${o}`)
    .join("\n");

  const clustersText = input.stage3Summary.topPainClusters
    .map((c, i) => `  ${i + 1}. ${c}`)
    .join("\n");

  const user = `Competitor: ${input.competitor}
Founder goal: ${input.founderGoal}

Top opportunities identified:
${opportunitiesText}

Best wedge: ${input.stage3Summary.bestWedge}

Top pain clusters:
${clustersText}

Generate 3-7 concrete next actions. Each action must cite ≥1 cluster_id and be doable within 7 days.`;

  return { system, user };
}
