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

import { eq } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { log } from "../logger";

/**
 * Partial Report Generation: Fan-In with Early Synthesis Trigger
 *
 * Triggers synthesis job creation as soon as we have enough successful platforms,
 * rather than waiting for all platforms to complete. Failed platforms continue
 * retrying in the background and will trigger resynthesis when they succeed.
 *
 * Triggers synthesis when:
 * - At least 2 platforms succeeded (partial generation), OR
 * - All platforms are terminal and at least 1 succeeded
 *
 * Marks report as "partial: true" until all platforms are complete.
 *
 * @param reportId - UUID of the report
 * @throws Error if database operation fails (not caught; caller decides retry strategy)
 */
export async function fanInCheck(reportId: string): Promise<void> {
  // log() calls use a separate DB connection and are moved OUTSIDE the transaction
  // to avoid side-channel writes that commit even when the transaction rolls back.
  type Outcome =
    | { kind: "not-ready"; completedCount: number; total: number }
    | { kind: "all-failed"; failedPlatforms: string[] }
    | { kind: "created"; id: string; completedCount: number; total: number; isPartial: boolean }
    | { kind: "exists"; completedCount: number; total: number };

  // Idempotency is guaranteed by the unique constraint on synthesis_jobs(report_id)
  // combined with onConflictDoNothing — no advisory lock needed.
  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const jobs = await tx
      .select({ status: report_platform_jobs.status, platform: report_platform_jobs.platform })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    const completedCount = jobs.filter((j) => j.status === "completed").length;
    const failedCount = jobs.filter((j) => j.status === "failed").length;
    const pendingCount = jobs.length - completedCount - failedCount;
    const allTerminal = pendingCount === 0;

    // Trigger synthesis if:
    // 1. At least 1 platform succeeded (generate report even if others pending/failed), OR
    // 2. All platforms are terminal with at least 1 success (complete generation)
    const shouldTrigger = completedCount >= 1 || (allTerminal && completedCount > 0);

    if (!shouldTrigger) {
      return { kind: "not-ready", completedCount, total: jobs.length };
    }

    // If all platforms failed, mark report as failed
    if (allTerminal && completedCount === 0) {
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

    // Mark report as partial if we still have pending platforms
    const isPartial = pendingCount > 0;
    if (isPartial) {
      await tx
        .update(reports)
        .set({
          partial: true,
          failed_platforms: jobs
            .filter((j) => j.status === "failed")
            .map((j) => j.platform ?? "unknown"),
          updated_at: new Date(),
        })
        .where(eq(reports.id, reportId));
    }

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
      return { kind: "created", id: result[0]!.id, completedCount, total: jobs.length, isPartial };
    }
    return { kind: "exists", completedCount, total: jobs.length };
  });

  // Log outcomes after the transaction commits so log entries are never ghost-created
  switch (outcome.kind) {
    case "not-ready":
      await log(reportId, "info", "fan-in", null, `Waiting for first successful platform (${outcome.completedCount}/${outcome.total} completed); will generate report with ≥1 success`);
      break;
    case "all-failed":
      await log(reportId, "warn", "fan-in", null, `All source jobs failed; marking report failed`);
      break;
    case "created":
      const status = outcome.isPartial ? `partial (${outcome.completedCount}/${outcome.total} completed, retrying remainder)` : `complete (all ${outcome.completedCount} platforms succeeded)`;
      await log(reportId, "info", "fan-in", null, `Synthesis triggered with ${status}; creating synthesis job`);
      await log(reportId, "info", "fan-in", null, `Synthesis job created: ${outcome.id}`);
      break;
    case "exists":
      await log(reportId, "info", "fan-in", null, "Synthesis job already exists (insert was no-op)");
      break;
  }
}
