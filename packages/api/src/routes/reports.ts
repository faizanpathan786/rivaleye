import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { db, reports, competitors } from "@rivaleye/db";
import { requireAuth } from "../plugins/auth.js";

export async function reportRoutes(app: FastifyInstance) {
  // Get report for a competitor
  app.get<{ Params: { id: string } }>(
    "/:id/report",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const [competitor] = await db
        .select()
        .from(competitors)
        .where(and(eq(competitors.id, request.params.id), eq(competitors.workspaceId, request.user.workspaceId)))
        .limit(1);

      if (!competitor) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }

      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.competitorId, request.params.id))
        .orderBy((r) => r.createdAt)
        .limit(1);

      if (!report) {
        return reply.status(404).send({ success: false, error: "Report not found", code: "NOT_FOUND" });
      }

      return reply.send({ success: true, data: report });
    },
  );

  // List reports for a competitor
  app.get<{ Params: { id: string } }>(
    "/:id/reports",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const [competitor] = await db
        .select()
        .from(competitors)
        .where(and(eq(competitors.id, request.params.id), eq(competitors.workspaceId, request.user.workspaceId)))
        .limit(1);

      if (!competitor) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }

      const reportList = await db
        .select()
        .from(reports)
        .where(eq(reports.competitorId, request.params.id))
        .orderBy((r) => r.createdAt);

      return reply.send({ success: true, data: reportList });
    },
  );
}
