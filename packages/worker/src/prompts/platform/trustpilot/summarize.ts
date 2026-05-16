import { platformBriefSchema } from "../../shared";
import type { PipelineCtx, PlatformExtract } from "../../shared";

const SYSTEM = `You are a research analyst summarising Trustpilot customer reviews into a platform-level brief.
Return ONE JSON object that conforms to the supplied schema.
Rules:
- headline must be a declarative sentence (not a question, not a fragment).
- top_themes[].weight values must sum to approximately 1 (±0.05).
- sentiment.positive + sentiment.neutral + sentiment.negative must equal exactly 1.
- evidence_coverage is the fraction of distinct evidence ids referenced across all fields (0..1).
- Focus on customer service quality, onboarding friction, and pricing pain — signals Trustpilot surfaces best.
- Never invent data not present in the extract; omit rather than fabricate.`;

export interface TrustpilotSummarizeInput {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}

export function buildTrustpilotSummarize(input: TrustpilotSummarizeInput): {
  system: string;
  user: string;
  schema: typeof platformBriefSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}
Platform: trustpilot

Extract:
${JSON.stringify(input.extract, null, 2)}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
