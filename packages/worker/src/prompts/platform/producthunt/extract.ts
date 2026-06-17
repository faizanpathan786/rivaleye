import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Product Hunt launch posts and community comments");

const PH_CONTEXT = `\nProduct Hunt context:
- Audience is early adopters, indie hackers, and founders — every comment represents a real person's first impression.
- Treat all posts equally regardless of vote count — a single user's feature request or pain point is as valid as a highly-upvoted one.
- Gap and feature request signals are highly actionable — early adopters explicitly state what they wish the product had.
- Switch signals naming alternatives are especially credible — early adopters are actively evaluating the market.`;

const SYSTEM = BASE_SYSTEM + PH_CONTEXT;

export interface ProductHuntExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string; author: string | null }>;
}

export function buildProductHuntExtract(input: ProductHuntExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id}${r.author ? ` | author=${r.author}` : ""} | ${oneLine(r.body)}`)
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
