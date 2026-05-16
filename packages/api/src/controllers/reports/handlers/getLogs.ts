import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getLogs } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getLogsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/logs",
    async ({ log, params, query, user, status }) => {
      try {
        const result = await getLogs(params.id, user!.id, query.since);
        if (!result)
          return status(404, { message: "Report not found", error: "REPORT_NOT_FOUND" });
        return ok({ data: result });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch report logs",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      query: t.Object({ since: t.Optional(t.String()) }),
      detail: { tags: [Tags.REPORTS], summary: "Get report pipeline logs" },
    },
  );
