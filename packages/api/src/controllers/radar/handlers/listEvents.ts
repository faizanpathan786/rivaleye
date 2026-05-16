import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { listRadarEvents } from "@/services/radar.service";
import { okList } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const listRadarEventsHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/events",
    async ({ log, user, query, status }) => {
      try {
        const rows = await listRadarEvents(user!.id, {
          limit: query.limit,
          severity: query.severity,
          competitorId: query.competitor_id,
        });
        return okList(rows);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch radar events",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })),
        severity: t.Optional(
          t.Union([
            t.Literal("low"),
            t.Literal("med"),
            t.Literal("high"),
            t.Literal("urgent"),
          ]),
        ),
        competitor_id: t.Optional(t.String({ format: "uuid" })),
      }),
      detail: { tags: [Tags.RADAR], summary: "List radar events" },
    },
  );
