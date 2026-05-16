import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getCompetitor } from "@/services/competitors.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getCompetitorHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id",
    async ({ log, user, params, status }) => {
      try {
        const row = await getCompetitor(params.id, user!.id);
        if (!row)
          return status(404, { message: "Competitor not found", error: "COMPETITOR_NOT_FOUND" });
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch competitor",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.COMPETITORS], summary: "Get a competitor by id" },
    },
  );
