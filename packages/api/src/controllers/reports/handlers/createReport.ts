import { Elysia, t } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { authPlugin } from "@/plugins/auth";
import { createReport } from "@/services/reports.service";
import { ok } from "@/utils/response";
import { Tags } from "@/types/swagger";

export const createReportHandler = new Elysia()
  .use(loggerPlugin)
  .use(authPlugin)
  .post(
    "/",
    async ({ log, body, user, status }) => {
      try {
        const report = await createReport(user!.id, body);
        return ok({ id: report.id, stage: "queued" as const });
      } catch (e) {
        log.error(e);
        return status(400, {
          message: "Failed to create report",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      auth: {},
      body: t.Object({
        category: t.String({ minLength: 1 }),
        competitors: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 5 }),
        target_audience: t.String({ minLength: 1 }),
        founder_goal: t.Union([
          t.Literal("validate_idea"),
          t.Literal("find_user_pain"),
          t.Literal("improve_positioning"),
          t.Literal("decide_mvp_features"),
          t.Literal("compare_alternatives"),
          t.Literal("find_weaknesses"),
        ]),
        website_url: t.Optional(t.String({ format: "uri" })),
        selected_platforms: t.Array(
          t.Union([
            t.Literal("reddit"),
            t.Literal("appstore"),
            t.Literal("playstore"),
            t.Literal("hackernews"),
            t.Literal("producthunt"),
            t.Literal("devto"),
            t.Literal("website"),
          ]),
          { minItems: 1 },
        ),
      }),
      detail: { tags: [Tags.REPORTS], summary: "Create a new pain report" },
    },
  );
