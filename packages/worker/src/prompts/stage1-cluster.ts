import { ANTI_GENERIC_RULES, EVIDENCE_RULES, FOUNDER_LANGUAGE_RULES } from "./shared";
import type { Stage1Input } from "./types";

export function buildStage1Prompt(input: Stage1Input): { system: string; user: string } {
  const system = `You are analyzing Reddit posts to find real user pain. Output JSON only. No markdown fences.

${ANTI_GENERIC_RULES}

${EVIDENCE_RULES}

${FOUNDER_LANGUAGE_RULES}

Output this exact JSON shape and nothing else:
{
  "clusters": [
    {
      "id": "c001",
      "title": "3-7 word pain label",
      "description": "1-2 sentences: what breaks, for whom, how often",
      "evidence_post_ids": ["p001", "p002"],
      "voice_phrases": ["exact user quote verbatim", "another verbatim phrase"]
    }
  ]
}

Cluster rules:
- Group by USER PAIN, not by feature or product area.
- Only include clusters with ≥2 evidence posts from different authors.
- voice_phrases must be verbatim from the posts — not paraphrased. Extract exact phrases that appear ≥2 times or that are especially vivid.
- Do not create a cluster for praise or neutral feedback.`;

  const postsText = input.posts
    .map(
      (p) =>
        `[${p.id}] score=${p.score} ts=${p.created_utc}\nTitle: ${p.title}\n${p.body}`,
    )
    .join("\n\n---\n\n");

  const user = `Competitor: ${input.competitor}
Category: ${input.category}

Posts (${input.posts.length} total):

${postsText}

Group these posts into pain clusters. Remember: group by pain, not by feature. Only include clusters with ≥2 evidence posts.`;

  return { system, user };
}
