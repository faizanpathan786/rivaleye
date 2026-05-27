/**
 * One-shot script: re-run Stage D (role synthesis) for an existing report.
 * Deletes D+E checkpoints and runs runPipeline directly.
 *
 * Usage: bun --env-file=../../.env src/scripts/run-synthesis.ts <reportId>
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_pipeline_checkpoints, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { runPipeline } from "../pipeline/run";
import pino from "pino";

const log = pino({ name: "run-synthesis" });

const [reportId] = process.argv.slice(2);
if (!reportId) {
  console.error("Usage: bun run-synthesis.ts <reportId>");
  process.exit(1);
}

log.info({ reportId }, "Starting direct synthesis run");

// Delete D and E checkpoints so pipeline re-runs them
for (const stage of ["D", "E"] as const) {
  await db
    .delete(report_pipeline_checkpoints)
    .where(
      and(
        eq(report_pipeline_checkpoints.report_id, reportId),
        eq(report_pipeline_checkpoints.stage, stage),
      )
    );
}
log.info("Deleted D and E checkpoints");

// Set report to running so pipeline can update it
await db
  .update(reports)
  .set({ status: "running", stage: "clustering", updated_at: new Date() })
  .where(eq(reports.id, reportId));

// Run the pipeline
try {
  await runPipeline(reportId);
  log.info({ reportId }, "Pipeline completed successfully");

  // Mark report completed
  await db
    .update(reports)
    .set({ status: "completed", stage: "done", updated_at: new Date() })
    .where(eq(reports.id, reportId));

  // Mark synthesis job completed
  await db
    .update(synthesis_jobs)
    .set({
      status: "completed",
      completed_at: new Date(),
      locked_at: null,
      locked_by: null,
      updated_at: new Date(),
    })
    .where(eq(synthesis_jobs.report_id, reportId));

  log.info({ reportId }, "All done");
  process.exit(0);
} catch (err) {
  log.error({ reportId, error: err instanceof Error ? err.message : String(err) }, "Pipeline failed");
  process.exit(1);
}
