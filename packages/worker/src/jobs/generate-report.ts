import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { log } from "../logger.js";
import { runPipeline } from "../pipeline/run";

export async function handleGenerateReport(data: GenerateReportJob): Promise<void> {
  const { reportId } = data;
  await log(reportId, "info", null, null, `generate-report start`);

  try {
    await runPipeline(reportId);

    await db
      .update(reports)
      .set({ stage: "done", status: "completed", updated_at: new Date() })
      .where(eq(reports.id, reportId));

    await log(reportId, "info", null, null, `generate-report done: status=completed`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "unknown_error";
    await log(reportId, "error", null, null, `generate-report failed`, { error: errorMsg });

    await db
      .update(reports)
      .set({ stage: "failed", status: "failed", error: errorMsg, updated_at: new Date() })
      .where(eq(reports.id, reportId));

    throw err;
  }
}
