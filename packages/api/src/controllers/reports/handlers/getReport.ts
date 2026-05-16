import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getReport } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getReportHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id",
    async ({ log, params, user, status }) => {
      try {
        const row = await getReport(params.id, user!.id);
        if (!row)
          return status(404, { message: "Report not found", error: "REPORT_NOT_FOUND" });
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch report",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      detail: { tags: [Tags.REPORTS], summary: "Get report by id" },
    },
  );
