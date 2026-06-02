import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("LinkedIn company posts and comments");

const LINKEDIN_CONTEXT = `\nLinkedIn context:
- Posts are from the competitor's official company page — treat them as product/positioning signals.
- Comments below posts often contain candid user reactions, complaints, and praise.
- Switch signals in comments are highly credible (users publicly comparing alternatives on a professional network).
- Pain signals in comments carry professional credibility — these are domain experts speaking.
- voice_phrases should preserve professional language, including industry jargon users actually wrote.`;

const SYSTEM = BASE_SYSTEM + LINKEDIN_CONTEXT;

export interface LinkedInExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; body: string; score?: number | null }>;
}

export function buildLinkedInExtract(input: LinkedInExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | ${truncate(p.body, 1500)}`)
    .join("\n");
  const user = `RELEVANCE FILTER: Only extract signals from posts discussing ${input.ctx.competitor} as a product or company. Skip posts about unrelated topics.

Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

LinkedIn posts and comments (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function truncate(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}
