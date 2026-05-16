import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import type { ReportOutput } from "@rivaleye/shared";
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
    const output = await runInsightPipeline(reportId);

    await db
      .update(reports)
      .set({
        output: output as ReportOutput,
        stage: "done",
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    console.log(`[generate] done reportId=${reportId} status=completed`);
  } catch (err) {
    console.error(`[generate] failed reportId=${reportId}`, err);

    let errorMsg = "unknown_error";
    let outputMeta: Record<string, unknown> = {};

    if (err instanceof NotEnoughSignalError) {
      errorMsg = "not_enough_signal";
      outputMeta = { hint: err.message };
    } else if (err instanceof StageValidationError) {
      errorMsg = `stage${err.stage}_validation_failed`;
      outputMeta = { last_raw: err.lastRaw };
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
        output: Object.keys(outputMeta).length
          ? ({ meta: outputMeta } as unknown as ReportOutput)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));

    throw err; // re-throw so pg-boss records the failure
  }
}
