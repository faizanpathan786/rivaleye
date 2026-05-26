import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Product Hunt launch posts and community comments");

const PH_CONTEXT = `\nProduct Hunt context:
- votes = upvotes from the PH community at launch. High votes signal strong early-adopter resonance.
- Gap and feature request signals here are highly actionable — early adopters explicitly state what they wish the product had.
- Love signals reflect launch excitement; apply a moderate retention weight (novelty enthusiasm, not long-term stickiness).
- Switch signals naming alternatives are especially credible — early adopters are actively evaluating the market.`;

const SYSTEM = BASE_SYSTEM + PH_CONTEXT;

export interface ProductHuntExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildProductHuntExtract(input: ProductHuntExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | votes=${r.rating} | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Product Hunt posts and comments (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
