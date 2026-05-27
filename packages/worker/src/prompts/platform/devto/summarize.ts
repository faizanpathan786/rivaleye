import { platformBriefSchema } from "../../shared";
import type { PipelineCtx, PlatformExtract } from "../../shared";

const SYSTEM = `You are a research analyst summarising Dev.to feedback into a platform-level brief.

Return ONE JSON object with EXACTLY these keys (all required, never omit any):
{
  "platform": "devto",
  "headline": "string",
  "top_themes": [{ "theme": "string", "weight": 0.0 }],
  "sentiment": { "positive": 0.0, "neutral": 0.0, "negative": 0.0 },
  "most_quoted_competitors": ["string"],
  "evidence_coverage": 0.0
}

Rules:
- platform must always be "devto" (exactly that string).
- headline must be a declarative sentence (not a question, not a fragment).
- top_themes[].weight values must sum to approximately 1 (±0.05).
- sentiment.positive + sentiment.neutral + sentiment.negative must equal exactly 1.
- most_quoted_competitors: list competitor names mentioned; empty array [] if none.
- evidence_coverage is the fraction of distinct evidence ids referenced (0..1).
- Dev.to skews developer experience — weight DX and tooling themes accordingly.
- Never invent data not present in the extract; omit rather than fabricate.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface DevToSummarizeInput {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}

export function buildDevToSummarize(input: DevToSummarizeInput): {
  system: string;
  user: string;
  schema: typeof platformBriefSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}
Platform: devto

Extract:
${JSON.stringify(input.extract, null, 2)}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
