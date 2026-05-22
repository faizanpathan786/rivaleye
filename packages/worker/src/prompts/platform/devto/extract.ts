import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const SYSTEM = buildSignalSystemPrompt("Dev.to articles and comments");

export interface DevToExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildDevToExtract(input: DevToExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | score=${p.score ?? "n/a"} | ${oneLine(p.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Dev.to posts (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
