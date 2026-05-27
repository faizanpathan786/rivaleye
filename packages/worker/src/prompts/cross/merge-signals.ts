import { stageCMergeLlmSchema } from "../shared";
import type { PipelineCtx, PlatformBrief, StageAExtract } from "../shared";
import type { PlatformId } from "@rivaleye/scrapers";

const PLATFORM_SEMANTIC_CONTEXT = `Platform semantic weights for signal calibration:
- reddit: organic community opinions — strongest source for pain, love, switch intent, and authentic voice. High trust.
- appstore / playstore: star-rating user reviews — pain backed by low ratings is high-severity; 5-star love is strong retention proof.
- producthunt: early-adopter launch feedback — gap and feature requests are highly actionable; love signals reflect novelty (lower long-term retention weight).
- hackernews: developer/technical community — positioning critique and architecture concerns are credible; general consumer sentiment weight is lower.
- devto: developer tutorial ecosystem — integration gaps and DX complaints are credible; marketing/pricing signals carry less weight.
- website: competitor's own marketing copy — positioning signals and feature claims are authoritative facts about the competitor's self-image; pain/gap signals inferred from copy are lower-confidence than user-generated sources.
Apply this context when setting strength_or_severity — do NOT exclude evidence from any platform.`;

const SYSTEM = `You are a cross-platform competitor-perception analyst. You receive per-platform signal extracts and merge them into unified, deduplicated clusters — one set of clusters per signal type.

RivalEye captures what users really think about a competitor. Give love and pain EQUAL weight — love is a first-class signal, not an afterthought.

${PLATFORM_SEMANTIC_CONTEXT}

Return ONE JSON object with EXACTLY these keys (all required, never omit):
{
  "love_clusters":        [Cluster],
  "pain_clusters":        [Cluster + affected_segment, opportunity_implication],
  "gap_clusters":         [Cluster + workaround, product_opportunity],
  "switch_clusters":      [Cluster + direction:"inbound|outbound", competitor, alternatives[], urgency:"low|medium|high"],
  "pricing_clusters":     [Cluster + tier_label, quoted_prices[], affected_segment],
  "feature_clusters":     [Cluster + feature_name, perception:"loved|mixed|criticized", product_lesson],
  "positioning_clusters": [Cluster + angle, against, promise_vs_reality],
  "voice_top":            { "positive":[{word,count}], "negative":[{word,count}] },
  "cross_platform_themes":[{ theme, signal_type, platforms[], weight }]
}

Every Cluster has: id (kebab-slug, unique), title, summary, signal_type, strength_or_severity (0..1),
evidence_ids (string[]), representative_quotes ([{author,text,evidence_id}]), related_signal_ids (string[]),
role_relevance (ONLY values from ["founder","product","marketing","growth"] — no other strings allowed).

Rules:
1. Collapse semantically equivalent signals of the SAME type into one cluster; no duplicates.
   Do NOT cap the number of clusters — produce as many distinct clusters as the evidence supports,
   for EVERY signal type. There is no special target for pain.
2. love_clusters: what users praise, why they choose/stay, competitor strengths, stickiness reasons.
3. pain_clusters: repeated frustrations; affected_segment = who is hit; opportunity_implication = the opening.
4. gap_clusters: requested features / missing workflows; workaround = how users cope today.
5. switch_clusters: alternative-seeking / migration / churn intent; name the competitor and alternatives.
6. pricing_clusters: pricing complaints, value perception, plan-limit issues; quoted_prices verbatim.
7. feature_clusters: named features and how they land (loved | mixed | criticized) + a product_lesson.
8. positioning_clusters: repeated user language, category perception, objections, comparison framing.
9. evidence_ids: use ONLY the ids present in the input extracts. Include ALL member ids — never truncate.
   The array length is the true mention count.
10. strength_or_severity: 0 (weak) to 1 (intense). role_relevance: which ICP dashboards each cluster serves — MUST be a non-empty array containing only "founder", "product", "marketing", or "growth". Never use any other string.
11. related_signal_ids: cross-link clusters that are causally related (e.g. a pain to the gap that fixes it).
12. Never invent data; omit rather than fabricate. Return ONLY the JSON object. No prose, no markdown fences.`;

export interface SignalMergeInput {
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  signalExtracts: Array<{ platform: PlatformId; extract: StageAExtract }>;
}

// Cap evidence_quotes per platform so the prompt stays within a manageable size.
// Quotes referenced by signals take priority; remaining slots filled in order.
const MAX_EVIDENCE_QUOTES_PER_PLATFORM = 120;

function trimExtractForPrompt(extract: StageAExtract): StageAExtract {
  if (extract.evidence_quotes.length <= MAX_EVIDENCE_QUOTES_PER_PLATFORM) return extract;
  const allGroups = [
    extract.love_signals, extract.pain_signals, extract.gap_signals,
    extract.switch_signals, extract.pricing_signals, extract.feature_signals,
    extract.positioning_signals,
  ];
  const referencedIds = new Set<string>();
  for (const group of allGroups) {
    for (const s of group) {
      for (const id of s.evidence_ids) referencedIds.add(id);
    }
  }
  const prioritized = extract.evidence_quotes
    .filter((q) => referencedIds.has(q.evidence_id))
    .slice(0, MAX_EVIDENCE_QUOTES_PER_PLATFORM);
  if (prioritized.length < MAX_EVIDENCE_QUOTES_PER_PLATFORM) {
    const extras = extract.evidence_quotes
      .filter((q) => !referencedIds.has(q.evidence_id))
      .slice(0, MAX_EVIDENCE_QUOTES_PER_PLATFORM - prioritized.length);
    return { ...extract, evidence_quotes: [...prioritized, ...extras] };
  }
  return { ...extract, evidence_quotes: prioritized };
}

export function buildSignalMerge(input: SignalMergeInput): {
  system: string;
  user: string;
  schema: typeof stageCMergeLlmSchema;
} {
  const extractsBlock = input.signalExtracts
    .map((s) => `### platform=${s.platform}\n${JSON.stringify(trimExtractForPrompt(s.extract), null, 2)}`)
    .join("\n\n");

  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Goal: ${input.ctx.goal}

Platform briefs:
${JSON.stringify(input.briefs, null, 2)}

Per-platform signal extracts:
${extractsBlock}

Merge into unified multi-signal clusters. Return the JSON object now.`;

  return { system: SYSTEM, user, schema: stageCMergeLlmSchema };
}
