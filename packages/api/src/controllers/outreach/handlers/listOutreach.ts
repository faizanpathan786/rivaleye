import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listOutreach } from "@/services/outreach.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listOutreachHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const rows = await listOutreach(user!.id);
        return okList(rows);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to list outreach items",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.OUTREACH], summary: "List saved outreach items" },
    },
  );
