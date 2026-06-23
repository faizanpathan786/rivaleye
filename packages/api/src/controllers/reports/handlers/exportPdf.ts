import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { ok } from "@/utils/response";
import {
  enqueuePdfJob,
  getPdfJobStatus,
  getPdfJobForDownload,
} from "@/services/pdf-export-jobs.service";

export const exportPdfHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  // Enqueue an async PDF export. Returns immediately with a job id; the worker
  // renders it (headless Chrome) and the client polls for completion.
  .post(
    "/:id/export-pdf",
    async ({ params, query, headers, user, log, status }) => {
      try {
        const jobId = await enqueuePdfJob({
          reportId: params.id,
          ownerId: user!.id,
          lens: query.lens ?? null,
          sessionCookie: headers["cookie"] || "",
        });
        return ok({ job_id: jobId, status: "queued" });
      } catch (e) {
        log.error(e);
        return status(500, { message: "Failed to queue export", error: "EXPORT_ENQUEUE_FAILED" });
      }
    },
    {
      auth: { permissions: ["REPORTS_VIEW"] },
      params: t.Object({ id: t.String() }),
      query: t.Object({ lens: t.Optional(t.String()) }),
    },
  )
  // Poll a job's status.
  .get(
    "/pdf-jobs/:jobId",
    async ({ params, user, status }) => {
      const job = await getPdfJobStatus(params.jobId, user!.id);
      if (!job) return status(404, { message: "Export job not found", error: "JOB_NOT_FOUND" });
      return ok({
        job_id: job.id,
        status: job.status,
        ready: job.status === "completed",
        error: job.status === "failed" ? "Export failed" : null,
      });
    },
    {
      auth: { permissions: ["REPORTS_VIEW"] },
      params: t.Object({ jobId: t.String() }),
    },
  )
  // Download the finished PDF (owner-scoped).
  .get(
    "/pdf-jobs/:jobId/download",
    async ({ params, user, set, status }) => {
      const job = await getPdfJobForDownload(params.jobId, user!.id);
      if (!job) return status(404, { message: "Export job not found", error: "JOB_NOT_FOUND" });
      if (job.status !== "completed" || !job.pdf_base64) {
        return status(409, { message: "Export not ready", error: "EXPORT_NOT_READY" });
      }
      const bytes = Buffer.from(job.pdf_base64, "base64");
      set.headers["Content-Type"] = "application/pdf";
      set.headers["Content-Disposition"] = `attachment; filename="report-${job.lens || "full"}-${job.report_id}.pdf"`;
      return bytes;
    },
    {
      auth: { permissions: ["REPORTS_VIEW"] },
      params: t.Object({ jobId: t.String() }),
    },
  );
