import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getReportSections } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getSectionsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/sections",
    async ({ log, params, user, status }) => {
      try {
        const data = await getReportSections(params.id, user!.id);
        if (!data)
          return status(404, { message: "Report not found", error: "REPORT_NOT_FOUND" });
        return ok(data);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch report sections",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.REPORTS], summary: "Get report role sections" },
    },
  );
