import { eq } from "drizzle-orm";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { report_platform_briefs } from "../../../api/src/db/schema/pipeline.js";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import type { LlmCallOptions } from "@rivaleye/shared";
import { log } from "../logger.js";
import { runStageCMerge } from "./stage-c-merge";
import { runStageDSynth } from "./stage-d-synth";
import { runStageERefine } from "./stage-e-refine";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";
import { persistReport } from "./persist";
import { PipelineError } from "./errors";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../prompts/shared";

let _llm: OpenRouterClient | null = null;

function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

const LLM_OPTS_C: LlmCallOptions = { timeoutMs: 60_000, maxAttempts: 3 };
const LLM_OPTS_D: LlmCallOptions = { timeoutMs: 90_000, maxAttempts: 3 };
const LLM_OPTS_E: LlmCallOptions = { timeoutMs: 90_000, maxAttempts: 2 };

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

  const { merged } = await runStageCMerge({ llm, ctx, briefs, extracts }, LLM_OPTS_C);
  const { synth } = await runStageDSynth({ llm, ctx, merged }, LLM_OPTS_D);
  const { refined, fellBackToDraft } = await runStageERefine({ llm, ctx, merged, draft: synth }, LLM_OPTS_E);

  const mentionRows = await db
    .select({ platform: mentions.platform, raw: mentions.raw })
    .from(mentions)
    .where(eq(mentions.report_id, reportId));

  const platformStats = computePlatformStats(mentionRows);
  const subreddits = computeSubredditStats(mentionRows);

  await persistReport({ reportId, synth: refined, platformStats, subreddits });

  await log(reportId, "info", null, null, "pipeline done", { fellBackToDraft });
}
