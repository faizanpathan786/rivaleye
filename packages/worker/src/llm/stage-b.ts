import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_briefs,
  report_platform_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";
import { COMPREHENSIVE_GOAL } from "../prompts/shared";
import { fanInCheck } from "./fan-in";

let _llm: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

export const stageB = inngest.createFunction(
  {
    id: "llm-stage-b",
    concurrency: [{ limit: 4 }],
    retries: 4,
    idempotency: "event.data.reportId + ':' + event.data.platform + ':b'",
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as { reportId: string; platform: string };
      await db
        .update(report_platform_jobs)
        .set({
          status: "failed",
          stage: "failed",
          last_error: error.message,
          completed_at: new Date(),
        })
        .where(
          and(
            eq(report_platform_jobs.report_id, data.reportId),
            eq(report_platform_jobs.platform, data.platform),
          ),
        );
      await fanInCheck(data.reportId);
    },
  },
  { event: "llm.stage-b" },
  async ({ event, step, attempt }) => {
    const { reportId, platform } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", async () => {
      await emit({
        reportId,
        platform,
        stage: "llm.stage_b",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      });
    });

    try {
      const summary = await step.run("summarize", async () => {
        const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
        if (!report) throw new PermanentError(`report ${reportId} not found`);

        const [briefRow] = await db
          .select()
          .from(report_platform_briefs)
          .where(
            and(
              eq(report_platform_briefs.report_id, reportId),
              eq(report_platform_briefs.platform, platform),
            ),
          )
          .limit(1);

        if (!briefRow) {
          // No extract = no posts. Skip summarize, return null.
          return null as null | { brief: unknown; usage: { promptTokens: number; completionTokens: number } };
        }

        const ctx = {
          reportId,
          competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
          category: report.category,
          audience: report.audience ?? null,
          goal: COMPREHENSIVE_GOAL,
        };

        return runStageBSummarize({
          llm: getLlm(),
          ctx,
          platform,
          extract: briefRow.extract as any,
        });
      });

      await step.run("persist-summary", async () => {
        if (!summary) return;
        await db
          .update(report_platform_briefs)
          .set({
            summary: summary.brief as Record<string, unknown>,
            prompt_tokens: summary.usage.promptTokens,
            completion_tokens: summary.usage.completionTokens,
          })
          .where(
            and(
              eq(report_platform_briefs.report_id, reportId),
              eq(report_platform_briefs.platform, platform),
            ),
          );
      });

      await step.run("mark-done", async () => {
        await db
          .update(report_platform_jobs)
          .set({
            stage: "done",
            status: "completed",
            completed_at: new Date(),
            last_event_at: new Date(),
          })
          .where(
            and(
              eq(report_platform_jobs.report_id, reportId),
              eq(report_platform_jobs.platform, platform),
            ),
          );
      });

      await step.run("emit-completed", async () => {
        await emit({
          reportId,
          platform,
          stage: "llm.stage_b",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: summary
            ? {
                prompt_tokens: summary.usage.promptTokens,
                completion_tokens: summary.usage.completionTokens,
              }
            : { skipped: true },
        });
      });

      await step.run("fan-in", () => fanInCheck(reportId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        platform,
        stage: "llm.stage_b",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) throw new NonRetriableError(message);
      throw err;
    }
  },
);
