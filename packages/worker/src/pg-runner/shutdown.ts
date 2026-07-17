/**
 * Graceful shutdown for the pg-runner workers.
 *
 * Without this, a PM2 reload/deploy or an OOM restart SIGKILLs the worker
 * mid-job: the row stays status='running' with a held lock until the stale
 * sweep re-queues it (25–90 min later), wedging every in-flight scan across a
 * deploy. On SIGTERM/SIGINT we instead:
 *   1. stop claiming new jobs (pollers check isShuttingDown()),
 *   2. wait up to DRAIN_DEADLINE_MS for in-flight jobs to finish naturally,
 *   3. release any still-running jobs this worker holds back to 'queued' so a
 *      surviving/next worker picks them up immediately,
 *   4. exit 0.
 *
 * PM2's kill_timeout must be >= DRAIN_DEADLINE_MS + margin (see ecosystem config).
 */
import type { Logger } from "pino";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs, synthesis_jobs, report_pdf_jobs } from "../../../api/src/db/schema/pipeline.js";

const DRAIN_DEADLINE_MS = Number(process.env.WORKER_SHUTDOWN_DRAIN_MS ?? 20_000);

type JobTable = "source" | "synthesis" | "pdf";

let shuttingDown = false;
const inFlight = new Map<string, JobTable>();

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function registerInFlight(jobId: string, table: JobTable): void {
  inFlight.set(jobId, table);
}

export function unregisterInFlight(jobId: string): void {
  inFlight.delete(jobId);
}

export function inFlightCount(): number {
  return inFlight.size;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function releaseHeldLocks(workerId: string, log: Logger): Promise<void> {
  const byTable: Record<JobTable, string[]> = { source: [], synthesis: [], pdf: [] };
  for (const [jobId, table] of inFlight) byTable[table].push(jobId);

  const releaseNote = `Released by ${workerId} on graceful shutdown`;

  if (byTable.source.length > 0) {
    await db
      .update(report_platform_jobs)
      .set({ status: "queued", run_after: new Date(), locked_at: null, locked_by: null, last_error: releaseNote, updated_at: new Date() })
      .where(and(inArray(report_platform_jobs.id, byTable.source), eq(report_platform_jobs.status, "running"), eq(report_platform_jobs.locked_by, workerId)));
  }
  if (byTable.synthesis.length > 0) {
    await db
      .update(synthesis_jobs)
      .set({ status: "queued", run_after: new Date(), locked_at: null, locked_by: null, last_error: releaseNote, updated_at: new Date() })
      .where(and(inArray(synthesis_jobs.id, byTable.synthesis), eq(synthesis_jobs.status, "running"), eq(synthesis_jobs.locked_by, workerId)));
  }
  if (byTable.pdf.length > 0) {
    await db
      .update(report_pdf_jobs)
      .set({ status: "queued", run_after: sql`now()`, locked_at: null, locked_by: null, error: releaseNote, updated_at: sql`now()` })
      .where(and(inArray(report_pdf_jobs.id, byTable.pdf), eq(report_pdf_jobs.status, "running"), eq(report_pdf_jobs.locked_by, workerId)));
  }
}

/**
 * Begin graceful shutdown. Idempotent. Resolves once drain + release completes,
 * after which the caller should exit.
 */
export async function shutdown(workerId: string, log: Logger, signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ workerId, signal, inFlight: inFlight.size }, "Graceful shutdown initiated — no longer claiming jobs");

  const deadline = Date.now() + DRAIN_DEADLINE_MS;
  while (inFlight.size > 0 && Date.now() < deadline) {
    await sleep(250);
  }

  if (inFlight.size > 0) {
    log.warn({ workerId, remaining: inFlight.size }, "Drain deadline hit — releasing still-running job locks back to queued");
    try {
      await releaseHeldLocks(workerId, log);
    } catch (err) {
      log.error({ workerId, err: err instanceof Error ? err.message : String(err) }, "Failed to release held locks during shutdown");
    }
  } else {
    log.info({ workerId }, "All in-flight jobs drained cleanly");
  }
}

/**
 * Install SIGTERM/SIGINT handlers that run graceful shutdown then exit. Call
 * once from each worker entrypoint.
 */
export function installSignalHandlers(workerId: string, log: Logger): void {
  let handling = false;
  const handler = (signal: string) => {
    if (handling) return;
    handling = true;
    shutdown(workerId, log, signal)
      .catch((err) => log.error({ err: err instanceof Error ? err.message : String(err) }, "Shutdown error"))
      .finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => handler("SIGTERM"));
  process.on("SIGINT", () => handler("SIGINT"));
}
