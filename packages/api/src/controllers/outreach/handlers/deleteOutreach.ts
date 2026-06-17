import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { removeOutreach } from "@/services/outreach.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const deleteOutreachHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .delete(
    "/:id",
    async ({ log, user, params, status }) => {
      try {
        const success = await removeOutreach(params.id, user!.id);
        if (!success)
          return status(404, {
            message: "Outreach item not found",
            error: "OUTREACH_NOT_FOUND",
          });
        return ok({ success: true });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to delete outreach item",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.OUTREACH], summary: "Remove a saved outreach item" },
    },
  );
