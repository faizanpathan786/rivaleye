import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Google Play Store reviews");

export interface PlayStoreExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildPlayStoreExtract(input: PlayStoreExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
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
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
