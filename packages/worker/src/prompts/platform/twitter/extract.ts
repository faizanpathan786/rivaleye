import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Twitter/X posts and replies");

const TWITTER_CONTEXT = `\nTwitter/X context:
- Posts are public tweets mentioning the competitor — they represent real-time, unfiltered opinions.
- Pain signals are high-signal: users publicly complain on Twitter when frustrated beyond a threshold.
- Switch signals mentioning alternatives are extremely actionable — users announcing they are leaving.
- Love signals in replies show what advocates say to defend or recommend the product.
- voice_phrases should preserve tweet language including abbreviations, hashtags, and casual phrasing.
- Ignore promotional tweets from the competitor's own account.`;

const SYSTEM = BASE_SYSTEM + TWITTER_CONTEXT;

export interface TwitterExtractInput {
  ctx: PipelineCtx;
  tweets: Array<{ id: string; body: string; score?: number | null; author: string | null }>;
}

export function buildTwitterExtract(input: TwitterExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const tweetBlock = input.tweets
    .map((t) => `- id=${t.id}${t.author ? ` | author=${t.author}` : ""} | ${truncate(t.body, 1000)}`)
    .join("\n");
  const user = `RELEVANCE FILTER: Only extract signals from tweets discussing ${input.ctx.competitor} as a software product in the ${input.ctx.category} category. Skip unrelated mentions.

Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Tweets (id-labelled):
${tweetBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function truncate(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}
