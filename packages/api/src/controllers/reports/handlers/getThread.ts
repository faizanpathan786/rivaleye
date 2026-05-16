import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getThread } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getThreadHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/threads/:thread_id",
    async ({ log, params, user, status }) => {
      try {
        const result = await getThread(params.id, user!.id, params.thread_id);
        if (!result)
          return status(404, { message: "Thread not found", error: "THREAD_NOT_FOUND" });
        return ok(result);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch thread",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String(), thread_id: t.String() }),
      detail: { tags: [Tags.REPORTS], summary: "Get a single thread with messages" },
    },
  );
