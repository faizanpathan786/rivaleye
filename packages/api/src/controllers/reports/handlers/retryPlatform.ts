import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { retryPlatform } from "@/services/reports.service";
import { Tags } from "@/types/swagger";

export const retryPlatformHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/:id/retry-platform",
    async ({ params, body, user, status }) => {
      const result = await retryPlatform(user!.id, params.id, body.platform as any);
      if (!result.ok) {
        return status(result.reason === "not_found" ? 404 : 409, { error: result.reason });
      }
      return status(202, { ok: true as const });
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      body: t.Object({ platform: t.String() }),
      detail: { tags: [Tags.REPORTS], summary: "Retry a failed platform scrape" },
    },
  );
