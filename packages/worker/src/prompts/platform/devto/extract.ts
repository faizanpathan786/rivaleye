import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";
import { buildSignalSystemPrompt } from "../_shared/signal-extraction-rules";

const BASE_SYSTEM = buildSignalSystemPrompt("Dev.to articles and comments");

const DEVTO_CONTEXT = `\nDev.to context:
- Audience is software developers and engineers writing from hands-on experience — every post is a practitioner opinion.
- Treat all posts equally regardless of reaction count or reading time.
- Feature signals and gap signals are especially credible here — developers describe exactly what works and what is missing from a technical standpoint.
- Pain signals about DX (developer experience), API quality, SDK issues, and documentation gaps are high-value.
- Positioning signals reflect how the developer community categorises and compares tools — weight these for technical audience targeting.`;

const SYSTEM = BASE_SYSTEM + DEVTO_CONTEXT;

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
