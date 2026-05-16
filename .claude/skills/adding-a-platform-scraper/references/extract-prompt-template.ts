import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from <PLATFORM> posts.
You will receive a list of posts each labelled with a stable id. Return ONE JSON object that conforms to the supplied schema.
Rules:
- Use the id labels in evidence_ids; never invent ids.
- complaints[].severity is 0..1 (higher = harsher).
- voice_phrases.positive and .negative are short (1-3 word) phrases users actually used.
- switching_signals: only when a post explicitly mentions another competing product.
- If a section has no signal, return an empty array — never fabricate.`;

export interface ExampleExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildExampleExtract(input: ExampleExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const postBlock = input.posts
    .map((p) => `- id=${p.id} | score=${p.score ?? "n/a"} | ${oneLine(p.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

<PLATFORM> posts (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}
