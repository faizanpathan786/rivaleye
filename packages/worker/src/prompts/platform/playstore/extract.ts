import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Google Play Store reviews");

const RATING_CALIBRATION = `\nStar-rating calibration rules (apply to strength_or_severity and sentiment):
- rating 1–2: strong pain signal. Set strength_or_severity ≥ 0.7 for pain; sentiment ≤ -0.5.
- rating 3: mixed. Weight feature and gap signals. Sentiment near 0.
- rating 4–5: love signal. Set strength_or_severity ≥ 0.6 for love; sentiment ≥ 0.5.
A review's rating is the most reliable sentiment proxy — weight it more than tone alone.`;

const SYSTEM = BASE_SYSTEM + RATING_CALIBRATION;

export interface PlayStoreExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string; author: string | null }>;
}

export function buildPlayStoreExtract(input: PlayStoreExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | rating=${r.rating}/5${r.author ? ` | author=${r.author}` : ""} | ${oneLine(r.body)}`)
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
