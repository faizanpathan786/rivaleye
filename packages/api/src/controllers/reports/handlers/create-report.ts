import { Elysia, t } from "elysia";
import { createReport as createReportService } from "@/services/reports.service";

export const createReport = new Elysia().post(
  "/",
  async ({ body }) => {
    const report = await createReportService(body);
    return { id: report.id, stage: "queued" as const };
  },
  {
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
    }),
  },
);
