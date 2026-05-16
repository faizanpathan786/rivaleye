import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getDashboard } from "@/services/dashboard.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getDashboardHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/",
    async ({ log, user, status }) => {
      try {
        const payload = await getDashboard(user!.id);
        if (!payload)
          return status(404, { message: "User not found", error: "USER_NOT_FOUND" });
        return ok(payload);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch dashboard",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      detail: { tags: [Tags.DASHBOARD], summary: "Get aggregated dashboard payload" },
    },
  );
