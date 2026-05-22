import { stageAExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a competitive-intelligence analyst reading a competitor's marketing website.
You will receive a list of pages from the competitor's own marketing website, each labelled with a stable id.
This source is the competitor's own copy — not user feedback. Infer perception signals from what the site claims, shows, and omits.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "love_signals":    [{ "title": "3-6 word label", "summary": "1-2 sentences", "sentiment": 0.8, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [{ "author": "page type", "text": "verbatim", "evidence_id": "id1" }], "related_features": ["feature name"], "user_segment": null }],
  "pain_signals":    [{ "title": "...", "summary": "...", "sentiment": -0.5, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null }],
  "gap_signals":     [{ "title": "...", "summary": "...", "sentiment": -0.3, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null }],
  "switch_signals":  [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "direction": "inbound|outbound", "alternatives_mentioned": ["competitor name"] }],
  "pricing_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "tier_label": null, "quoted_price": null }],
  "feature_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "feature_name": "string", "perception": "loved|mixed|criticized" }],
  "positioning_signals": [{ "title": "...", "summary": "...", "sentiment": 0.0, "strength_or_severity": 0.0, "evidence_ids": ["id1"], "representative_quotes": [], "related_features": [], "user_segment": null, "angle": "the positioning claim the site makes", "against": null, "audience": null }],
  "voice_phrases":   { "positive": ["phrase"], "negative": ["phrase"] },
  "evidence_quotes": [{ "author": "page type", "text": "verbatim under 200 chars", "evidence_id": "id1", "signal_type": "love|pain|gap|switch|pricing|feature|positioning", "sentiment": null }]
}

Rules:
- love_signals: the competitor's strongest brand promises and differentiators — what they want users to love.
- pain_signals: problems the site explicitly claims to solve for prospects (these reveal the pain the competitor targets).
- gap_signals: capabilities conspicuously absent vs. typical market offerings, or "coming soon" language.
- feature_signals: named product capabilities the site advertises. perception defaults to "loved" (it is their own copy).
- positioning_signals: the positioning claims and category framing the site uses. angle = the claim; against = the competitor or status quo it positions against; audience = who the copy targets.
- pricing_signals: pricing-page facts — free tier, per-seat vs flat, enterprise-only, trial length. Put verbatim prices in quoted_price.
- switch_signals: only if a "vs" page, comparison table, or migration guide explicitly names a competitor. direction = "inbound".
- evidence_quotes[].author and representative_quotes[].author: the page type (e.g. "pricing page", "homepage", "customers page").
- sentiment: -1 to 1. strength_or_severity: 0 to 1.
- evidence_ids: use ONLY the id labels provided; never invent ids.
- If a section has no signal, return an empty array — never omit the key. Never invent data.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface WebsiteExtractInput {
  ctx: PipelineCtx;
  pages: Array<{ id: string; url: string; body: string }>;
}

export function buildWebsiteExtract(input: WebsiteExtractInput): {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
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

  return { system: SYSTEM, user, schema: stageAExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}
