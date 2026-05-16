import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { cancelReport } from "@/services/reports.service";
import { Tags } from "@/types/swagger";

export const cancelHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/:id/cancel",
    async ({ params, user, status }) => {
      const result = await cancelReport(user!.id, params.id);
      if (!result.ok) {
        return status(404, { error: result.reason });
      }
      return { ok: true as const };
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      detail: { tags: [Tags.REPORTS], summary: "Cancel a running report" },
    },
  );
