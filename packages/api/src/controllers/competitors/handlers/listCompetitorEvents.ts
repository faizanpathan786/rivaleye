import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listEventsForCompetitor } from "@/services/radar.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listCompetitorEventsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/events",
    async ({ log, user, params, status }) => {
      try {
        const events = await listEventsForCompetitor(params.id, user!.id);
        if (events === null)
          return status(404, { message: "Competitor not found", error: "COMPETITOR_NOT_FOUND" });
        return okList(events);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch competitor events",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.COMPETITORS], summary: "List radar events for a competitor" },
    },
  );
