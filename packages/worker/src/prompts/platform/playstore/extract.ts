import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from Google Play Store reviews.
You will receive a list of reviews each labelled with a stable id. Return ONE JSON object that conforms to the supplied schema.
Rules:
- Use the id labels in evidence_ids; never invent ids.
- complaints[].severity is 0..1 (higher = harsher).
- voice_phrases.positive and .negative are short (1-3 word) phrases users actually used.
- switching_signals: only when a reviewer explicitly mentions another competing product.
- Play Store reviews have no title — the full signal is in the body.
- If a section has no signal, return an empty array — never fabricate.`;

export interface PlayStoreExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildPlayStoreExtract(input: PlayStoreExtractInput): {
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

Google Play Store reviews (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
