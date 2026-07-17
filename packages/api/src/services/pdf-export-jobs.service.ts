import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { report_pdf_jobs } from "@/db/schema/pipeline";
import { reports } from "@/db/schema/reports";
import { encryptSecret } from "@rivaleye/shared";

const PDF_EXPORT_MAX_PER_HOUR = Number(process.env.PDF_EXPORT_MAX_PER_HOUR ?? 30);

export class PdfExportForbiddenError extends Error {}
export class PdfExportRateLimitError extends Error {}

// Enqueue a PDF export job. The session cookie is stored ENCRYPTED at rest (it is
// a live session credential) so the worker's headless browser can authenticate
// the export view's data fetches; it is cleared once the job is rendered.
export async function enqueuePdfJob(params: {
  reportId: string;
  ownerId: string;
  lens?: string | null;
  sessionCookie: string;
}): Promise<string> {
  // Verify the report is actually owned by this user before spending a render
  // slot on it (defense in depth + prevents enqueuing work for foreign reports).
  const [owned] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.id, params.reportId), eq(reports.owner_id, params.ownerId)))
    .limit(1);
  if (!owned) throw new PdfExportForbiddenError("report not found or not owned");

  // Per-owner hourly cap: PDF render spins up headless Chrome (memory-heavy) — an
  // unbounded enqueue loop is a cheap way to exhaust the synth worker.
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(report_pdf_jobs)
    .where(
      and(
        eq(report_pdf_jobs.owner_id, params.ownerId),
        gt(report_pdf_jobs.created_at, sql`now() - interval '1 hour'`),
      ),
    );
  if ((rows[0]?.count ?? 0) >= PDF_EXPORT_MAX_PER_HOUR) {
    throw new PdfExportRateLimitError("too many PDF exports in the last hour");
  }

  const [row] = await db
    .insert(report_pdf_jobs)
    .values({
      report_id: params.reportId,
      owner_id: params.ownerId,
      lens: params.lens ?? null,
      session_cookie: params.sessionCookie ? encryptSecret(params.sessionCookie) : null,
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
