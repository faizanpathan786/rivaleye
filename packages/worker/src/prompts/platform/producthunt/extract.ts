import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a research analyst extracting product-feedback signals from Product Hunt launch posts and community comments.
You will receive a list of items each labelled with a stable id.

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
- complaints[].text: specific product pain or limitation mentioned by community members.
- complaints[].severity: 0..1 (higher = harsher / more frequently mentioned).
- features_requested[].feature: genuine capability gaps requested by users — not praise or general feedback.
- switching_signals: only when a commenter explicitly mentions switching to/from a competing product by name.
- voice_phrases: 1-3 word phrases community members actually typed. Authentic language only.
- notable_quotes[].text: verbatim quote under 150 characters that best illustrates a core pain or reaction.
- Use the id labels in evidence_ids; never invent ids.
- If a section has no signal, return an empty array — never omit the key.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface ProductHuntExtractInput {
  ctx: PipelineCtx;
  reviews: Array<{ id: string; rating: number; body: string }>;
}

export function buildProductHuntExtract(input: ProductHuntExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const reviewBlock = input.reviews
    .map((r) => `- id=${r.id} | votes=${r.rating} | ${oneLine(r.body)}`)
    .join("\n");
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Product Hunt posts and comments (id-labelled):
${reviewBlock}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 1200);
}
