import { platformBriefSchema } from "../../shared";
import type { PipelineCtx, PlatformExtract } from "../../shared";

const SYSTEM = `You are a competitive intelligence analyst summarising marketing website signals into a platform-level brief.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "platform": "website",
  "headline": "string",
  "top_themes": [{ "theme": "string", "weight": 0.0 }],
  "sentiment": { "positive": 0.0, "neutral": 0.0, "negative": 0.0 },
  "most_quoted_competitors": ["string"],
  "evidence_coverage": 0.0
}

Rules:
- headline: a declarative sentence capturing the competitor's primary positioning claim or the most striking gap found on the site.
- top_themes[].weight values must sum to approximately 1 (±0.05). Weight themes by prominence in the marketing copy.
- sentiment: from the founder's perspective — how good or bad does this competitor's site make them look to prospects? positive = site is strong/polished, negative = gaps/weaknesses visible, neutral = balanced.
- most_quoted_competitors: names from switching_signals "inbound" entries (their claimed comparisons), or [] if none.
- evidence_coverage: fraction of distinct evidence ids referenced across all fields (0..1).
- Never invent data not present in the extract.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface WebsiteSummarizeInput {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}

export function buildWebsiteSummarize(input: WebsiteSummarizeInput): {
  system: string;
  user: string;
  schema: typeof platformBriefSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}
Platform: website

Extract:
${JSON.stringify(input.extract, null, 2)}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
