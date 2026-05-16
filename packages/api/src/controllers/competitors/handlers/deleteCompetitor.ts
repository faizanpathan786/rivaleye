import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { deleteCompetitor } from "@/services/competitors.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const deleteCompetitorHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .delete(
    "/:id",
    async ({ log, user, params, status }) => {
      try {
        const success = await deleteCompetitor(params.id, user!.id);
        if (!success)
          return status(404, { message: "Competitor not found", error: "COMPETITOR_NOT_FOUND" });
        return ok({ success: true });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to delete competitor",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.COMPETITORS], summary: "Delete a competitor" },
    },
  );
