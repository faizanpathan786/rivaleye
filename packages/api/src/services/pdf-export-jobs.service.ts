import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { report_pdf_jobs } from "@/db/schema/pipeline";

// Enqueue a PDF export job. The session cookie is stored transiently so the
// worker's headless browser can authenticate the export view's data fetches; it
// is cleared once the job is rendered.
export async function enqueuePdfJob(params: {
  reportId: string;
  ownerId: string;
  lens?: string | null;
  sessionCookie: string;
}): Promise<string> {
  const [row] = await db
    .insert(report_pdf_jobs)
    .values({
      report_id: params.reportId,
      owner_id: params.ownerId,
      lens: params.lens ?? null,
      session_cookie: params.sessionCookie || null,
      status: "queued",
    })
    .returning({ id: report_pdf_jobs.id });
  return row!.id;
}

export async function getPdfJobStatus(jobId: string, ownerId: string) {
  const [row] = await db
    .select({
      id: report_pdf_jobs.id,
      status: report_pdf_jobs.status,
      error: report_pdf_jobs.error,
      report_id: report_pdf_jobs.report_id,
    })
    .from(report_pdf_jobs)
    .where(and(eq(report_pdf_jobs.id, jobId), eq(report_pdf_jobs.owner_id, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function getPdfJobForDownload(jobId: string, ownerId: string) {
  const [row] = await db
    .select({
      status: report_pdf_jobs.status,
      pdf_base64: report_pdf_jobs.pdf_base64,
      lens: report_pdf_jobs.lens,
      report_id: report_pdf_jobs.report_id,
    })
    .from(report_pdf_jobs)
    .where(and(eq(report_pdf_jobs.id, jobId), eq(report_pdf_jobs.owner_id, ownerId)))
    .limit(1);
  return row ?? null;
}
