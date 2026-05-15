import { Elysia, t } from "elysia";
import { startReport } from "@/services/report-generator";

export const createReport = new Elysia().post(
  "/",
  async ({ body }) => {
    const reportId = crypto.randomUUID();
    await startReport({
      reportId,
      category: body.category,
      competitors: body.competitors,
      platforms: body.platforms,
    });
    return { id: reportId, status: "queued" as const };
  },
  {
    body: t.Object({
      category: t.String(),
      competitors: t.Array(t.String()),
      audience: t.Optional(t.String()),
      goal: t.Union([
        t.Literal("validate_idea"),
        t.Literal("find_weaknesses"),
        t.Literal("improve_positioning"),
        t.Literal("decide_mvp_features"),
        t.Literal("find_user_pain"),
        t.Literal("compare_alternatives"),
      ]),
      platforms: t.Optional(
        t.Array(
          t.Union([
            t.Literal("reddit"),
            t.Literal("g2"),
            t.Literal("capterra"),
            t.Literal("twitter"),
            t.Literal("linkedin"),
            t.Literal("producthunt"),
            t.Literal("appstore"),
            t.Literal("playstore"),
            t.Literal("gmaps"),
          ]),
        ),
      ),
    }),
  },
);
