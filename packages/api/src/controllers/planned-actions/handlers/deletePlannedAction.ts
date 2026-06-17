import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { removePlannedAction } from "@/services/planned-actions.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const deletePlannedActionHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .delete(
    "/:id",
    async ({ log, user, params, status }) => {
      try {
        const success = await removePlannedAction(params.id, user!.id);
        if (!success) {
          return status(404, { message: "Planned action not found" });
        }
        return ok({ success: true });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to delete planned action",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.REPORTS], summary: "Remove action from plan" },
    },
  );
