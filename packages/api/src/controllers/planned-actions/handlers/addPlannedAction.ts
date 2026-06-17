import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { addPlannedAction } from "@/services/planned-actions.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const addPlannedActionHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/",
    async ({ log, user, body, status }) => {
      try {
        const result = await addPlannedAction(user!.id, body);
        return ok(result);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to add planned action",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: t.Object({
        report_id: t.String({ format: "uuid" }),
        title: t.String(),
        description: t.Optional(t.String()),
        role: t.Optional(t.String()),
        effort: t.Optional(t.String()),
      }),
      detail: { tags: [Tags.REPORTS], summary: "Add action to plan" },
    },
  );
