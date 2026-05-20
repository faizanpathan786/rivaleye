import { mergedClustersSchema } from "../shared";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../shared";

const SYSTEM = `You are a cross-platform research analyst merging per-platform extracts and briefs into unified clusters.

Return ONE JSON object with EXACTLY these keys (all required, never omit any):
{
  "complaint_clusters": [{ "title": "string", "summary": "string", "severity": 0.0, "platforms": ["reddit"], "evidence_ids": ["id"], "sample_quote": "string or null" }],
  "feature_clusters": [{ "feature": "string", "demand_score": 0.0, "platforms": ["reddit"], "evidence_ids": ["id"] }],
  "pricing_clusters": [{ "tier_label": "string", "pain": 0.0, "note": "string", "platforms": ["reddit"], "sample_quotes": [{ "who": "string", "text": "string" }] }],
  "switching_clusters": [{ "direction": "inbound|outbound", "competitor": "string", "count": 0, "share": 0.0, "platforms": ["reddit"] }],
  "voice_top": { "positive": [{ "word": "string", "count": 0 }], "negative": [{ "word": "string", "count": 0 }] },
  "cross_platform_themes": [{ "theme": "string", "platforms": ["reddit"], "weight": 0.0 }]
}

Rules:
1. Collapse semantically equivalent complaints into a single cluster; no duplicates.
2. complaint_clusters[].severity is the mean severity across source complaints.
3. feature_clusters[].demand_score is proportional to evidence count (0..1).
4. pricing_clusters[].pain is the mean pain score (0..1).
5. switching_clusters[].share is the fraction of switching signals for this competitor (0..1).
6. voice_top: top words from platform voice_phrases; positive and negative are separate lists.
7. cross_platform_themes: themes appearing across 2+ platforms (or top themes if only 1 platform). Never omit this key — use [] if no cross-platform signals.
8. complaint_clusters[].evidence_ids: include ALL source evidence ids from all platforms. The length of this array is the true mention count — do not truncate or sample.
9. feature_clusters[].evidence_ids: same rule — include all source ids across all platforms.
10. Never invent data; omit rather than fabricate.
11. Return ONLY the JSON object. No prose, no markdown fences.`;

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
