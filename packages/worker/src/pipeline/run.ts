import { eq } from "drizzle-orm";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import {
  report_platform_briefs,
  report_pipeline_checkpoints,
} from "../../../api/src/db/schema/pipeline.js";
import type { PipelineCheckpointStage } from "../../../api/src/db/schema/pipeline.js";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import type { LlmCallOptions } from "@rivaleye/shared";
import { log } from "../logger.js";
import { runStageCMerge } from "./stage-c-merge";
import { runStageDSynth } from "./stage-d-synth";
import { runRoleSynthesis } from "./stage-d-role";
import { buildSummarySynthesis, type SummaryData } from "../prompts/summary-synthesis";
import { runStageERefine } from "./stage-e-refine";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";
import { persistReport } from "./persist";
import { PipelineError } from "./errors";
import {
  mergedClustersSchema,
  synthOutputSchema,
} from "../prompts/shared";
import type {
  PipelineCtx,
  PlatformBrief,
  PlatformExtract,
  MergedClusters,
  MergedSignals,
  StageAExtract,
  SynthOutput,
} from "../prompts/shared";
import type { RoleSections } from "../prompts/role-sections/schema";
import type { PlatformId } from "@rivaleye/scrapers";
import { emptyStageAExtract } from "./signal-adapters";

function stripEvidenceIds(merged: MergedClusters): MergedClusters {
  return {
    ...merged,
    complaint_clusters: merged.complaint_clusters.map(({ evidence_ids: _e, ...rest }) => ({ ...rest, evidence_ids: [] })),
    feature_clusters: merged.feature_clusters.map(({ evidence_ids: _e, ...rest }) => ({ ...rest, evidence_ids: [] })),
  };
}

// Stage C merges multi-platform signal extracts — can be large with many mentions.
// 5 min per attempt gives DeepSeek enough time to generate large JSON responses.
const LLM_OPTS_C: LlmCallOptions = { timeoutMs: 300_000, maxAttempts: 2 };
const LLM_OPTS_D: LlmCallOptions = { timeoutMs: 120_000, maxAttempts: 3 };
const LLM_OPTS_D_ROLE: LlmCallOptions = { timeoutMs: 180_000, maxAttempts: 2 };
const LLM_OPTS_E: LlmCallOptions = { timeoutMs: 300_000, maxAttempts: 2 };

let _llm: OpenRouterClient | null = null;

function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

async function loadCheckpoints(reportId: string): Promise<Map<string, Record<string, unknown>>> {
  const rows = await db
    .select()
    .from(report_pipeline_checkpoints)
    .where(eq(report_pipeline_checkpoints.report_id, reportId));
  return new Map(rows.map((r) => [r.stage, r.output]));
}

async function saveCheckpoint(
  reportId: string,
  stage: PipelineCheckpointStage,
  output: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(report_pipeline_checkpoints)
    .values({ report_id: reportId, stage, output, updated_at: new Date() })
    .onConflictDoUpdate({
      target: [report_pipeline_checkpoints.report_id, report_pipeline_checkpoints.stage],
      set: { output, updated_at: new Date() },
    });
}

export async function runPipeline(reportId: string): Promise<void> {
  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  if (!report) {
    throw new PipelineError("C", `report ${reportId} not found`);
  }

  const briefRows = await db
    .select()
    .from(report_platform_briefs)
    .where(eq(report_platform_briefs.report_id, reportId));

  if (briefRows.length === 0) {
    throw new PipelineError("C", `no platform briefs found for report ${reportId}`);
  }

  const briefs: PlatformBrief[] = briefRows.map((row) => row.summary as unknown as PlatformBrief);
  const extracts: PlatformExtract[] = briefRows.map((row) => {
    const raw = { ...(row.extract as Record<string, unknown>) };
    delete raw._signals;
    return raw as unknown as PlatformExtract;
  });
  const signalExtracts: Array<{ platform: PlatformId; extract: StageAExtract }> = briefRows.map((row) => {
    const raw = row.extract as Record<string, unknown>;
    return {
      platform: row.platform as PlatformId,
      extract: (raw._signals ?? emptyStageAExtract()) as StageAExtract,
    };
  });

  const ctx: PipelineCtx = {
    reportId: report.id,
    competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
    category: report.category,
    audience: report.audience ?? null,
    goal: report.goal,
  };

  await db
    .update(reports)
    .set({ stage: "clustering", updated_at: new Date() })
    .where(eq(reports.id, reportId));

  const llm = getLlm();
  const checkpoints = await loadCheckpoints(reportId);

  // Stage C
  let merged: MergedClusters;
  let mergedSignals: MergedSignals;
  if (checkpoints.has("C")) {
    await log(reportId, "info", "C", null, "skipping stage C (checkpoint found)");
    const cCheckpoint = checkpoints.get("C") as Record<string, unknown>;
    // Parse through schema to strip _signals and other non-MergedClusters keys.
    // This keeps the Stage E prompt from ballooning with raw signal evidence data.
    merged = mergedClustersSchema.parse(cCheckpoint);
    mergedSignals = (cCheckpoint["_signals"] ?? {}) as MergedSignals;
  } else {
    await log(reportId, "info", "C", null, "running stage C: merge", { platforms: briefs.length, totalExtracts: signalExtracts.length });
    const resultC = await runStageCMerge({ llm, ctx, briefs, signalExtracts }, LLM_OPTS_C);
    await log(reportId, "info", "C", null, "stage C done", {
      promptTokens: resultC.usage.promptTokens,
      completionTokens: resultC.usage.completionTokens,
      loveClusters: resultC.mergedSignals.love_clusters.length,
      painClusters: resultC.mergedSignals.pain_clusters.length,
      gapClusters: resultC.mergedSignals.gap_clusters.length,
      switchClusters: resultC.mergedSignals.switch_clusters.length,
      pricingClusters: resultC.mergedSignals.pricing_clusters.length,
      featureClusters: resultC.mergedSignals.feature_clusters.length,
      positioningClusters: resultC.mergedSignals.positioning_clusters.length,
    });
    merged = resultC.merged;
    mergedSignals = resultC.mergedSignals;
    await saveCheckpoint(reportId, "C", { ...merged, _signals: resultC.mergedSignals } as unknown as Record<string, unknown>);
  }

  // Stage D
  let synth: SynthOutput;
  let roleSections: RoleSections | undefined;
  if (checkpoints.has("D")) {
    await log(reportId, "info", "D", null, "skipping stage D (checkpoint found)");
    const cCheckpoint = checkpoints.get("D") as Record<string, unknown>;
    // Parse through schema to strip _role_sections and other non-SynthOutput keys.
    synth = synthOutputSchema.parse(cCheckpoint);
    roleSections = cCheckpoint["_role_sections"] as RoleSections | undefined;
  } else {
    await log(reportId, "info", "D", null, "running stage D: synth", {
      complaintClusters: merged.complaint_clusters.length,
      featureClusters: merged.feature_clusters.length,
    });
    const resultD = await runStageDSynth({ llm, ctx, merged, briefs, extracts }, LLM_OPTS_D);
    await log(reportId, "info", "D", null, "stage D done", {
      promptTokens: resultD.usage.promptTokens,
      completionTokens: resultD.usage.completionTokens,
      complaints: resultD.synth.complaints?.length ?? 0,
      opportunities: resultD.synth.opportunities?.length ?? 0,
      actions: resultD.synth.actions?.length ?? 0,
    });
    synth = resultD.synth;

    try {
      const resultRole = await runRoleSynthesis({ llm, ctx, mergedSignals }, LLM_OPTS_D_ROLE);
      roleSections = resultRole.roleSections;
      await log(reportId, "info", "D", null, "stage D role synthesis done", {
        sections: Object.keys(roleSections),
        promptTokens: resultRole.usage.promptTokens,
        completionTokens: resultRole.usage.completionTokens,
      });
    } catch (roleErr) {
      const causeMsg = roleErr instanceof Error && roleErr.cause instanceof Error
        ? roleErr.cause.message
        : roleErr instanceof Error && roleErr.cause
          ? String(roleErr.cause)
          : null;
      await log(reportId, "warn", "D", null, "stage D role synthesis failed — continuing with legacy report", {
        error: roleErr instanceof Error ? roleErr.message : String(roleErr),
        cause: causeMsg,
      });
    }

    // Generate cross-platform summary
    if (roleSections !== undefined) {
      try {
        const mentionCount = (synth.quotes?.length ?? 0) + (synth.complaints?.length ?? 0) + (synth.feature_gaps?.length ?? 0) + (synth.switching?.length ?? 0);
        const overallSentiment = synth.report_meta?.sentiment_overall ?? 0;
        const positiveSentiment = synth.report_meta?.sentiment_positive ?? 0;
        const neutralSentiment = synth.report_meta?.sentiment_neutral ?? 0;
        const negativeSentiment = synth.report_meta?.sentiment_negative ?? 0;
        const sentimentTrend = synth.report_meta?.sentiment_trend ?? "0%";

        const platformNames: Record<string, string> = {
          reddit: "Reddit",
          producthunt: "Product Hunt",
          appstore: "App Store",
          playstore: "Play Store",
          g2: "G2",
          capterra: "Capterra",
          twitter: "X (Twitter)",
          linkedin: "LinkedIn",
          trustpilot: "Trustpilot",
          gmaps: "Google Maps",
        };

        const summaryPrompt = buildSummarySynthesis({
          ctx,
          competitor: ctx.competitor,
          scannedAt: new Date().toISOString(),
          sources: mentionCount,
          platforms: briefs.map((b) => ({ id: b.platform, name: platformNames[b.platform] ?? b.platform })),
          sentiment: {
            overall: overallSentiment,
            positive: positiveSentiment,
            neutral: neutralSentiment,
            negative: negativeSentiment,
            trend: sentimentTrend,
          },
          platformExtracts: Object.fromEntries(
            extracts.map((e, i) => {
              const brief = briefs[i];
              const platformId = brief?.platform ?? `platform-${i}`;
              return [platformId, e];
            })
          ),
          topQuotes: (resultD.synth.quotes ?? []).map((q) => ({
            who: q.who ?? "Unknown",
            sub: q.sub ?? q.when_label ?? "Unknown",
            when: q.when_label ?? "Unknown",
            score: q.score ?? 0,
            sentiment: q.sentiment ?? 0,
            text: q.text ?? "",
            platform: "mixed",
          })),
        });

        const summaryRes = await llm.complete({
          system: summaryPrompt.system,
          user: summaryPrompt.user,
          schema: summaryPrompt.schema,
        }, LLM_OPTS_D_ROLE);

        const summaryData = summaryRes.parsed as SummaryData;
        roleSections.summary = summaryData;
        await log(reportId, "info", "D", null, "stage D summary synthesis done", {
          promptTokens: summaryRes.usage.promptTokens,
          completionTokens: summaryRes.usage.completionTokens,
        });
      } catch (err) {
        await log(reportId, "warn", "D", null, "Failed to generate summary section; continuing without it", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await saveCheckpoint(
      reportId,
      "D",
      { ...synth, ...(roleSections !== undefined ? { _role_sections: roleSections } : {}) } as unknown as Record<string, unknown>,
    );
  }

  // Stage E
  let refined: SynthOutput;
  let fellBackToDraft = false;
  if (checkpoints.has("E")) {
    await log(reportId, "info", "E", null, "skipping stage E (checkpoint found)");
    refined = checkpoints.get("E") as unknown as SynthOutput;
  } else {
    await log(reportId, "info", "E", null, "running stage E: refine", {
      complaints: synth.complaints?.length ?? 0,
      opportunities: synth.opportunities?.length ?? 0,
    });
    const resultE = await runStageERefine({ llm, ctx, merged: stripEvidenceIds(merged), draft: synth }, LLM_OPTS_E);
    if (resultE.fellBackToDraft) {
      await log(reportId, "warn", "E", null, "stage E fell back to draft output");
    } else {
      await log(reportId, "info", "E", null, "stage E done", {
        promptTokens: resultE.usage.promptTokens,
        completionTokens: resultE.usage.completionTokens,
      });
    }
    refined = resultE.refined;
    fellBackToDraft = resultE.fellBackToDraft;
    await saveCheckpoint(reportId, "E", refined as unknown as Record<string, unknown>);
  }

  const mentionRows = await db
    .select({ platform: mentions.platform, raw: mentions.raw })
    .from(mentions)
    .where(eq(mentions.report_id, reportId));

  const platformStats = computePlatformStats(mentionRows);
  const subreddits = computeSubredditStats(mentionRows);

  await log(reportId, "info", "persist", null, "persisting report to sub-tables");
  await persistReport({ reportId, synth: refined, platformStats, subreddits, roleSections });
  await log(reportId, "info", "persist", null, "persist done", {
    fellBackToDraft,
  });

  await log(reportId, "info", null, null, "pipeline done");
}
