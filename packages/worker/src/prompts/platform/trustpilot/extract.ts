import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from Trustpilot customer reviews.
You will receive a list of reviews each labelled with a stable id. Return ONE JSON object that conforms to the supplied schema.
Rules:
- Use the id labels in evidence_ids; never invent ids.
- complaints[].severity is 0..1 (higher = harsher).
- voice_phrases.positive and .negative are short (1-3 word) phrases customers actually used.
- switching_signals: only when a reviewer explicitly mentions switching to a competing product.
- Emphasise customer service experiences, onboarding friction, pricing pain, and support quality — these surface most in Trustpilot reviews.
- If a section has no signal, return an empty array — never fabricate.`;

export interface TrustpilotExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildTrustpilotExtract(input: TrustpilotExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | rating=${r.rating}/5 | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Trustpilot reviews (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
