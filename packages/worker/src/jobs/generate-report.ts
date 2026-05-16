import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { runInsightPipeline } from "../pipeline/run";
import {
  NotEnoughSignalError,
  StageValidationError,
  FinalShapeError,
  EvidenceIntegrityError,
} from "../pipeline/errors";

export async function handleGenerateReport(data: GenerateReportJob) {
  const { reportId } = data;
  console.log(`[generate] start reportId=${reportId}`);

  try {
    await runInsightPipeline(reportId);

    // TODO: write normalized report rows when LLM ships
    await db
      .update(reports)
      .set({
        stage: "done",
        status: "completed",
        updated_at: new Date(),
      })
      .where(eq(reports.id, reportId));

    console.log(`[generate] done reportId=${reportId} status=completed`);
  } catch (err) {
    console.error(`[generate] failed reportId=${reportId}`, err);

    let errorMsg = "unknown_error";

    if (err instanceof NotEnoughSignalError) {
      errorMsg = "not_enough_signal";
    } else if (err instanceof StageValidationError) {
      errorMsg = `stage${err.stage}_validation_failed`;
    } else if (err instanceof FinalShapeError) {
      errorMsg = "final_shape_invalid";
    } else if (err instanceof EvidenceIntegrityError) {
      errorMsg = "evidence_integrity_failed";
    }

    await db
      .update(reports)
      .set({
        stage: "failed",
        status: "failed",
        error: errorMsg,
        updated_at: new Date(),
      })
      .where(eq(reports.id, reportId));

    throw err; // re-throw so pg-boss records the failure
  }
}
