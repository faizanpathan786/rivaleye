import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getMe } from "@/services/me.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getMeHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const row = await getMe(user!.id);
        if (!row)
          return status(404, { message: "User not found", error: "USER_NOT_FOUND" });
        return ok(row);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch current user",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.ME], summary: "Get current user profile" },
    },
  );
