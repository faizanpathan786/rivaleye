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
  // All decision logic runs inside a transaction with an advisory lock.
  // log() calls use a separate DB connection and are moved OUTSIDE the transaction
  // to avoid side-channel writes that commit even when the transaction rolls back.
  type Outcome =
    | { kind: "not-ready"; terminalCount: number; total: number }
    | { kind: "all-failed"; failedPlatforms: string[] }
    | { kind: "created"; id: string; completedCount: number; total: number }
    | { kind: "exists"; completedCount: number; total: number };

  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);

    const jobs = await tx
      .select({ status: report_platform_jobs.status, platform: report_platform_jobs.platform })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    const allTerminal =
      jobs.length > 0 &&
      jobs.every((j) => j.status === "completed" || j.status === "failed");

    if (!allTerminal) {
      const terminalCount = jobs.filter((j) => j.status === "completed" || j.status === "failed").length;
      return { kind: "not-ready", terminalCount, total: jobs.length };
    }

    const hasCompletedJob = jobs.some((j) => j.status === "completed");
    if (!hasCompletedJob) {
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
      return { kind: "all-failed", failedPlatforms };
    }

    const completedCount = jobs.filter((j) => j.status === "completed").length;

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
      return { kind: "created", id: result[0]!.id, completedCount, total: jobs.length };
    }
    return { kind: "exists", completedCount, total: jobs.length };
  });

  // Log outcomes after the transaction commits so log entries are never ghost-created
  switch (outcome.kind) {
    case "not-ready":
      await log(reportId, "info", "fan-in", null, `Not all source jobs are terminal (${outcome.terminalCount}/${outcome.total}); skipping synthesis job creation`);
      break;
    case "all-failed":
      await log(reportId, "warn", "fan-in", null, `All source jobs failed; marking report failed`);
      break;
    case "created":
      await log(reportId, "info", "fan-in", null, `All source jobs terminal with at least one success (${outcome.completedCount}/${outcome.total}); creating synthesis job`);
      await log(reportId, "info", "fan-in", null, `Synthesis job created: ${outcome.id}`);
      break;
    case "exists":
      await log(reportId, "info", "fan-in", null, `All source jobs terminal with at least one success (${outcome.completedCount}/${outcome.total}); creating synthesis job`);
      await log(reportId, "info", "fan-in", null, "Synthesis job already exists (insert was no-op)");
      break;
  }
}
