import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { runPipeline } from "../pipeline/run";

export async function handleGenerateReport(data: GenerateReportJob): Promise<void> {
  const { reportId } = data;
  console.log(`[generate] start reportId=${reportId}`);

  try {
    await runPipeline(reportId);

    await db
      .update(reports)
      .set({ stage: "done", status: "completed", updated_at: new Date() })
      .where(eq(reports.id, reportId));

    console.log(`[generate] done reportId=${reportId} status=completed`);
  } catch (err) {
    console.error(`[generate] failed reportId=${reportId}`, err);

    const errorMsg = err instanceof Error ? err.message : "unknown_error";

    await db
      .update(reports)
      .set({ stage: "failed", status: "failed", error: errorMsg, updated_at: new Date() })
      .where(eq(reports.id, reportId));

    throw err;
  }
}
