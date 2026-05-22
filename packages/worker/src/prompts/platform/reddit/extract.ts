import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Reddit posts and comment threads");

export interface RedditExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildRedditExtract(input: RedditExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | score=${p.score ?? 0} | ${truncate(p.body, 1500)}`)
    .join("\n");
  const user = `RELEVANCE FILTER: Only extract signals from posts discussing ${input.ctx.competitor} as a software product in the ${input.ctx.category} category. If a post uses the competitor name as a generic word or discusses an unrelated product, person, or topic, skip that post entirely — extract no signals from it.

Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Reddit posts and comment threads (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function truncate(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}
