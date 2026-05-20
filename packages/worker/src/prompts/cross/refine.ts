import { synthOutputSchema } from "../shared";
import type { MergedClusters, PipelineCtx, SynthOutput } from "../shared";

const SYSTEM = `You are a senior analyst performing a critique-and-revise pass on a competitor pain report.

Rules:
1. Strengthen weak sections: if a section has fewer than 2 items and the source clusters justify more, expand it.
2. Tighten language: remove filler words, passive voice, and hedging unless the uncertainty is material.
3. Drop fabrications: if any item in the draft cannot be grounded in the provided merged clusters, remove it.
4. Keep external_ids stable: never change, add, or remove external_id values on complaint items.
5. Do not add new top-level sections; only improve the content within the existing schema.
6. executive_brief: rewrite for maximum clarity and specificity. Must name the dominant pain, best target persona, and window of opportunity.
7. positioning: if empty or weak, generate angles from the complaint and switching data. Always produce at least 2.
8. actions: must be concrete and founder-executable. Replace vague actions with specific ones.
9. Return ONE JSON object with ALL required keys: complaints, feature_gaps, pricing_tiers, pricing_quotes, switching, quotes, voice_words, positioning, actions, leads, opportunities, threads, report_meta, executive_brief. Never omit any key.`;

export interface RefineInput {
  ctx: PipelineCtx;
  merged: MergedClusters;
  draft: SynthOutput;
}

export function buildRefine(input: RefineInput): {
  system: string;
  user: string;
  schema: typeof synthOutputSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Merged clusters (ground truth):
${JSON.stringify(input.merged, null, 2)}

Draft report to critique and revise:
${JSON.stringify(input.draft, null, 2)}

Apply the critique-and-revise rules and return the improved JSON object now.`;

  return { system: SYSTEM, user, schema: synthOutputSchema };
}
