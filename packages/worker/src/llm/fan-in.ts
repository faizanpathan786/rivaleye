import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { pipeline_events } from "../../../api/src/db/schema/pipeline-events.js";
import { inngest } from "../inngest/client";

export async function fanInCheck(
  reportId: string,
  reason: "fan-in" | "retry" = "fan-in",
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${reportId}))`);

    const jobs = await tx
      .select({ status: report_platform_jobs.status })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    const allTerminal =
      jobs.length > 0 &&
      jobs.every((j) => j.status === "completed" || j.status === "failed");
    if (!allTerminal) return;

    const already = await tx
      .select({ id: pipeline_events.id })
      .from(pipeline_events)
      .where(
        and(
          eq(pipeline_events.report_id, reportId),
          eq(pipeline_events.stage, "synth.run"),
          eq(pipeline_events.event, "started"),
        ),
      )
      .limit(1);

    if (already.length > 0 && reason !== "retry") return;

    await inngest.send({
      name: "synth.run",
      data: { reportId, reason },
    });
  });
}
