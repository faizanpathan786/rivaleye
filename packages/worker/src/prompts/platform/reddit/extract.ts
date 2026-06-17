import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Reddit posts and comment threads");

const REDDIT_CONTEXT = `\nReddit context:
- Every post represents a real user's organic, unfiltered opinion — treat all posts equally regardless of score.
- Pain signals here are especially credible because Reddit users speak candidly without brand incentives.
- Switch signals mentioning named alternatives are extremely actionable — users are explicitly asking for or announcing alternatives.
- voice_phrases should prioritise verbatim phrases users actually typed, not paraphrases.`;

const SYSTEM = BASE_SYSTEM + REDDIT_CONTEXT;

export interface RedditExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string; author: string | null }>;
}

export function buildRedditExtract(input: RedditExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id}${p.author ? ` | author=${p.author}` : ""} | ${truncate(p.body, 1500)}`)
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
