import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { getVoice } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const getVoiceHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .get(
    "/:id/voice",
    async ({ log, params, user, status }) => {
      try {
        const result = await getVoice(params.id, user!.id);
        if (!result)
          return status(404, { message: "Report not found", error: "REPORT_NOT_FOUND" });
        return ok(result);
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to fetch report data",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      params: t.Object({ id: t.String() }),
      detail: { tags: [Tags.REPORTS], summary: "Get report voice-of-customer" },
    },
  );
