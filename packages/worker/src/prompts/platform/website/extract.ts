import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a competitive intelligence analyst reading a competitor's marketing website.
You will receive a list of pages from the competitor's website, each labelled with a stable id.
Your task: extract product signals that help founders understand the competitor's positioning and capability gaps.

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
- complaints[].text: A capability gap, limitation, or pain point implied by the site — e.g., "no self-serve pricing", "enterprise-only tier", "missing API docs", "no offline mode listed". These are inferred from what's ABSENT or from "coming soon" language, not user complaints. Severity 0.3–0.8.
- features_requested[].feature: Capabilities implied to be in development, on the roadmap, or conspicuously absent vs. typical market offerings.
- pricing_signals[].note: What can be inferred about pricing — free tier, per-seat vs flat, enterprise-only, trial length, price anchoring copy. Extract verbatim price points if visible.
- switching_signals: Only if the site explicitly names a competitor in a "vs" page, comparison table, or migration guide. direction = "inbound" (they claim users switch FROM that competitor TO this product).
- voice_phrases: Marketing phrases and slogans from the copy. Positive = brand promises. Negative = problems they claim to solve for prospects.
- notable_quotes[].text: Verbatim copy under 150 chars that captures a key positioning claim or differentiator. author = page type (e.g., "pricing page", "homepage", "customers page").
- Use the id labels in evidence_ids; never invent ids.
- If a section has no signal, return an empty array — never omit the key.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface WebsiteExtractInput {
  ctx: PipelineCtx;
  pages: Array<{ id: string; url: string; body: string }>;
}

export function buildWebsiteExtract(input: WebsiteExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const pageBlock = input.pages
    .map((p) => `--- id=${p.id} | url=${p.url}\n${oneLine(p.body)}`)
    .join("\n\n");

  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Website pages (id-labelled):
${pageBlock}

Return the JSON object now.`;

  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}
