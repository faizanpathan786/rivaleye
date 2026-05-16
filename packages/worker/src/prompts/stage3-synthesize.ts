import { ANTI_GENERIC_RULES, BLOCKED_PHRASES, FOUNDER_LANGUAGE_RULES, EVIDENCE_RULES } from "./shared";
import type { Stage3Input } from "./types";

const GOAL_VARIANTS: Record<string, string> = {
  validate_idea:
    "Focus on pain intensity and market demand. Does this market hurt enough to build for? Be direct: yes or no, and why.",
  find_user_pain:
    "Identify and rank the deepest, most repeated pains. Be specific. Name the exact feature, workflow, or situation that causes each pain.",
  improve_positioning:
    "Expand positioning_angles to ≥5 entries with full messaging copy. Each angle must name a specific competitor weakness and a concrete alternative you offer.",
  decide_mvp_features:
    "Expand feature_gaps with priority ranking (high/medium/low). Focus on what users are explicitly asking for by name, not what you infer they want.",
  compare_alternatives:
    "Focus on switching signals and why users look for alternatives. What is the last straw that pushes them out? What do they look for next?",
  find_weaknesses:
    "Focus on competitor_weaknesses. Where is the competitor most vulnerable? Rank weaknesses by exploitability — where could a new entrant win immediately?",
};

export function buildStage3Prompt(input: Stage3Input): { system: string; user: string } {
  const goalInstruction =
    GOAL_VARIANTS[input.founderGoal] ??
    "Provide a complete competitive analysis optimized for a founder deciding what to build.";

  const blockedList = BLOCKED_PHRASES.map((p) => `  - "${p}"`).join("\n");

  const system = `You are a competitive intelligence analyst writing for a founder who ships code this week. Output JSON only. No markdown fences.

${ANTI_GENERIC_RULES}

${EVIDENCE_RULES}

${FOUNDER_LANGUAGE_RULES}

BANNED PHRASES — never use these exact strings in your output:
${blockedList}

Founder goal for this report: ${goalInstruction}

Output must include exactly these keys and nothing else:
{
  "executive_summary": "3-5 sentences. Opinionated. Name the top pain and the biggest opportunity.",
  "top_opportunities": [
    {
      "title": "string",
      "description": "string — what to build and why",
      "evidence": { "post_ids": ["p001"], "top_quotes": ["verbatim"] }
    }
  ],
  "strongest_positioning_angle": "The single sharpest angle. Full messaging copy, not a label.",
  "best_wedge": "The narrowest, most winnable entry point into this market. Be specific.",
  "pain_clusters": [
    {
      "id": "c001",
      "title": "string",
      "description": "string",
      "frequency": 0,
      "evidence": { "post_ids": [], "top_quotes": [] },
      "scores": { "pain_score": 0, "intensity": 0, "specificity": 0, "recency_days": 0 }
    }
  ],
  "feature_gaps": [
    {
      "title": "string",
      "description": "string",
      "evidence": { "post_ids": [], "top_quotes": [] },
      "priority": "high"
    }
  ],
  "pricing_pain": "string — exact complaints about pricing, not a summary",
  "switching_signals": [
    { "signal": "string", "evidence": { "post_ids": [], "top_quotes": [] } }
  ],
  "voice_of_customer": ["verbatim user phrase"],
  "competitor_weaknesses": ["string — specific, citable weakness"],
  "product_opportunities": ["string — specific product idea"],
  "positioning_angles": ["string — full messaging copy"],
  "next_actions": ["string — concrete action with cluster_id cited"]
}

Rules:
- top_opportunities must contain exactly 3 items.
- Every array item must cite at least one evidence post_id.
- voice_of_customer entries must be verbatim user quotes, not paraphrases.`;

  const clustersText = input.rankedClusters
    .map(
      (c) =>
        `Cluster ${c.id} (pain_score=${c.pain_score}): ${c.title}\n` +
        `Description: ${c.description}\n` +
        `Evidence posts: ${c.evidence_post_ids.join(", ")}\n` +
        `Voice phrases: ${c.voice_phrases.map((v) => `"${v}"`).join(", ")}`,
    )
    .join("\n\n");

  const user = `Competitor: ${input.competitor}
Category: ${input.category}
Founder goal: ${input.founderGoal}

Ranked pain clusters (${input.rankedClusters.length} total, sorted by pain_score descending):

${clustersText}

Synthesize a full Competitor Pain Report from these clusters. Follow the output schema exactly.`;

  return { system, user };
}
