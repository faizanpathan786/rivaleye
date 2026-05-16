import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getRadarEvent } from "@/services/radar.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getRadarEventHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/events/:id",
    async ({ log, user, params, status }) => {
      try {
        const row = await getRadarEvent(params.id, user!.id);
        if (!row)
          return status(404, { message: "Radar event not found", error: "RADAR_EVENT_NOT_FOUND" });
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch radar event",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      detail: { tags: [Tags.RADAR], summary: "Get radar event by id" },
    },
  );
