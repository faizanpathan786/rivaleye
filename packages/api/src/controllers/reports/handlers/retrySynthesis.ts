import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { retrySynthesis } from "@/services/reports.service";
import { Tags } from "@/types/swagger";

export const retrySynthesisHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/:id/retry-synthesis",
    async ({ params, user, status }) => {
      const result = await retrySynthesis(user!.id, params.id);
      if (!result.ok) {
        return status(result.reason === "not_found" ? 404 : 409, { error: result.reason });
      }
      return status(202, { ok: true as const });
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      detail: { tags: [Tags.REPORTS], summary: "Re-queue a stuck or failed synthesis job" },
    },
  );
