/**
 * PDF export job poller.
 *
 * Claims queued `report_pdf_jobs` (SELECT … FOR UPDATE SKIP LOCKED), renders the
 * report to a PDF via headless Chrome (using the requester's forwarded session
 * cookie), stores it as base64, and clears the cookie. Retries with backoff up
 * to max_attempts, then marks the job failed.
 */
import pino from "pino";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { report_pdf_jobs } from "../../../api/src/db/schema/pipeline.js";
import { renderReportPdf } from "../pdf/render";

const log = pino({ name: "pdf-worker" });

type PdfJob = typeof report_pdf_jobs.$inferSelect;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimPdfJob(workerId: string): Promise<PdfJob | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(report_pdf_jobs)
      .where(and(eq(report_pdf_jobs.status, "queued"), lte(report_pdf_jobs.run_after, sql`now()`)))
      .orderBy(asc(report_pdf_jobs.created_at))
      .limit(1)
      .for("update", { skipLocked: true });

    const job = rows[0];
    if (!job) return null;

    const [updated] = await tx
      .update(report_pdf_jobs)
      .set({
        status: "running",
        locked_at: sql`now()`,
        locked_by: workerId,
        started_at: sql`coalesce(${report_pdf_jobs.started_at}, now())`,
        attempt_count: sql`${report_pdf_jobs.attempt_count} + 1`,
        updated_at: sql`now()`,
      })
      .where(eq(report_pdf_jobs.id, job.id))
      .returning();
    return updated ?? null;
  });
}

async function processPdfJob(job: PdfJob): Promise<void> {
  try {
    const pdf = await renderReportPdf({
      reportId: job.report_id,
      lens: job.lens,
      sessionCookie: job.session_cookie ?? "",
    });
    await db
      .update(report_pdf_jobs)
      .set({
        status: "completed",
        pdf_base64: pdf.toString("base64"),
        session_cookie: null,
        error: null,
        completed_at: sql`now()`,
        locked_at: null,
        locked_by: null,
        updated_at: sql`now()`,
      })
      .where(eq(report_pdf_jobs.id, job.id));
    log.info({ jobId: job.id, reportId: job.report_id }, "PDF export completed");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const exhausted = job.attempt_count >= job.max_attempts;
    await db
      .update(report_pdf_jobs)
      .set(
        exhausted
          ? {
              status: "failed",
              error: msg,
              session_cookie: null,
              locked_at: null,
              locked_by: null,
              updated_at: sql`now()`,
            }
          : {
              status: "queued",
              error: msg,
              run_after: sql`now() + interval '15 seconds'`,
              locked_at: null,
              locked_by: null,
              updated_at: sql`now()`,
            },
      )
      .where(eq(report_pdf_jobs.id, job.id));
    log.error({ jobId: job.id, err: msg, exhausted }, "PDF export failed");
  }
}

export async function pollPdfJobs(config: { workerId: string; pollIntervalMs: number }): Promise<void> {
  log.info({ workerId: config.workerId }, "Starting PDF export polling loop");
  while (true) {
    try {
      const job = await claimPdfJob(config.workerId);
      if (!job) {
        await sleep(config.pollIntervalMs);
        continue;
      }
      await processPdfJob(job);
    } catch (e) {
      log.error({ err: e instanceof Error ? e.message : String(e) }, "PDF poll loop error");
      await sleep(config.pollIntervalMs);
    }
  }
}
