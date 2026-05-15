import type { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db, clusters, competitors } from "@rivaleye/db";
import { requireAuth } from "../plugins/auth.js";

export async function clusterRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/:id/clusters",
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

      const result = await db
        .select()
        .from(clusters)
        .where(eq(clusters.competitorId, request.params.id))
        .orderBy(desc(clusters.mentionCount));

      return reply.send({ success: true, data: result });
    },
  );
}
