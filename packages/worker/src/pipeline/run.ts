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
import { runStageERefine } from "./stage-e-refine";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";
import { persistReport } from "./persist";
import { PipelineError } from "./errors";
import type {
  PipelineCtx,
  PlatformBrief,
  PlatformExtract,
  MergedClusters,
  SynthOutput,
} from "../prompts/shared";

const LLM_OPTS_C: LlmCallOptions = { timeoutMs: 60_000, maxAttempts: 3 };
const LLM_OPTS_D: LlmCallOptions = { timeoutMs: 90_000, maxAttempts: 3 };
const LLM_OPTS_E: LlmCallOptions = { timeoutMs: 120_000, maxAttempts: 2 };

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
  const extracts: PlatformExtract[] = briefRows.map(
    (row) => row.extract as unknown as PlatformExtract,
  );

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
  if (checkpoints.has("C")) {
    await log(reportId, "info", "C", null, "skipping stage C (checkpoint found)");
    merged = checkpoints.get("C") as unknown as MergedClusters;
  } else {
    await log(reportId, "info", "C", null, "running stage C: merge", { platforms: briefs.length, totalExtracts: extracts.length });
    const resultC = await runStageCMerge({ llm, ctx, briefs, extracts }, LLM_OPTS_C);
    await log(reportId, "info", "C", null, "stage C done", {
      promptTokens: resultC.usage.promptTokens,
      completionTokens: resultC.usage.completionTokens,
      complaintClusters: resultC.merged.complaint_clusters.length,
      featureClusters: resultC.merged.feature_clusters.length,
      pricingClusters: resultC.merged.pricing_clusters.length,
    });
    merged = resultC.merged;
    await saveCheckpoint(reportId, "C", merged as unknown as Record<string, unknown>);
  }

  // Stage D
  let synth: SynthOutput;
  if (checkpoints.has("D")) {
    await log(reportId, "info", "D", null, "skipping stage D (checkpoint found)");
    synth = checkpoints.get("D") as unknown as SynthOutput;
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
    await saveCheckpoint(reportId, "D", synth as unknown as Record<string, unknown>);
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
    const resultE = await runStageERefine({ llm, ctx, merged, draft: synth }, LLM_OPTS_E);
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
  await persistReport({ reportId, synth: refined, platformStats, subreddits });
  await log(reportId, "info", "persist", null, "persist done", {
    fellBackToDraft,
  });

  await log(reportId, "info", null, null, "pipeline done");
}
