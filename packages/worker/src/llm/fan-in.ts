import pino from "pino";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";

const log = pino({ name: "fan-in" });

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

    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const pending = jobs.length - completed - failed;

    log.info({ reportId, reason, total: jobs.length, completed, failed, pending }, "Fan-in check");

    const allTerminal = jobs.length > 0 && pending === 0;
    if (!allTerminal) {
      log.info({ reportId, pending }, "Fan-in not ready; synthesis job not created yet");
      return;
    }

    // Idempotent: insert only if no synthesis job exists for this report yet
    const existing = await tx
      .select({ id: synthesis_jobs.id, status: synthesis_jobs.status })
      .from(synthesis_jobs)
      .where(eq(synthesis_jobs.report_id, reportId))
      .limit(1);

    if (existing.length > 0 && reason !== "retry") {
      log.info({ reportId, existingId: existing[0]?.id, existingStatus: existing[0]?.status }, "Synthesis job already exists; skipping");
      return;
    }

    await tx
      .insert(synthesis_jobs)
      .values({ report_id: reportId })
      .onConflictDoNothing();

    log.info({ reportId, completed, failed }, "Synthesis job queued");
  });
}
