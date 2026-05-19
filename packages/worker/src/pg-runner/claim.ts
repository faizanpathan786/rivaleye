/**
 * Safe Job Claiming with SELECT...FOR UPDATE SKIP LOCKED
 *
 * Implements PostgreSQL's row-level locking to ensure:
 * 1. No two workers claim the same job
 * 2. Stale locks are recoverable (locked_at timestamp allows recovery)
 * 3. Fair FIFO processing (ORDER BY created_at ASC)
 * 4. Non-blocking claiming (SKIP LOCKED means skip to next row if locked)
 *
 * Both functions follow the same pattern:
 * - SELECT the next queued job (with row lock)
 * - UPDATE its status to "running" and capture lock info
 * - Return the updated row so caller can process it
 * - Return null if no jobs available (other workers may have locked them)
 */

import { sql, and, eq, lte, asc } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import type { SourceJobRow, SynthesisJobRow } from "./types";

/**
 * Claim the next available source job (report_platform_jobs).
 *
 * Uses SELECT...FOR UPDATE SKIP LOCKED to atomically:
 * 1. Find the oldest queued job eligible for processing
 * 2. Lock it to prevent other workers from claiming it
 * 3. Transition to "running" status
 * 4. Record the claim timestamp and worker ID
 *
 * @param tx - Drizzle transaction context (caller ensures atomicity)
 * @param workerId - Unique identifier of the claiming worker (e.g. hostname:pid:random)
 * @returns The claimed and updated job row, or null if no jobs available
 */
export async function claimSourceJob(
  tx: PgTransaction<any, any>,
  workerId: string,
): Promise<SourceJobRow | null> {
  // SELECT the next queued job with row lock
  // FOR UPDATE SKIP LOCKED means:
  // - Lock the row so no other transaction can modify it
  // - If already locked by another transaction, skip to the next row (skipLocked: true)
  // - Return at most 1 row
  const selectedRows = await tx
    .select()
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.status, "queued"),
        lte(report_platform_jobs.run_after, sql`now()`),
      ),
    )
    .orderBy(asc(report_platform_jobs.created_at))
    .limit(1)
    .for("update", { skipLocked: true });

  if (!selectedRows || selectedRows.length === 0) {
    return null;
  }

  const selectedJob = selectedRows[0];
  if (!selectedJob) {
    return null;
  }

  // UPDATE the locked job to "running" with claim metadata
  // attempt_count is incremented: attempt_count + 1
  // started_at is only set on first attempt: coalesce(started_at, now())
  // locked_at, locked_by, updated_at, and last_event_at are set to now()
  const updatedRows = await tx
    .update(report_platform_jobs)
    .set({
      status: "running" as const,
      locked_at: sql`now()`,
      locked_by: workerId,
      attempt_count: sql`${report_platform_jobs.attempt_count} + 1`,
      started_at: sql`coalesce(${report_platform_jobs.started_at}, now())`,
      updated_at: sql`now()`,
      last_event_at: sql`now()`,
    })
    .where(eq(report_platform_jobs.id, selectedJob.id))
    .returning();

  if (!updatedRows || updatedRows.length === 0) {
    return null;
  }

  // Cast the database row to SourceJobRow type
  const claimedJob = updatedRows[0];
  if (!claimedJob) {
    return null;
  }

  return {
    id: claimedJob.id,
    report_id: claimedJob.report_id,
    platform: claimedJob.platform,
    status: claimedJob.status as SourceJobRow["status"],
    stage: claimedJob.stage,
    attempt_count: claimedJob.attempt_count,
    max_attempts: claimedJob.max_attempts,
    run_after: claimedJob.run_after,
    locked_at: claimedJob.locked_at,
    locked_by: claimedJob.locked_by,
    started_at: claimedJob.started_at,
    completed_at: claimedJob.completed_at,
    last_error: claimedJob.last_error,
  };
}

/**
 * Claim the next available synthesis job (synthesis_jobs).
 *
 * Identical pattern to claimSourceJob but operates on the synthesis_jobs table.
 * Used for fan-in: after all source jobs complete, a single synthesis job
 * runs LLM clustering and generates the final pain report.
 *
 * @param tx - Drizzle transaction context (caller ensures atomicity)
 * @param workerId - Unique identifier of the claiming worker
 * @returns The claimed and updated job row, or null if no jobs available
 */
export async function claimSynthesisJob(
  tx: PgTransaction<any, any>,
  workerId: string,
): Promise<SynthesisJobRow | null> {
  // SELECT the next queued synthesis job with row lock
  const selectedRows = await tx
    .select()
    .from(synthesis_jobs)
    .where(
      and(
        eq(synthesis_jobs.status, "queued"),
        lte(synthesis_jobs.run_after, sql`now()`),
      ),
    )
    .orderBy(asc(synthesis_jobs.created_at))
    .limit(1)
    .for("update", { skipLocked: true });

  if (!selectedRows || selectedRows.length === 0) {
    return null;
  }

  const selectedJob = selectedRows[0];
  if (!selectedJob) {
    return null;
  }

  // UPDATE the locked job to "running" with claim metadata
  const updatedRows = await tx
    .update(synthesis_jobs)
    .set({
      status: "running" as const,
      locked_at: sql`now()`,
      locked_by: workerId,
      attempt_count: sql`${synthesis_jobs.attempt_count} + 1`,
      started_at: sql`coalesce(${synthesis_jobs.started_at}, now())`,
      updated_at: sql`now()`,
    })
    .where(eq(synthesis_jobs.id, selectedJob.id))
    .returning();

  if (!updatedRows || updatedRows.length === 0) {
    return null;
  }

  // Cast the database row to SynthesisJobRow type
  const claimedJob = updatedRows[0];
  if (!claimedJob) {
    return null;
  }

  return {
    id: claimedJob.id,
    report_id: claimedJob.report_id,
    status: claimedJob.status as SynthesisJobRow["status"],
    attempt_count: claimedJob.attempt_count,
    max_attempts: claimedJob.max_attempts,
    run_after: claimedJob.run_after,
    locked_at: claimedJob.locked_at,
    locked_by: claimedJob.locked_by,
    started_at: claimedJob.started_at,
    completed_at: claimedJob.completed_at,
    last_error: claimedJob.last_error,
  };
}
