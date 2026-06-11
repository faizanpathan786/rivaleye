/**
 * Process a single synthesis job: clustering, refinement, and report generation.
 *
 * Handles the complete LLM pipeline for a report:
 * 1. Verify all source jobs completed (or partial with some failures)
 * 2. Run synthesis pipeline (Stage C, D, E)
 * 3. Persist output to report tables
 * 4. Mark job completed
 *
 * On error: retry with exponential backoff until max_attempts exceeded.
 */

import { eq } from "drizzle-orm";
import pino from "pino";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs, synthesis_jobs, report_pipeline_checkpoints } from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { runPipeline } from "../pipeline/run";
import { PermanentError } from "../errors";
import type { SynthesisJobRow } from "./types";

const log = pino({ name: "synthesis-worker" });

/**
 * Exponential backoff: 30s, 2m, 5m for attempts 0, 1, 2+
 */
function getBackoffMs(attemptCount: number): number {
  const seconds = [30, 120, 300]; // 30s, 2m, 5m
  return (seconds[attemptCount] ?? 300) * 1000;
}

/**
 * Process a claimed synthesis job: verify fan-in → run pipeline → mark completed.
 *
 * Fan-in check:
 * - All source jobs must be either completed or failed
 * - If all failed: mark synthesis as failed (PermanentError)
 * - If some succeeded: proceed with synthesis (partial report if some failed)
 *
 * On error:
 * - If attempt_count < max_attempts: reset to queued with exponential backoff
 * - If attempt_count >= max_attempts: mark failed
 *
 * @param job - The claimed synthesis job from synthesis_jobs
 * @param reportRow - The report record (loaded by caller)
 * @param workerId - Unique worker identifier for logging
 */
export async function processSynthesisJob(
  job: SynthesisJobRow,
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string },
  workerId: string,
): Promise<void> {
  const startedAt = Date.now();

  try {
    log.info(
      { jobId: job.id, reportId: job.report_id },
      "Starting synthesis job processing"
    );

    // Check if report is cancelled before processing
    const [reportCheck] = await db.select({ status: reports.status }).from(reports).where(eq(reports.id, job.report_id)).limit(1);
    if (reportCheck?.status === "cancelled") {
      log.info({ jobId: job.id, reportId: job.report_id }, "Report is cancelled; marking synthesis job as cancelled");
      await db
        .update(synthesis_jobs)
        .set({
          status: "cancelled",
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, job.id));
      return;
    }

    // Step 1: Emit started event
    await emit({
      reportId: job.report_id,
      stage: "synth.run",
      event: "started",
      attempt: job.attempt_count,
    });

    // Step 2: Verify fan-in (all source jobs completed or failed)
    log.info({ reportId: job.report_id }, "Verifying fan-in completion");
    const sourceJobs = await db
      .select({
        platform: report_platform_jobs.platform,
        status: report_platform_jobs.status,
      })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, job.report_id));

    const completedPlatforms = sourceJobs
      .filter((j) => j.status === "completed")
      .map((j) => j.platform);
    const failedPlatforms = sourceJobs
      .filter((j) => j.status === "failed")
      .map((j) => j.platform);
    const pendingPlatforms = sourceJobs.filter(
      (j) => j.status !== "completed" && j.status !== "failed"
    );

    if (pendingPlatforms.length > 0) {
      // Not all source jobs are done; defer synthesis
      const errorMsg = `Fan-in not ready: ${pendingPlatforms.length} platforms still pending`;
      log.warn(
        {
          jobId: job.id,
          reportId: job.report_id,
          pendingCount: pendingPlatforms.length,
          pendingPlatforms: pendingPlatforms.map((j) => j.platform),
        },
        errorMsg
      );

      // Reset to queued and wait for source jobs to finish
      const backoffMs = 5000; // 5 seconds, shorter backoff for pending case
      await db
        .update(synthesis_jobs)
        .set({
          status: "queued",
          run_after: new Date(Date.now() + backoffMs),
          locked_at: null,
          locked_by: null,
          last_error: errorMsg,
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, job.id));

      // Re-throw as transient error (retriable)
      throw new Error(errorMsg);
    }

    if (completedPlatforms.length === 0) {
      // All source jobs failed; permanent failure
      const errorMsg = `All source jobs failed; no data to synthesize`;
      log.error(
        {
          jobId: job.id,
          reportId: job.report_id,
          failedCount: failedPlatforms.length,
        },
        errorMsg
      );

      throw new PermanentError(errorMsg);
    }

    // Step 3: Update report stage to "clustering" before running pipeline
    await db
      .update(reports)
      .set({ stage: "clustering", updated_at: new Date() })
      .where(eq(reports.id, job.report_id));

    log.info(
      {
        reportId: job.report_id,
        completedPlatforms,
        failedPlatforms,
        totalPlatforms: sourceJobs.length,
      },
      `Fan-in ready: running synthesis (${completedPlatforms.length}/${sourceJobs.length} platforms succeeded)`
    );

    await runPipeline(job.report_id);

    // Step 4: Update report status to mark synthesis complete
    log.info({ reportId: job.report_id }, "Updating report status to completed");
    await db
      .update(reports)
      .set({
        status: "completed",
        stage: "done",
        partial: failedPlatforms.length > 0,
        failed_platforms: failedPlatforms,
        updated_at: new Date(),
      })
      .where(eq(reports.id, job.report_id));

    // Step 5: Check if a re-synthesis was requested due to late platform success
    if (job.rerun_requested) {
      log.info(
        { jobId: job.id, reportId: job.report_id },
        "Re-synthesis requested; clearing checkpoints and re-queuing job"
      );

      await db.transaction(async (tx) => {
        // Clear all checkpoints so synthesis re-runs from scratch over updated briefs
        await tx
          .delete(report_pipeline_checkpoints)
          .where(eq(report_pipeline_checkpoints.report_id, job.report_id));

        // Re-queue the synthesis job for another run
        await tx
          .update(synthesis_jobs)
          .set({
            status: "queued",
            run_after: new Date(),
            attempt_count: 0,
            rerun_requested: false,
            locked_at: null,
            locked_by: null,
            last_error: null,
            updated_at: new Date(),
          })
          .where(eq(synthesis_jobs.id, job.id));
      });

      log.info(
        { jobId: job.id, reportId: job.report_id },
        "Synthesis job re-queued for full rebuild with updated platform data"
      );
      return; // Exit early; don't emit completed
    }

    // Step 5b: Mark job completed (if no rerun requested)
    const durationMs = Date.now() - startedAt;
    log.info({ jobId: job.id, durationMs }, "Marking synthesis job completed");
    await db
      .update(synthesis_jobs)
      .set({
        status: "completed",
        completed_at: new Date(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date(),
      })
      .where(eq(synthesis_jobs.id, job.id));

    // Step 6: Emit completed event
    await emit({
      reportId: job.report_id,
      stage: "synth.run",
      event: "completed",
      attempt: job.attempt_count,
      durationMs,
      metadata: {
        completed_platforms: completedPlatforms,
        failed_platforms: failedPlatforms,
        partial: failedPlatforms.length > 0,
      },
    });

    log.info(
      { jobId: job.id, reportId: job.report_id },
      "Synthesis job completed successfully"
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;

    const cause = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : String(err.cause ?? "")) : "";
    const fullError = cause ? `${errorMsg}: ${cause}` : errorMsg;
    log.error(
      { jobId: job.id, reportId: job.report_id, error: errorMsg, cause, durationMs },
      "Synthesis job failed"
    );

    // Emit failed event
    await emit({
      reportId: job.report_id,
      stage: "synth.run",
      event: "failed",
      attempt: job.attempt_count,
      durationMs,
      error: fullError,
    });

    // Determine if we should retry or fail permanently
    const isPermanent = err instanceof PermanentError;

    if (!isPermanent && job.attempt_count < job.max_attempts) {
      // Retry: reset to queued with exponential backoff
      const backoffMs = getBackoffMs(job.attempt_count);
      log.info(
        {
          jobId: job.id,
          attemptCount: job.attempt_count,
          maxAttempts: job.max_attempts,
          backoffMs,
        },
        "Retrying synthesis job with backoff"
      );

      await db
        .update(synthesis_jobs)
        .set({
          status: "queued",
          run_after: new Date(Date.now() + backoffMs),
          locked_at: null,
          locked_by: null,
          last_error: fullError,
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, job.id));
    } else {
      // Permanent failure: mark failed
      log.error(
        {
          jobId: job.id,
          attemptCount: job.attempt_count,
          maxAttempts: job.max_attempts,
          isPermanent,
        },
        "Synthesis job exceeded max attempts or is permanent failure; marking as failed"
      );

      await db
        .update(synthesis_jobs)
        .set({
          status: "failed",
          locked_at: null,
          locked_by: null,
          last_error: fullError,
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, job.id));

      // Also mark report as failed
      await db
        .update(reports)
        .set({
          status: "failed",
          stage: "failed",
          error: fullError,
          updated_at: new Date(),
        })
        .where(eq(reports.id, job.report_id));
    }

    // Re-throw so caller knows job failed
    throw err;
  }
}
