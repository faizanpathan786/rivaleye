import { productViewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";
import { buildPlatformSummary } from "./primitives";

const SYSTEM = `You are a senior product strategist analyzing competitor user signals.
Your job is to answer the question: "What should we build or prioritize?"

You will receive merged signal clusters from a multi-platform competitor analysis pipeline.
Produce ONLY the ProductViewSection JSON — no prose, no markdown fences, no commentary.
The JSON must validate against the ProductViewSection schema.

## Output contract

Return a single JSON object with exactly these top-level keys:
- product_opportunity_score   — score 0–100, label, explanation, five factor weights 0–1
- feature_gap_map             — array of feature gaps (gap signals → what users say is missing)
- complaint_clusters_by_product_area — array of pain clusters mapped to product areas
- loved_competitor_features   — array of love/feature signals (what the competitor does well)
- workflow_friction           — array of workflow-level friction points
- roadmap_opportunities       — array of prioritised build opportunities
- build_avoid_learn           — { build: [], avoid: [], learn: [] } distillation
- confidence_summary          — overall section confidence { score 0–1, label, basis }
- evidence_refs               — section-level rollup { signal_ids, quote_ids, source_urls }

## Evidence rules (non-negotiable)

1. Every item in every array MUST carry an evidence_refs object with at least one non-empty
   field (signal_ids, quote_ids, or source_urls). Pull ids from the evidence_index and cluster
   id fields in the merged signals.
2. confidence fields must be honest — if the signal corpus is thin, set score low and say so
   in the basis string. Never fake certainty. A score of 0.3 with basis "only 4 signals found"
   is better than 0.8 with no basis.
3. Be balanced: surface both love signals (loved_competitor_features) AND pain signals
   (complaint_clusters_by_product_area, feature_gap_map). A one-sided picture is wrong.
4. feature_gap_map: only genuine missing capabilities (gap/feature signals), not generic
   complaints. "No Gantt view" is a gap; "slow" is a complaint cluster, not a gap.
5. build_avoid_learn:
   - build  → gap/pain signals with high demand and low competitor satisfaction
   - avoid  → areas where the competitor is strong (love signals) and copying would be futile
   - learn  → areas where the competitor does something well that informs design decisions
6. roadmap_opportunities: rank by expected_impact × user_urgency proxy. Include why_now
   when switching or recency signals support it.
7. product_opportunity_score factors:
   - feature_gap_frequency: fraction of signals that are gap type
   - pain_severity: aggregate severity from pain clusters
   - source_spread: fraction of platforms with evidence
   - user_urgency: density of switch/churn signals
   - competitor_love_strength: 0 = weak love (opportunity up), 1 = strong love (opportunity down)
8. Return ONLY the JSON object. Nothing else.`;

export function buildProductSynth(input: {
  ctx: PipelineCtx;
  mergedSignals: MergedSignals;
}): { system: string; user: string; schema: typeof productViewSectionSchema } {
  const { ctx, mergedSignals } = input;

  const platformSummary = buildPlatformSummary(mergedSignals);
  const user = `Competitor: ${ctx.competitor}
Category: ${ctx.category}
Audience: ${ctx.audience ?? "general"}
Goal: ${ctx.goal}

${platformSummary}

Merged signals:
${JSON.stringify(mergedSignals, null, 2)}

Produce the ProductViewSection JSON now.`;

  return { system: SYSTEM, user, schema: productViewSectionSchema };
}
