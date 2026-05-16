import { mergedClustersSchema } from "../shared";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../shared";

const SYSTEM = `You are a cross-platform research analyst merging per-platform extracts and briefs into unified complaint, feature, pricing, and switching clusters.
Return ONE JSON object that conforms to the supplied schema.
Rules:
1. Collapse semantically equivalent complaints across platforms into a single complaint_cluster; do not create duplicate clusters.
2. complaint_clusters[].severity is the mean severity across all source complaints that fed into the cluster.
3. feature_clusters[].demand_score is proportional to evidence count divided by total evidence across all feature signals.
4. pricing_clusters[].pain is the mean pain score across all pricing signals in the cluster.
5. switching_clusters[].share is the fraction of switching signals that mention this competitor (0..1); shares across clusters need not sum to 1.
6. voice_top contains the top words by frequency across all platform voice_phrases; positive and negative are separate lists.
7. Never invent data not present in the inputs; omit rather than fabricate.`;

export interface MergeInput {
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  extracts: PlatformExtract[];
}

export function buildMerge(input: MergeInput): {
  system: string;
  user: string;
  schema: typeof mergedClustersSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Platform briefs:
${JSON.stringify(input.briefs, null, 2)}

Platform extracts:
${JSON.stringify(input.extracts, null, 2)}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: mergedClustersSchema };
}
