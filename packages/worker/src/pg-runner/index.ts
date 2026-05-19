/**
 * PostgreSQL-based Job Runner (pg-runner)
 *
 * Main entry point with three concurrent polling loops:
 * 1. pollSourceJobs: Claims and processes source jobs (platform scrapers)
 * 2. pollSynthesisJobs: Claims and processes synthesis jobs (LLM clustering)
 * 3. recoverStaleJobs: Periodically recovers jobs locked by crashed workers
 *
 * Worker identification:
 * - Each process gets a unique ID: hostname:pid:random
 * - Used for locking and recovery metadata
 *
 * Architecture:
 * - SELECT...FOR UPDATE SKIP LOCKED for atomic job claiming
 * - Transaction-based state machine for job status transitions
 * - Exponential backoff on retries (30s, 2m, 5m)
 * - Configurable timeouts for stale job detection
 *
 * Run: `bun src/pg-runner/index.ts`
 */

import os from "os";
import pino from "pino";
import { and, eq, lte } from "drizzle-orm";
import { db } from "../db";
import {
  report_platform_jobs,
  synthesis_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { claimSourceJob, claimSynthesisJob } from "./claim";
import type { WorkerConfig, SourceJobRow, SynthesisJobRow } from "./types";
import { processSourceJob } from "./source-worker";
import { processSynthesisJob } from "./synthesis-worker";

const log = pino({ name: "pg-runner" });

/**
 * Generate a unique worker ID combining hostname, process ID, and random suffix.
 *
 * Format: hostname:pid:random
 * Example: ip-172-31-0-1:12345:a7b3c2
 *
 * @returns Unique worker identifier
 */
function generateWorkerId(): string {
  const hostname = os.hostname();
  const pid = process.pid;
  const random = Math.random().toString(36).slice(2, 8);
  return `${hostname}:${pid}:${random}`;
}

/**
 * Poll and process source jobs continuously.
 *
 * Main worker loop:
 * 1. Claim the next queued source job
 * 2. Load the associated report metadata
 * 3. Process the job (fetch → extract → summarize → fan-in)
 * 4. Sleep before polling again
 *
 * Errors during job processing are logged but do not stop the polling loop.
 * The job itself handles retries and state transitions.
 *
 * @param config - Worker configuration (ID, poll interval, timeouts)
 */
async function pollSourceJobs(config: WorkerConfig): Promise<void> {
  log.info(
    { workerId: config.workerId, interval: config.pollIntervalMs },
    "Starting source job polling loop"
  );

  while (true) {
    try {
      // Claim the next job within a transaction for atomicity
      const job = await db.transaction(async (tx) =>
        claimSourceJob(tx as any, config.workerId)
      );

      if (!job) {
        // No jobs available; sleep and try again
        await sleep(config.pollIntervalMs);
        continue;
      }

      // Load report metadata for context
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, job.report_id))
        .limit(1);

      if (!report) {
        log.warn(
          { jobId: job.id, reportId: job.report_id },
          "Report not found for claimed job"
        );
        // Mark job failed and move on
        await db
          .update(report_platform_jobs)
          .set({
            status: "failed",
            stage: "failed",
            locked_at: null,
            locked_by: null,
            last_error: "Report not found",
            completed_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(report_platform_jobs.id, job.id));
        continue;
      }

      // Process the job
      try {
        await processSourceJob(job, report, config.workerId);
        log.info(
          { jobId: job.id, platform: job.platform },
          "Source job completed successfully"
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(
          { jobId: job.id, platform: job.platform, error: errorMsg },
          "Source job processing failed"
        );
        // Job handles its own retry logic, so we continue polling
      }

      // No sleep between successful processes; claim the next job immediately
    } catch (err) {
      // Unexpected error in polling loop; log and continue
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ error: errorMsg }, "Unexpected error in source polling loop");
      await sleep(config.pollIntervalMs);
    }
  }
}

/**
 * Poll and process synthesis jobs continuously.
 *
 * Main worker loop:
 * 1. Claim the next queued synthesis job
 * 2. Load the associated report metadata
 * 3. Process the job (LLM clustering and report generation)
 * 4. Sleep before polling again
 *
 * Errors during job processing are logged but do not stop the polling loop.
 *
 * @param config - Worker configuration (ID, poll interval, timeouts)
 */
async function pollSynthesisJobs(config: WorkerConfig): Promise<void> {
  log.info(
    { workerId: config.workerId, interval: config.pollIntervalMs },
    "Starting synthesis job polling loop"
  );

  while (true) {
    try {
      // Claim the next job within a transaction for atomicity
      const job = await db.transaction(async (tx) =>
        claimSynthesisJob(tx as any, config.workerId)
      );

      if (!job) {
        // No jobs available; sleep and try again
        await sleep(config.pollIntervalMs);
        continue;
      }

      // Load report metadata for context
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, job.report_id))
        .limit(1);

      if (!report) {
        log.warn(
          { jobId: job.id, reportId: job.report_id },
          "Report not found for claimed synthesis job"
        );
        // Mark job failed
        await db
          .update(synthesis_jobs)
          .set({
            status: "failed",
            locked_at: null,
            locked_by: null,
            last_error: "Report not found",
            completed_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(synthesis_jobs.id, job.id));
        continue;
      }

      // Process the job
      try {
        await processSynthesisJob(job, report, config.workerId);
        log.info(
          { jobId: job.id, reportId: job.report_id },
          "Synthesis job completed successfully"
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(
          { jobId: job.id, reportId: job.report_id, error: errorMsg },
          "Synthesis job processing failed"
        );
        // Job handles its own retry logic
      }

      // No sleep between successful processes
    } catch (err) {
      // Unexpected error in polling loop
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error(
        { error: errorMsg },
        "Unexpected error in synthesis polling loop"
      );
      await sleep(config.pollIntervalMs);
    }
  }
}

/**
 * Periodically recover jobs locked by crashed or stalled workers.
 *
 * Stale job recovery strategy:
 * 1. Find all jobs locked longer than the timeout threshold
 * 2. Unlock them and reset to "queued" with backoff
 * 3. Run periodically (every 30 seconds by default)
 *
 * Timeouts are separate for source and synthesis jobs:
 * - Source jobs: 15 minutes (scrapers can be slow)
 * - Synthesis jobs: 30 minutes (LLM processing can be slow)
 *
 * This prevents jobs from being stuck forever if a worker crashes.
 *
 * @param config - Worker configuration (ID, timeouts)
 */
async function recoverStaleJobs(config: WorkerConfig): Promise<void> {
  log.info(
    { workerId: config.workerId },
    "Starting stale job recovery loop (every 30s)"
  );

  const RECOVERY_POLL_MS = 30000; // 30 seconds

  while (true) {
    try {
      // Recover stale source jobs
      const sourceTimeout = new Date(
        Date.now() - config.sourceJobTimeoutMinutes * 60 * 1000
      );

      const staleSourceJobs = await db
        .select()
        .from(report_platform_jobs)
        .where(
          and(
            eq(report_platform_jobs.status, "running"),
            lte(report_platform_jobs.locked_at, sourceTimeout)
          )
        );

      if (staleSourceJobs.length > 0) {
        log.warn(
          { count: staleSourceJobs.length, timeoutMinutes: config.sourceJobTimeoutMinutes },
          "Found stale source jobs; recovering"
        );

        for (const job of staleSourceJobs) {
          // Reset to queued with exponential backoff
          const backoffMs = getBackoffMs(job.attempt_count);
          await db
            .update(report_platform_jobs)
            .set({
              status: "queued",
              run_after: new Date(Date.now() + backoffMs),
              locked_at: null,
              locked_by: null,
              last_error: `Stale lock recovered by ${config.workerId} after ${config.sourceJobTimeoutMinutes}m`,
              updated_at: new Date(),
            })
            .where(eq(report_platform_jobs.id, job.id));

          log.info(
            {
              jobId: job.id,
              platform: job.platform,
              attemptCount: job.attempt_count,
              backoffMs,
            },
            "Recovered stale source job"
          );
        }
      }

      // Recover stale synthesis jobs
      const synthesisTimeout = new Date(
        Date.now() - config.synthesisJobTimeoutMinutes * 60 * 1000
      );

      const staleSynthesisJobs = await db
        .select()
        .from(synthesis_jobs)
        .where(
          and(
            eq(synthesis_jobs.status, "running"),
            lte(synthesis_jobs.locked_at, synthesisTimeout)
          )
        );

      if (staleSynthesisJobs.length > 0) {
        log.warn(
          { count: staleSynthesisJobs.length, timeoutMinutes: config.synthesisJobTimeoutMinutes },
          "Found stale synthesis jobs; recovering"
        );

        for (const job of staleSynthesisJobs) {
          // Reset to queued with exponential backoff
          const backoffMs = getBackoffMs(job.attempt_count);
          await db
            .update(synthesis_jobs)
            .set({
              status: "queued",
              run_after: new Date(Date.now() + backoffMs),
              locked_at: null,
              locked_by: null,
              last_error: `Stale lock recovered by ${config.workerId} after ${config.synthesisJobTimeoutMinutes}m`,
              updated_at: new Date(),
            })
            .where(eq(synthesis_jobs.id, job.id));

          log.info(
            {
              jobId: job.id,
              reportId: job.report_id,
              attemptCount: job.attempt_count,
              backoffMs,
            },
            "Recovered stale synthesis job"
          );
        }
      }

      // Sleep before next recovery check
      await sleep(RECOVERY_POLL_MS);
    } catch (err) {
      // Log but continue; recovery loop should be resilient
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ error: errorMsg }, "Error in recovery loop");
      await sleep(RECOVERY_POLL_MS);
    }
  }
}

/**
 * Exponential backoff for retries: 30s, 2m, 5m for attempts 0, 1, 2+
 *
 * @param attemptCount - Number of attempts already made
 * @returns Backoff duration in milliseconds
 */
function getBackoffMs(attemptCount: number): number {
  const seconds = [30, 120, 300]; // 30s, 2m, 5m
  return (seconds[attemptCount] ?? 300) * 1000;
}

/**
 * Sleep helper for polling loops.
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main entry point.
 *
 * Initializes configuration and starts all three polling loops concurrently.
 * Runs indefinitely; processes exit via SIGTERM or SIGINT.
 */
async function main(): Promise<void> {
  const workerId = generateWorkerId();

  const config: WorkerConfig = {
    workerId,
    pollIntervalMs: 1500,
    sourceJobTimeoutMinutes: 15,
    synthesisJobTimeoutMinutes: 30,
  };

  log.info(
    {
      workerId: config.workerId,
      pollIntervalMs: config.pollIntervalMs,
      sourceJobTimeoutMinutes: config.sourceJobTimeoutMinutes,
      synthesisJobTimeoutMinutes: config.synthesisJobTimeoutMinutes,
    },
    "Starting pg-runner with configuration"
  );

  // Run three concurrent loops; any unhandled error in main() will cause process exit
  try {
    await Promise.all([
      pollSourceJobs(config),
      pollSynthesisJobs(config),
      recoverStaleJobs(config),
    ]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.fatal({ error: errorMsg }, "Fatal error in main loop");
    process.exit(1);
  }
}

// Export for testing
export {
  generateWorkerId,
  pollSourceJobs,
  pollSynthesisJobs,
  recoverStaleJobs,
  getBackoffMs,
  sleep,
  type WorkerConfig,
};

// Start if run as main module
if (import.meta.main) {
  main().catch((err) => {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.fatal({ error: errorMsg }, "Unhandled error in main");
    process.exit(1);
  });
}
