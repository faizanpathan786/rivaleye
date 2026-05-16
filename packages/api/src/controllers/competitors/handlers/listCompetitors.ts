import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listCompetitors } from "@/services/competitors.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listCompetitorsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const rows = await listCompetitors(user!.id);
        return okList(rows);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch competitors",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.COMPETITORS], summary: "List user's tracked competitors" },
    },
  );
