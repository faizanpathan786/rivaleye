import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listPlannedActions } from "@/services/planned-actions.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listPlannedActionsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const result = await listPlannedActions(user!.id);
        return okList(result);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch planned actions",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.REPORTS], summary: "List user's planned actions" },
    },
  );
