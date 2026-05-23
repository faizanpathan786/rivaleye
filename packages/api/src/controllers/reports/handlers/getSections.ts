import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { PERMISSIONS } from "@/types/permissions";
import { getReportSections } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getSectionsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/sections",
    async ({ log, params, status }) => {
      try {
        const data = await getReportSections(params.id);
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
      auth: { permissions: [PERMISSIONS.REPORTS_VIEW] },
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.REPORTS], summary: "Get report role sections" },
    },
  );
