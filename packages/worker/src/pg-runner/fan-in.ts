/**
 * Fan-In Synthesis Job Creation
 *
 * After all source jobs for a report are terminal (completed or failed),
 * create a synthesis job for LLM clustering and report generation.
 *
 * Uses advisory locking to ensure exactly one synthesis job is created per report,
 * even if multiple workers call fanInCheck simultaneously.
 *
 * Idempotent: safe to call multiple times (e.g., after each source job completes).
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { log } from "../logger";

/**
 * Check if all source jobs for a report are terminal.
 * If yes and at least one succeeded, create a synthesis job.
 *
 * Uses pg_advisory_xact_lock(hashtext(reportId)) to prevent race conditions:
 * - Only one worker acquires the lock at a time
 * - Locked worker reads job statuses and decides whether to create synthesis job
 * - Uses onConflictDoNothing on synthesis_jobs insert for idempotency
 *
 * @param reportId - UUID of the report
 * @throws Error if database operation fails (not caught; caller decides retry strategy)
 */
export async function fanInCheck(reportId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // Acquire advisory lock scoped to this transaction
    // hashtext(reportId) converts string to stable hash for locking
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);

    await log(reportId, "info", "fan-in", null, "Acquired advisory lock; checking source job statuses");

    // Load all source jobs for this report
    const jobs = await tx
      .select({ status: report_platform_jobs.status, platform: report_platform_jobs.platform })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    // Check if all jobs are terminal (completed or failed)
    const allTerminal =
      jobs.length > 0 &&
      jobs.every((j) => j.status === "completed" || j.status === "failed");

    if (!allTerminal) {
      const terminalCount = jobs.filter((j) => j.status === "completed" || j.status === "failed").length;
      await log(reportId, "info", "fan-in", null, `Not all source jobs are terminal (${terminalCount}/${jobs.length}); skipping synthesis job creation`);
      return;
    }

    // Check if at least one job succeeded (completed)
    const hasCompletedJob = jobs.some((j) => j.status === "completed");

    if (!hasCompletedJob) {
      await log(reportId, "warn", "fan-in", null, `All source jobs failed; marking report failed`);
      const failedPlatforms = jobs.map((j) => j.platform ?? "unknown");
      await tx
        .update(reports)
        .set({
          status: "failed",
          stage: "failed",
          partial: false,
          failed_platforms: failedPlatforms,
          error: "All platforms failed to fetch data",
          updated_at: new Date(),
        })
        .where(eq(reports.id, reportId));
      return;
    }

    const completedCount = jobs.filter((j) => j.status === "completed").length;
    await log(reportId, "info", "fan-in", null, `All source jobs terminal with at least one success (${completedCount}/${jobs.length}); creating synthesis job`);

    // Create synthesis job using onConflictDoNothing for idempotency
    // The unique constraint synthesis_jobs_report_id_uniq ensures only one per report
    const result = await tx
      .insert(synthesis_jobs)
      .values({
        report_id: reportId,
        status: "queued" as const,
        attempt_count: 0,
        max_attempts: 2,
        run_after: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    if (result.length > 0) {
      await log(reportId, "info", "fan-in", null, `Synthesis job created: ${result[0]?.id}`);
    } else {
      await log(reportId, "info", "fan-in", null, "Synthesis job already exists (insert was no-op)");
    }
  });
}
