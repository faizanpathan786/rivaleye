import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listReports } from "@/services/reports.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listReportsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const rows = await listReports(user!.id);
        return okList(rows);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch reports",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.REPORTS], summary: "List user's reports" },
    },
  );
