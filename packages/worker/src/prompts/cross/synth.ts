import { synthOutputSchema, type MergedClusters, type PipelineCtx } from "../shared";

export interface SynthInput {
  ctx: PipelineCtx;
  merged: MergedClusters;
}

const SYSTEM = `You are a competitive-intelligence analyst producing a Competitor Pain Report.
You receive cross-platform merged clusters and output a single JSON blob that populates all 16
report sections in one pass.

Rules:
- external_id minting: complaints use slugified title, e.g. "slow-export-pdf". Must be unique.
- anchor_complaint_external_id in opportunities must reference an existing complaint external_id or be null.
- sentiment sums: report_meta.sentiment_positive + sentiment_neutral + sentiment_negative must equal 1.0 (±0.01).
- effort enum values: "low" | "med" | "high" only.
- payoff enum values: "low" | "med" | "high" only.
- Produce at least 3 complaints, 2 feature_gaps, 1 pricing_tier, 1 opportunity, and 1 action.
- Do not fabricate evidence; base all output on the provided cluster data.
- All nullable fields may be null if no data supports them.
- Output valid JSON matching the schema exactly — no prose, no markdown fences.`;

export function buildSynth(input: SynthInput): {
  system: string;
  user: string;
  schema: typeof synthOutputSchema;
} {
  const { ctx, merged } = input;
  const user = `Competitor: ${ctx.competitor}
Category: ${ctx.category}
Audience: ${ctx.audience ?? "general"}
Goal: ${ctx.goal}

Merged clusters:
${JSON.stringify(merged, null, 2)}

Produce the full SynthOutput JSON now.`;

  return { system: SYSTEM, user, schema: synthOutputSchema };
}
