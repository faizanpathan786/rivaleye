import { and, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_jobs,
  report_platform_briefs,
} from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { fanInCheck } from "./fan-in";

let _llm: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  return _llm;
}

export const stageA = inngest.createFunction(
  {
    id: "llm-stage-a",
    concurrency: [{ limit: 4 }],
    retries: 4,
    idempotency: "event.data.reportId + ':' + event.data.platform + ':a'",
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
  { event: "llm.stage-a" },
  async ({ event, step, attempt }) => {
    const { reportId, platform } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", async () => {
      await emit({
        reportId,
        platform,
        stage: "llm.stage_a",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      });
    });

    try {
      const result = await step.run("extract", async () => {
        const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
        if (!report) throw new PermanentError(`report ${reportId} not found`);

        const posts = await db
          .select()
          .from(mentions)
          .where(and(eq(mentions.report_id, reportId), eq(mentions.platform, platform)));

        if (posts.length === 0) {
          return { extract: null as null | Record<string, unknown>, usage: { promptTokens: 0, completionTokens: 0 } };
        }

        const ctx = {
          reportId,
          competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
          category: report.category,
          audience: report.audience ?? null,
          goal: report.goal,
        };

        const stageARes = await runStageAExtract({
          llm: getLlm(),
          ctx,
          platform,
          posts: posts.map((m) => ({
            platform: m.platform as any,
            externalId: m.external_id,
            url: m.url ?? "",
            author: m.author ?? "",
            title: m.title ?? "",
            body: m.body ?? "",
            score: m.score ?? 0,
            numComments: m.num_comments ?? 0,
            createdAt: m.posted_at ?? new Date(),
            raw: (m.raw ?? {}) as Record<string, unknown>,
          })),
        });

        return {
          extract: stageARes.extract as Record<string, unknown>,
          usage: stageARes.usage,
        };
      });

      await step.run("persist-extract", async () => {
        if (!result.extract) return;
        await db
          .insert(report_platform_briefs)
          .values({
            report_id: reportId,
            platform,
            extract: result.extract,
            summary: {} as Record<string, unknown>,
            model_used: LLM_MODEL,
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
          })
          .onConflictDoUpdate({
            target: [report_platform_briefs.report_id, report_platform_briefs.platform],
            set: {
              extract: result.extract,
              prompt_tokens: result.usage.promptTokens,
              completion_tokens: result.usage.completionTokens,
            },
          });
      });

      await step.run("mark-stage-b", async () => {
        await db
          .update(report_platform_jobs)
          .set({ stage: "stage_b", last_event_at: new Date() })
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
          stage: "llm.stage_a",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: {
            prompt_tokens: result.usage.promptTokens,
            completion_tokens: result.usage.completionTokens,
            had_posts: result.extract !== null,
          },
        });
      });

      await step.sendEvent("enqueue-stage-b", {
        name: "llm.stage-b",
        data: { reportId, platform },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        platform,
        stage: "llm.stage_a",
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
