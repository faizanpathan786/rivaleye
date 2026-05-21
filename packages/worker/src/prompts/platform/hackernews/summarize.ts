import { platformBriefSchema } from "../../shared";
import type { PipelineCtx, PlatformExtract } from "../../shared";

const SYSTEM = `You are a research analyst summarising Hacker News feedback into a platform-level brief.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "platform": "hackernews",
  "headline": "string",
  "top_themes": [{ "theme": "string", "weight": 0.0 }],
  "sentiment": { "positive": 0.0, "neutral": 0.0, "negative": 0.0 },
  "most_quoted_competitors": ["string"],
  "evidence_coverage": 0.0
}

Rules:
- headline: a declarative sentence (not a question, not a fragment).
- top_themes[].weight values must sum to approximately 1 (±0.05). HN skews technical — weight technical themes accordingly.
- sentiment.positive + sentiment.neutral + sentiment.negative must equal exactly 1.
- most_quoted_competitors: list competitor names mentioned in switching signals, or [] if none.
- evidence_coverage: fraction of distinct evidence ids referenced across all fields (0..1).
- Never invent data not present in the extract.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface HackerNewsSummarizeInput {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}

export function buildHackerNewsSummarize(input: HackerNewsSummarizeInput): {
  system: string;
  user: string;
  schema: typeof platformBriefSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}
Platform: hackernews

Extract:
${JSON.stringify(input.extract, null, 2)}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
