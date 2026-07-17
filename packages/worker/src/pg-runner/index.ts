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
import { eq } from "drizzle-orm";
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
import { recoverStaleJobs as recoverStaleJobsOnce } from "./recovery";
import { pollPdfJobs } from "./pdf-worker";
import { isShuttingDown, registerInFlight, unregisterInFlight, installSignalHandlers } from "./shutdown";
import { withLlmContext } from "@rivaleye/shared";

const log = pino({ name: "pg-runner" });

// Per-report LLM token budget (prompt + completion, summed across the flow).
// 0/unset disables the cap. Bounds runaway spend on a pathological scan.
const LLM_BUDGET_TOKENS = (() => {
  const n = parseInt(process.env.MAX_LLM_TOKENS_PER_REPORT ?? "", 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
})();

/**
 * Parse an env var as an integer, falling back to a default on NaN,
 * and clamping the result to [min, max].
 *
 * @param raw - Raw env var value (may be undefined)
 * @param def - Fallback value when raw is missing or not a number
 * @param min - Lower bound (inclusive)
 * @param max - Upper bound (inclusive)
 */
function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(parsed)) return def;
  return Math.min(max, Math.max(min, parsed));
}

const MAX_CONCURRENT_SOURCE = clampInt(process.env.WORKER_MAX_CONCURRENT_SOURCE, 8, 1, 20);
const MAX_CONCURRENT_SYNTHESIS = clampInt(process.env.WORKER_MAX_CONCURRENT_SYNTHESIS, 2, 1, 5);

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
  let activeJobs = 0;

  log.info(
    { workerId: config.workerId, interval: config.pollIntervalMs, maxConcurrent: MAX_CONCURRENT_SOURCE },
    "Starting source job polling loop"
  );

  while (true) {
    try {
      if (isShuttingDown()) return;

      if (activeJobs >= MAX_CONCURRENT_SOURCE) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      const job = await db.transaction(async (tx) =>
        claimSourceJob(tx as any, config.workerId)
      );

      if (!job) {
        await sleep(idlePollMs(config.pollIntervalMs));
        continue;
      }

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

      // Fire and forget — increment counter before async work starts
      activeJobs++;
      registerInFlight(job.id, "source");
      withLlmContext({ reportId: job.report_id, budgetTokens: LLM_BUDGET_TOKENS }, () =>
        processSourceJob(job, report, config.workerId),
      )
        .then(() => {
          log.info({ jobId: job.id, platform: job.platform }, "Source job completed successfully");
        })
        .catch((err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          log.error({ jobId: job.id, platform: job.platform, error: errorMsg }, "Source job processing failed");
        })
        .finally(() => {
          activeJobs--;
          unregisterInFlight(job.id);
        });

      // No sleep — immediately try to claim another job up to MAX_CONCURRENT_SOURCE
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (isConnectionError(err)) {
        log.warn({ error: errorMsg }, "DB connection lost in source polling loop — backing off 5s");
        await sleep(5000);
      } else {
        log.error({ error: errorMsg }, "Unexpected error in source polling loop");
        await sleep(config.pollIntervalMs);
      }
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
  let activeJobs = 0;

  log.info(
    { workerId: config.workerId, interval: config.pollIntervalMs, maxConcurrent: MAX_CONCURRENT_SYNTHESIS },
    "Starting synthesis job polling loop"
  );

  while (true) {
    try {
      if (isShuttingDown()) return;

      if (activeJobs >= MAX_CONCURRENT_SYNTHESIS) {
        await sleep(config.pollIntervalMs);
        continue;
      }

      // Claim the next job within a transaction for atomicity
      const job = await db.transaction(async (tx) =>
        claimSynthesisJob(tx as any, config.workerId)
      );

      if (!job) {
        // No jobs available; sleep and try again
        await sleep(idlePollMs(config.pollIntervalMs));
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

      // Fire and forget — increment counter before async work starts
      activeJobs++;
      registerInFlight(job.id, "synthesis");
      withLlmContext({ reportId: job.report_id, budgetTokens: LLM_BUDGET_TOKENS }, () =>
        processSynthesisJob(job, report, config.workerId),
      )
        .then(() => {
          log.info(
            { jobId: job.id, reportId: job.report_id },
            "Synthesis job completed successfully"
          );
        })
        .catch((err: unknown) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          log.error(
            { jobId: job.id, reportId: job.report_id, error: errorMsg },
            "Synthesis job processing failed"
          );
          // Job handles its own retry logic
        })
        .finally(() => {
          activeJobs--;
          unregisterInFlight(job.id);
        });

      // No sleep — immediately try to claim another job up to MAX_CONCURRENT_SYNTHESIS
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (isConnectionError(err)) {
        log.warn({ error: errorMsg }, "DB connection lost in synthesis polling loop — backing off 5s");
        await sleep(5000);
      } else {
        log.error({ error: errorMsg }, "Unexpected error in synthesis polling loop");
        await sleep(config.pollIntervalMs);
      }
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
    if (isShuttingDown()) return;
    try {
      // Delegate to the single hardened implementation in recovery.ts, which
      // respects max_attempts, fail-forwards when synthesis already started,
      // guards its UPDATEs on the observed lock, and heals orphaned + all-failed
      // reports. (This module previously carried an inferior duplicate that
      // re-queued forever without a max_attempts check — removed.)
      await recoverStaleJobsOnce(config);
      await sleep(RECOVERY_POLL_MS);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (isConnectionError(err)) {
        log.warn({ error: errorMsg }, "DB connection lost in recovery loop — backing off 5s");
        await sleep(5000);
      } else {
        log.error({ error: errorMsg }, "Error in recovery loop");
        await sleep(RECOVERY_POLL_MS);
      }
    }
  }
}

/**
 * Idle poll interval with jitter. When no job was claimed we back off to a
 * larger interval (up to 8× base) with ±25% jitter so N idle workers don't
 * hammer PgBouncer in lockstep every 500ms. Busy loops (a job was claimed)
 * skip this and re-poll immediately.
 */
function idlePollMs(baseMs: number): number {
  const capped = Math.min(baseMs * 8, 4000);
  const jitter = capped * 0.25 * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
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

function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("CONNECTION_CLOSED") ||
    msg.includes("CONNECTION_DESTROYED") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("CONNECT_TIMEOUT")
  );
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
    pollIntervalMs: 500,
    sourceJobTimeoutMinutes: 25,
    synthesisJobTimeoutMinutes: 90,
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

  installSignalHandlers(config.workerId, log);

  // Run three concurrent loops; any unhandled error in main() will cause process exit
  try {
    await Promise.all([
      pollSourceJobs(config),
      pollSynthesisJobs(config),
      pollPdfJobs(config),
      recoverStaleJobs(config),
    ]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.fatal({ error: errorMsg }, "Fatal error in main loop");
    process.exit(1);
  }
}

async function mainScrapeOnly(): Promise<void> {
  const workerId = generateWorkerId();
  const config: WorkerConfig = {
    workerId,
    pollIntervalMs: 500,
    sourceJobTimeoutMinutes: 25,
    synthesisJobTimeoutMinutes: 90,
  };
  log.info({ workerId, mode: "scrape-only" }, "Starting pg-runner (scrape + recovery only)");
  installSignalHandlers(workerId, log);
  try {
    await Promise.all([
      pollSourceJobs(config),
      recoverStaleJobs(config),
    ]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.fatal({ error: errorMsg }, "Fatal error in scrape-only main loop");
    process.exit(1);
  }
}

async function mainSynthOnly(): Promise<void> {
  const workerId = generateWorkerId();
  const config: WorkerConfig = {
    workerId,
    pollIntervalMs: 500,
    sourceJobTimeoutMinutes: 25,
    synthesisJobTimeoutMinutes: 90,
  };
  log.info({ workerId, mode: "synth-only" }, "Starting pg-runner (synthesis + recovery only)");
  installSignalHandlers(workerId, log);
  try {
    await Promise.all([
      pollSynthesisJobs(config),
      pollPdfJobs(config),
      recoverStaleJobs(config),
    ]);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.fatal({ error: errorMsg }, "Fatal error in synth-only main loop");
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
  main,
  mainScrapeOnly,
  mainSynthOnly,
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
