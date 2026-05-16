import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getProgress } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getProgressHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/progress",
    async ({ log, params, user, status }) => {
      try {
        const result = await getProgress(params.id, user!.id);
        if (!result)
          return status(404, { message: "Report not found", error: "REPORT_NOT_FOUND" });
        return ok(result);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch report progress",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      response: {
        200: t.Object({
          data: t.Object({
            report: t.Object({
              id: t.String(),
              status: t.String(),
              partial: t.Boolean(),
              failed_platforms: t.Array(t.String()),
            }),
            platforms: t.Array(
              t.Object({
                platform: t.String(),
                status: t.String(),
                stage: t.String(),
                attempt_count: t.Number(),
                last_error: t.Nullable(t.String()),
                last_event_at: t.Nullable(t.Date()),
              }),
            ),
            events: t.Array(
              t.Object({
                stage: t.String(),
                event: t.String(),
                platform: t.Nullable(t.String()),
                attempt: t.Number(),
                duration_ms: t.Nullable(t.Number()),
                created_at: t.Date(),
              }),
            ),
            metrics: t.Object({
              mentions: t.Number(),
              complaints: t.Number(),
              quotes: t.Number(),
              comments: t.Number(),
            }),
          }),
        }),
        404: t.Object({ message: t.String(), error: t.String() }),
        400: t.Object({
          message: t.String(),
          error: t.String(),
        }),
      },
      detail: { tags: [Tags.REPORTS], summary: "Get report pipeline progress" },
    },
  );
