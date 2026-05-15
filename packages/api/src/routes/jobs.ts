import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db, ingestionJobs, competitors } from "@rivaleye/db";
import { requireAuth } from "../plugins/auth.js";

export async function jobRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/:id/jobs",
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

      const jobs = await db
        .select()
        .from(ingestionJobs)
        .where(eq(ingestionJobs.competitorId, request.params.id))
        .orderBy(desc(ingestionJobs.startedAt))
        .limit(20);

      return reply.send({ success: true, data: jobs });
    },
  );
}
