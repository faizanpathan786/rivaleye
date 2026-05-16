import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "../db";
import { inngest } from "../inngest/client";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { runPipeline } from "../pipeline/run";
import { emit } from "../events/emit";
import { PermanentError } from "../errors";

export const synthRun = inngest.createFunction(
  {
    id: "synth-run",
    concurrency: [{ limit: 1, key: "event.data.reportId" }],
    retries: 2,
    idempotency: "event.data.reportId + ':' + (event.data.reason ?? 'fan-in')",
    onFailure: async ({ event, error }) => {
      const reportId = (event.data.event.data as { reportId: string }).reportId;
      await db
        .update(reports)
        .set({ status: "failed", stage: "failed", error: error.message, updated_at: new Date() })
        .where(eq(reports.id, reportId));
    },
  },
  { event: "synth.run" },
  async ({ event, step, attempt }) => {
    const { reportId } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", () =>
      emit({
        reportId,
        stage: "synth.run",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      }),
    );

    try {
      const failedPlatforms = await step.run("compute-failed", async () => {
        const jobs = await db
          .select({ platform: report_platform_jobs.platform, status: report_platform_jobs.status })
          .from(report_platform_jobs)
          .where(eq(report_platform_jobs.report_id, reportId));
        const failed = jobs.filter((j) => j.status === "failed").map((j) => j.platform);
        const succeeded = jobs.filter((j) => j.status === "completed");
        if (succeeded.length === 0) {
          throw new PermanentError("all platforms failed");
        }
        return failed;
      });

      await step.run("run-pipeline", () => runPipeline(reportId));

      await step.run("mark-report-done", async () => {
        await db
          .update(reports)
          .set({
            status: "completed",
            stage: "done",
            partial: failedPlatforms.length > 0,
            failed_platforms: failedPlatforms,
            updated_at: new Date(),
          })
          .where(eq(reports.id, reportId));
      });

      await step.run("emit-completed", () =>
        emit({
          reportId,
          stage: "synth.run",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: { partial: failedPlatforms.length > 0, failed_platforms: failedPlatforms },
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        stage: "synth.run",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) {
        await db
          .update(reports)
          .set({ status: "failed", stage: "failed", error: message, updated_at: new Date() })
          .where(eq(reports.id, reportId));
        throw new NonRetriableError(message);
      }
      throw err;
    }
  },
);
