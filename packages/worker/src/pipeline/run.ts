import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { runStage1 } from "./stage1";
import { runStage2 } from "./stage2";
import { runStage3 } from "./stage3";
import { runStage4 } from "./stage4";
import { remapAllPostIds, validateEvidence, checkBlocklist } from "./evidence-binding";
import type { InternalOutput } from "./evidence-binding";
import { toWireShape } from "./adapter";
import { preflightCheck } from "./preflight";
import {
  NotEnoughSignalError,
  StageValidationError,
  FinalShapeError,
  EvidenceIntegrityError,
} from "./errors";
import type { PipelineCtx } from "./stage1";
import type { ReportOutput } from "@rivaleye/shared";

const PIPELINE_VERSION = "2026-05-16-multi-pass-v1";

/**
 * Pad or trim topOpportunities to exactly 3 entries.
 * reportOutputSchema requires top_opportunities.length === 3.
 * If stage3 returned fewer, fill with placeholder entries so toWireShape doesn't throw.
 */
function normaliseOpportunities(
  opps: Array<{
    title: string;
    description: string;
    evidence: { post_ids: string[]; top_quotes: string[] };
    scores?: {
      opportunity_score: number;
      market_pain: number;
      differentiation: number;
      evidence_count: number;
    };
  }>,
): Array<{
  title: string;
  description: string;
  evidence: { post_ids: string[]; top_quotes: string[] };
  scores?: {
    opportunity_score: number;
    market_pain: number;
    differentiation: number;
    evidence_count: number;
  };
}> {
  const result = opps.slice(0, 3);
  while (result.length < 3) {
    result.push({
      title: "Additional opportunity pending analysis",
      description: "Insufficient evidence clusters to surface a third opportunity.",
      evidence: { post_ids: [], top_quotes: [] },
    });
  }
  return result;
}

export async function runInsightPipeline(reportId: string): Promise<ReportOutput> {
  // 1. Load report row
  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) throw new Error(`Report ${reportId} not found`);

  // 2. Load all mentions for this report
  const rows = await db
    .select()
    .from(mentions)
    .where(eq(mentions.report_id, reportId));

  console.log(`[pipeline] reportId=${reportId} loaded ${rows.length} mentions`);

  // 3. Preflight — throws NotEnoughSignalError if < 20 mentions
  preflightCheck(reportId, rows.length);

  // 4. Update stage → clustering
  await db
    .update(reports)
    .set({ stage: "clustering", updated_at: new Date() })
    .where(eq(reports.id, reportId));

  // 5. Build PipelineCtx
  const ctx: PipelineCtx = {
    reportId,
    competitor: (report.competitors as string[])[0] ?? "",
    category: report.category,
    founderGoal: report.goal ?? "find_user_pain",
  };

  // 6. Stage 1 — cluster raw posts, build syntheticIdMap
  //    Pass mentions as posts; stage1 slices to 150 and assigns p001..p150 internally.
  const posts = rows.map((m) => ({
    externalId: m.external_id,
    title: m.title ?? "",
    body: m.body,
    score: m.score ?? 0,
    createdAt: m.posted_at,
  }));

  console.log(`[pipeline] stage1 start`);
  const stage1Output = await runStage1(ctx, posts);
  console.log(
    `[pipeline] stage1 done: ${stage1Output.rawClusters.length} clusters, ` +
    `${stage1Output.syntheticIdMap.size} synthetic IDs mapped`,
  );

  // 7. Stage 2 — score clusters
  //    stage2 calls computeClusterMetadata which matches evidence_post_ids (synthetic IDs)
  //    against mentions[].externalId. So build a synthetic-keyed mentions array.
  const syntheticMentions = Array.from(stage1Output.syntheticIdMap.entries()).map(
    ([synId, realExternalId]) => {
      const realMention = rows.find((r) => r.external_id === realExternalId);
      return {
        externalId: synId,
        createdAt: realMention?.posted_at ?? new Date(),
      };
    },
  );

  console.log(`[pipeline] stage2 start`);
  const stage2Output = await runStage2(ctx, stage1Output, syntheticMentions);
  console.log(
    `[pipeline] stage2 done: ${stage2Output.rankedClusters.length} ranked, ` +
    `${stage2Output.extraClusters.length} extra`,
  );

  // 8. Stage 3 — synthesise insights
  console.log(`[pipeline] stage3 start`);
  const stage3Output = await runStage3(ctx, stage2Output, stage1Output.voicePhrases);
  console.log(`[pipeline] stage3 done: ${stage3Output.topOpportunities.length} opportunities`);

  // 9. Stage 4 — next actions
  console.log(`[pipeline] stage4 start`);
  const nextActions = await runStage4(ctx, stage3Output);
  console.log(`[pipeline] stage4 done: ${nextActions.length} actions`);

  // 10. Build InternalOutput for evidence binding
  //     evidence-binding.ts uses snake_case keys: pain_clusters, featureGaps, switchingSignals, topOpportunities
  const warnings = [...stage3Output.meta.warnings];

  const internalOutput: InternalOutput = {
    executiveSummary: stage3Output.executiveSummary,
    pain_clusters: stage2Output.rankedClusters.map((c) => ({
      description: c.description,
      evidence: {
        post_ids: c.evidence_post_ids,
        top_quotes: c.voice_phrases.slice(0, 3),
      },
    })),
    featureGaps: stage3Output.featureGaps,
    switchingSignals: stage3Output.switchingSignals,
    topOpportunities: stage3Output.topOpportunities,
  };

  // 11. Remap synthetic IDs → real externalIds in all evidence blocks
  const remapped = remapAllPostIds(internalOutput, stage1Output.syntheticIdMap);

  // 12. Validate evidence against real externalId set — throws EvidenceIntegrityError if >20% dropped
  const realExternalIds = new Set(rows.map((m) => m.external_id));
  const { output: validated, warnings: evidenceWarnings } = validateEvidence(
    remapped,
    realExternalIds,
  );
  if (evidenceWarnings.length > 0) {
    warnings.push(...evidenceWarnings);
  }

  // 13. Blocklist check — log warning, do not re-run (stage3 already retried)
  const blocklistResult = checkBlocklist({
    executive_summary: stage3Output.executiveSummary,
    pain_clusters: validated.pain_clusters,
  });
  if (!blocklistResult.ok) {
    console.warn(
      `[pipeline] blocklist phrases remain after stage3 retry: ${blocklistResult.offending.join(", ")}`,
    );
    warnings.push(`blocked_phrases_remain: ${blocklistResult.offending.join(", ")}`);
  }

  // 14. Build sources from real mention rows (post-remap IDs are real externalIds)
  const mentionByExternalId = new Map(rows.map((m) => [m.external_id, m]));
  const sources = Array.from(stage1Output.syntheticIdMap.values()).map((realId) => {
    const m = mentionByExternalId.get(realId);
    return {
      post_id: realId,
      url: m?.url,
      title: m?.title ?? undefined,
      score: m?.score ?? undefined,
      created_utc: m?.posted_at
        ? Math.floor(m.posted_at.getTime() / 1000)
        : undefined,
    };
  });

  // 15. Build rankedClusters and extraClusters for the wire shape
  //     These still use synthetic IDs at this point — they get remapped via the validated output.
  //     But adapter.ts needs them as InternalCluster with their real evidence post_ids.
  //     Reconstruct from the validated pain_clusters.
  const validatedPainClusters = (validated.pain_clusters ?? []).map((vc, idx) => {
    const scored = stage2Output.rankedClusters[idx];
    return {
      id: scored?.id ?? `c${String(idx + 1).padStart(3, "0")}`,
      title: scored?.title ?? "",
      description: vc.description,
      frequency: vc.evidence.post_ids.length,
      evidence: vc.evidence,
      scores: scored
        ? {
            pain_score: scored.scores.pain_score,
            intensity: scored.scores.intensity,
            specificity: scored.scores.specificity,
            recency_days: scored.scores.recency_days,
          }
        : undefined,
    };
  });

  const extraClusters = stage2Output.extraClusters.map((c, idx) => ({
    id: c.id ?? `cx${String(idx + 1).padStart(3, "0")}`,
    title: c.title,
    description: c.description,
    frequency: c.evidence_post_ids.length,
    evidence: {
      post_ids: c.evidence_post_ids
        .map((synId) => stage1Output.syntheticIdMap.get(synId))
        .filter((id): id is string => id !== undefined),
      top_quotes: c.voice_phrases.slice(0, 3),
    },
    scores: {
      pain_score: c.scores.pain_score,
      intensity: c.scores.intensity,
      specificity: c.scores.specificity,
      recency_days: c.scores.recency_days,
    },
  }));

  const normalisedOpportunities = normaliseOpportunities(
    (validated.topOpportunities ?? stage3Output.topOpportunities) as Array<{
      title: string;
      description: string;
      evidence: { post_ids: string[]; top_quotes: string[] };
      scores?: {
        opportunity_score: number;
        market_pain: number;
        differentiation: number;
        evidence_count: number;
      };
    }>,
  );

  // 16. toWireShape — throws FinalShapeError if the schema validation fails
  const wireShape = toWireShape({
    executiveSummary: stage3Output.executiveSummary,
    topOpportunities: normalisedOpportunities,
    strongestPositioningAngle: stage3Output.strongestPositioningAngle,
    bestWedge: stage3Output.bestWedge,
    painClusters: validatedPainClusters,
    extraClusters,
    featureGaps: (validated.featureGaps ?? stage3Output.featureGaps) as Array<{
      title: string;
      description: string;
      evidence: { post_ids: string[]; top_quotes: string[] };
      priority?: "high" | "medium" | "low";
    }>,
    pricingPain: stage3Output.pricingPain,
    switchingSignals: (validated.switchingSignals ?? stage3Output.switchingSignals) as Array<{
      signal: string;
      evidence: { post_ids: string[]; top_quotes: string[] };
    }>,
    voiceOfCustomer: stage3Output.voiceOfCustomer,
    competitorWeaknesses: stage3Output.competitorWeaknesses,
    productOpportunities: stage3Output.productOpportunities,
    positioningAngles: stage3Output.positioningAngles,
    nextActions: nextActions.map((a) => a.action),
    sources,
    meta: {
      pipeline_version: PIPELINE_VERSION,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  });

  console.log(`[pipeline] reportId=${reportId} complete`);
  return wireShape;
}
