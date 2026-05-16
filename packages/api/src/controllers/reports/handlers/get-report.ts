import { Elysia, t } from "elysia";
import { getReport as getReportService } from "@/services/reports.service";

export const getReport = new Elysia().get(
  "/:id",
  async ({ params, status }) => {
    const row = await getReportService(params.id);

    if (!row) return status(404, { message: "report not found" });

    return {
      id: row.id,
      category: row.category,
      competitors: row.competitors,
      target_audience: row.audience,
      founder_goal: row.goal,
      stage: row.stage,
      status: row.status,
      error: row.error,
      output: row.output,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
  { params: t.Object({ id: t.String() }) },
);
