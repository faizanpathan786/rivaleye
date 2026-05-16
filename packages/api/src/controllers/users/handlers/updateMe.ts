import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { updateMe } from "@/services/me.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const updateMeBodySchema = t.Object({
  name: t.Optional(t.Union([t.String(), t.Null()])),
  image: t.Optional(t.Union([t.String(), t.Null()])),
});

export const updateMeHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .patch(
    "/",
    async ({ log, user, body, status }) => {
      try {
        const row = await updateMe(user!.id, body);
        if (!row)
          return status(404, { message: "User not found", error: "USER_NOT_FOUND" });
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to update current user",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: updateMeBodySchema,
      detail: { tags: [Tags.ME], summary: "Update current user profile" },
    },
  );
