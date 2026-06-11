/**
 * Re-synthesis trigger.
 *
 * Called when a platform that previously failed is recovered in the background
 * AFTER the report's first (partial) synthesis already ran. To fold the late
 * platform in without degrading quality, we throw away the cached C/D/E
 * checkpoints and re-run the entire synthesis over ALL available briefs (the
 * "full re-synthesis" strategy). The existing report stays visible until the
 * fresh one replaces it.
 *
 * Concurrency: if the synthesis job is currently running, we cannot safely
 * reset it (the running worker would overwrite the result and the checkpoints).
 * Instead we set rerun_requested=true; the synthesis worker re-queues itself
 * (clearing checkpoints) once it finishes. See synthesis-worker.ts.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  report_pipeline_checkpoints,
  synthesis_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { log } from "../logger";

/**
 * Force a fresh full re-synthesis of a report that has already been synthesized.
 *
 * @param reportId - UUID of the report whose data changed (late platform landed)
 * @returns true if a re-synthesis was scheduled (or deferred via rerun_requested),
 *          false if no synthesis job exists yet (caller should rely on normal fan-in)
 */
export async function triggerResynthesis(reportId: string): Promise<boolean> {
  const outcome = await db.transaction(async (tx): Promise<"none" | "deferred" | "requeued"> => {
    const [job] = await tx
      .select({ id: synthesis_jobs.id, status: synthesis_jobs.status })
      .from(synthesis_jobs)
      .where(eq(synthesis_jobs.report_id, reportId))
      .limit(1);

    if (!job) {
      // No synthesis job yet — the normal fan-in path will pick up the new brief.
      return "none";
    }

    if (job.status === "running") {
      // Don't disturb an in-flight run; ask it to re-run itself when it finishes.
      await tx
        .update(synthesis_jobs)
        .set({ rerun_requested: true, updated_at: new Date() })
        .where(eq(synthesis_jobs.id, job.id));
      return "deferred";
    }

    // Safe to reset now: clear checkpoints so Stage C/D/E re-run from scratch
    // over all briefs, then re-queue the synthesis job.
    await tx
      .delete(report_pipeline_checkpoints)
      .where(eq(report_pipeline_checkpoints.report_id, reportId));

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
    return "requeued";
  });

  switch (outcome) {
    case "none":
      return false;
    case "deferred":
      await log(reportId, "info", "resynthesis", null, "Late platform recovered while synthesis running; flagged rerun_requested");
      return true;
    case "requeued":
      await log(reportId, "info", "resynthesis", null, "Late platform recovered; cleared checkpoints and re-queued synthesis for full rebuild");
      return true;
  }
}
