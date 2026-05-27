import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Hacker News stories and comments");

const HN_CONTEXT = `\nHacker News context:
- Audience is developers, founders, and technical decision-makers — not general consumers.
- Every post represents a real technical user's perspective regardless of score — treat all posts equally when assessing signal strength.
- Prioritise positioning signals (how technical users frame and compare the product), feature signals (specific technical capabilities praised or criticized), and gap signals (missing developer-facing functionality).
- Pain signals from this source are especially credible for technical/API/reliability concerns.`;

const SYSTEM = BASE_SYSTEM + HN_CONTEXT;

export interface HackerNewsExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildHackerNewsExtract(input: HackerNewsExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | ${oneLine(p.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Hacker News posts (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
