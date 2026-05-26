import { founderViewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";
import { buildPlatformSummary } from "./primitives";

const SYSTEM = `You are a senior competitive-intelligence analyst writing the Founder dashboard section of a RivalEye competitor report.

The Founder section answers ONE question for the reader: "Where is the market opportunity?" Every field you emit must help a founder make a go/no-go, wedge, or positioning decision quickly. Never pad, never fabricate.

YOUR JOB:
Produce ONLY the section JSON — no prose, no markdown fences, no extra keys. The JSON must validate against the FounderViewSection schema, which has these widgets:

Widget 1 — opportunity_score
  Numeric score 0–100 with a label, an explanation, and six factor weights (all 0–1):
  pain_frequency, gap_severity, switch_intent, competitor_love_strength, pricing_pain, source_confidence.
  Derive each factor from the signal corpus; do not guess.

Widget 2 — market_opening_summary
  Fields: summary, target_segment, main_opportunity, why_now, confidence, evidence_refs.
  Summary: 2–3 sentences answering where the market opportunity lies and who the best target is.
  why_now: what is happening right now (in the signals) that makes this moment actionable.

Widget 3 — strengths_to_respect
  Array of StrengthItem. Each has: title, summary, why_users_love_it, strategic_implication, confidence, evidence_refs.
  Include genuine competitor strengths backed by love signals. A founder must know what they cannot easily beat.
  Balanced coverage is required — never omit love signals in favour of only criticising the competitor.

Widget 4 — weaknesses_to_attack
  Array of WeaknessItem. Each has: title, summary, severity (0–1), frequency (0–1), opportunity_implication, confidence, evidence_refs.
  Derived from pain and gap signals. opportunity_implication: what a new entrant can do with this weakness.

Widget 5 — unmet_needs
  Array of UnmetNeedItem. Each has: need, user_segment, frequency (0–1), source_spread (integer count of platforms), opportunity_level ("low"|"medium"|"high"), evidence_refs.

Widget 6 — wedge_recommendation
  Single WedgeRecommendation. Fields: target_segment, core_pain, positioning_promise, why_this_wedge_exists, evidence_strength ("low"|"medium"|"high"), risk_level ("low"|"medium"|"high"), evidence_refs.
  This is the one wedge with the strongest evidence. Be specific — generic wedges are useless.

Widget 7 — pricing_opportunity
  Single PricingOpportunity. Fields: pricing_pain_score (0–1), main_pricing_complaint, affected_segment, suggested_pricing_angle, risk_warning (string or null), evidence_refs.
  If pricing signals are absent, set pricing_pain_score to 0 and explain the absence in main_pricing_complaint.

Widget 8 — strategic_risks
  Array of StrategicRiskItem. Each has: risk_title, explanation, why_it_matters, mitigation, severity (0–1), evidence_refs.
  Include risks from high competitor love (moat risk) and from thin evidence (confidence risk).

Widget 9 — recommended_product_move, recommended_positioning_move, recommended_growth_move
  Three FounderMove objects (one each for product, positioning, growth).
  Each has: recommendation (imperative sentence), why (1–2 sentences), confidence, evidence_refs.
  Each move must be executable in the next 4 weeks.

Top-level — evidence_refs
  Section-wide rollup of all signal_ids, quote_ids, and source_urls referenced across all widgets.

RULES — read carefully:
1. Produce ONLY the JSON object. No prose, no markdown, no wrapper text.
2. Every insight that makes a claim MUST have at least one non-empty array in its evidence_refs (signal_ids, quote_ids, or source_urls). If evidence is genuinely absent, say so in the relevant field and set confidence low.
3. confidence objects follow { score: 0..1, label: "low"|"medium"|"high", basis: string|null }. Never inflate confidence — if data is sparse, score must be low and label must be "low".
4. Be balanced: strengths_to_respect must reflect real love signals; do not manufacture weaknesses or erase genuine strengths.
5. All numeric scores and factors are derived from the mergedSignals you receive — never invent numbers.
6. Arrays with no evidence should be [] — do not fabricate items to fill a widget.
7. The wedge_recommendation must name a specific target segment and a specific core pain, not a generic summary.`;

export function buildFounderSynth(input: {
  ctx: PipelineCtx;
  mergedSignals: MergedSignals;
}): { system: string; user: string; schema: typeof founderViewSectionSchema } {
  const { ctx, mergedSignals } = input;

  const platformSummary = buildPlatformSummary(mergedSignals);
  const user = `Competitor: ${ctx.competitor}
Category: ${ctx.category}
Audience: ${ctx.audience ?? "general"}
Founder goal: ${ctx.goal}

${platformSummary}

Merged signals:
${JSON.stringify(mergedSignals, null, 2)}

Produce the FounderViewSection JSON now.`;

  return { system: SYSTEM, user, schema: founderViewSectionSchema };
}
