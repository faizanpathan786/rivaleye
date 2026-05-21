import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from Hacker News discussions.
You will receive a list of stories and comments each labelled with a stable id.

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
- complaints[].text: specific technical pain point or product limitation.
- complaints[].severity: 0..1 (higher = harsher / more frequently mentioned).
- features_requested[].feature: genuine capability gaps only — not praise or general commentary.
- switching_signals: only when a post explicitly mentions switching to/from a competing product by name.
- voice_phrases: 1-3 word phrases users actually typed. HN skews technical — capture precise technical language.
- notable_quotes[].text: verbatim quote under 150 characters that best illustrates a core pain.
- Use the id labels in evidence_ids; never invent ids.
- If a section has no signal, return an empty array — never omit the key.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface HackerNewsExtractInput {
  ctx: PipelineCtx;
  posts: Array<{ id: string; score: number | null; body: string }>;
}

export function buildHackerNewsExtract(input: HackerNewsExtractInput): {
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

Hacker News posts (id-labelled):
${postBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
