/**
 * Stale Job Recovery
 *
 * Periodically scans for jobs that have been locked (running) for too long
 * without completing. This handles crashed workers that never released their locks.
 *
 * Recovery strategy:
 * - For source jobs: timeout 15 minutes
 * - For synthesis jobs: timeout 30 minutes
 * - If attempt_count < max_attempts: reset to queued with immediate run_after
 * - If attempt_count >= max_attempts: mark failed and trigger fan-in check
 *
 * Should be run as a background loop (e.g., every 30 seconds) on one worker.
 */

import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { log } from "../logger";
import { fanInCheck } from "./fan-in";
import type { WorkerConfig } from "./types";

/**
 * Recover stale source and synthesis jobs.
 *
 * Finds all running jobs that have been locked for longer than their configured timeout,
 * then either retries or fails them based on attempt count.
 *
 * @param config - Worker configuration with timeout settings
 * @throws Error if database operation fails (not caught; caller decides handling)
 */
export async function recoverStaleJobs(config: WorkerConfig): Promise<void> {
  try {
    await recoverStaleSourceJobs(config.sourceJobTimeoutMinutes);
    await recoverStaleSynthesisJobs(config.synthesisJobTimeoutMinutes);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[recovery] loop failed:", errorMsg);
    throw err;
  }
}

/**
 * Recover stale source jobs (report_platform_jobs).
 *
 * Finds jobs where:
 * - status = 'running'
 * - locked_at < now() - sourceJobTimeoutMinutes
 *
 * Then for each:
 * - If attempt_count < max_attempts: reset to queued, set run_after to now()
 * - If attempt_count >= max_attempts: mark failed, trigger fan-in check
 *
 * @param timeoutMinutes - Number of minutes before a locked job is considered stale
 */
async function recoverStaleSourceJobs(timeoutMinutes: number): Promise<void> {
  const staleThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  console.log(`[recovery] Scanning for stale source jobs (timeout: ${timeoutMinutes}min, threshold: ${staleThreshold.toISOString()})`);

  const staleJobs = await db
    .select()
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.status, "running"),
        lte(report_platform_jobs.locked_at, staleThreshold)
      )
    );

  if (staleJobs.length === 0) {
    console.log("[recovery] No stale source jobs found");
    return;
  }

  console.log(`[recovery] Found ${staleJobs.length} stale source jobs`);

  for (const job of staleJobs) {
    const staleDurationMs = job.locked_at ? new Date().getTime() - job.locked_at.getTime() : 0;

    // If synthesis has already started for this report, re-queuing a source job would
    // break the fan-in check (synthesis sees a pending platform). Always fail-forward.
    const existingSynthesisJob = await db
      .select({ id: synthesis_jobs.id })
      .from(synthesis_jobs)
      .where(
        and(
          eq(synthesis_jobs.report_id, job.report_id),
          inArray(synthesis_jobs.status, ["queued", "running", "completed"])
        )
      )
      .limit(1);

    const synthesisAlreadyStarted = existingSynthesisJob.length > 0;

    if (!synthesisAlreadyStarted && job.attempt_count < job.max_attempts) {
      // Retry: reset to queued with immediate run_after
      console.log(
        `[recovery] Recovering stale source job ${job.id} (report=${job.report_id}, platform=${job.platform}, attempt=${job.attempt_count}/${job.max_attempts}, stale=${staleDurationMs}ms): resetting to queued`
      );

      await db
        .update(report_platform_jobs)
        .set({
          status: "queued" as const,
          run_after: new Date(),
          locked_at: null,
          locked_by: null,
          last_error: `Stale lock detected after ${staleDurationMs}ms; recovered and retried`,
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));

      await log(job.report_id, "warn", "recovery", job.platform, `Job stale for ${staleDurationMs}ms; recovered and retrying (attempt ${job.attempt_count + 1}/${job.max_attempts})`);
    } else {
      const failReason = synthesisAlreadyStarted
        ? `Stale lock detected after ${staleDurationMs}ms; synthesis already started — marking failed to unblock fan-in`
        : `Stale lock detected after ${staleDurationMs}ms; exceeded max attempts`;

      console.error(
        `[recovery] Stale source job ${job.id} (report=${job.report_id}, platform=${job.platform}, attempt=${job.attempt_count}/${job.max_attempts}, stale=${staleDurationMs}ms) — ${synthesisAlreadyStarted ? "synthesis already started" : "exceeded max attempts"}; marking as failed`
      );

      await db
        .update(report_platform_jobs)
        .set({
          status: "failed" as const,
          stage: "failed" as const,
          locked_at: null,
          locked_by: null,
          last_error: failReason,
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));

      await log(job.report_id, "error", "recovery", job.platform, failReason);

      // Trigger fan-in check in case other sources completed
      await fanInCheck(job.report_id);
    }
  }
}

/**
 * Recover stale synthesis jobs (synthesis_jobs).
 *
 * Identical pattern to recoverStaleSourceJobs but operates on synthesis_jobs table
 * with a longer timeout (30 minutes vs 15 minutes for source jobs).
 *
 * @param timeoutMinutes - Number of minutes before a locked job is considered stale
 */
async function recoverStaleSynthesisJobs(timeoutMinutes: number): Promise<void> {
  const staleThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  console.log(`[recovery] Scanning for stale synthesis jobs (timeout: ${timeoutMinutes}min, threshold: ${staleThreshold.toISOString()})`);

  const staleJobs = await db
    .select()
    .from(synthesis_jobs)
    .where(
      and(
        eq(synthesis_jobs.status, "running"),
        lte(synthesis_jobs.locked_at, staleThreshold)
      )
    );

  if (staleJobs.length === 0) {
    console.log("[recovery] No stale synthesis jobs found");
    return;
  }

  console.log(`[recovery] Found ${staleJobs.length} stale synthesis jobs`);

  for (const job of staleJobs) {
    const staleDurationMs = job.locked_at ? new Date().getTime() - job.locked_at.getTime() : 0;

    if (job.attempt_count < job.max_attempts) {
      // Retry: reset to queued with immediate run_after
      console.log(
        `[recovery] Recovering stale synthesis job ${job.id} (report=${job.report_id}, attempt=${job.attempt_count}/${job.max_attempts}, stale=${staleDurationMs}ms): resetting to queued`
      );

      await db
        .update(synthesis_jobs)
        .set({
          status: "queued" as const,
          run_after: new Date(),
          locked_at: null,
          locked_by: null,
          last_error: `Stale lock detected after ${staleDurationMs}ms; recovered and retried`,
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, job.id));

      await log(job.report_id, "warn", "synthesis.recovery", null, `Job stale for ${staleDurationMs}ms; recovered and retrying (attempt ${job.attempt_count + 1}/${job.max_attempts})`);
    } else {
      // Permanent failure: mark failed
      console.error(
        `[recovery] Stale synthesis job ${job.id} (report=${job.report_id}, attempt=${job.attempt_count}/${job.max_attempts}, stale=${staleDurationMs}ms) exceeded max attempts; marking as failed`
      );

      await db
        .update(synthesis_jobs)
        .set({
          status: "failed" as const,
          locked_at: null,
          locked_by: null,
          last_error: `Stale lock detected after ${staleDurationMs}ms; exceeded max attempts`,
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, job.id));

      await log(job.report_id, "error", "synthesis.recovery", null, `Job stale for ${staleDurationMs}ms; exceeded max attempts and marked as failed`);
    }
  }
}
