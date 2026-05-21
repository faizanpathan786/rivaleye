import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from Reddit posts and comment threads.
You will receive a list of posts each labelled with a stable id.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "complaints": [{ "text": "string", "severity": 0.0, "evidence_ids": ["id1"] }],
  "features_requested": [{ "feature": "string", "evidence_ids": ["id1"] }],
  "pricing_signals": [{ "note": "string", "evidence_ids": ["id1"] }],
  "switching_signals": [{ "direction": "inbound|outbound", "competitor": "string", "evidence_ids": ["id1"] }],
  "voice_phrases": { "positive": ["phrase"], "negative": ["phrase"] },
  "notable_quotes": [{ "author": "string", "text": "string", "evidence_id": "id1" }]
}

Rules:
- complaints[].text: describe the specific product pain. Use "text", never "description" or any other key.
- complaints[].severity: 0..1 (higher = more severe / more frequently mentioned).
- features_requested[].feature: only include genuine product capability gaps — things the product should do but doesn't. DO NOT include posts where the user is asking "where can I find an alternative to X" or "does anyone know of a tool that does X". Those are switching signals, not feature gaps. A real feature gap looks like: "Linear doesn't support recurring tasks" or "No nested subtask depth limit configuration".
- switching_signals: only when a poster explicitly mentions switching to/from a competing product by name.
- voice_phrases: 1-3 word phrases the users actually typed. Authentic language only — no paraphrasing.
- notable_quotes[].text: verbatim quote from a post, under 150 characters, that best illustrates a core pain about the Competitor software. Must be actual user text, not a summary.
- notable_quotes[].author: the Reddit username of the poster (from the post data).
- Use the id labels in evidence_ids; never invent ids.
- If a section has no signal, return an empty array — never omit the key.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface RedditExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildRedditExtract(input: RedditExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
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
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function truncate(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}
