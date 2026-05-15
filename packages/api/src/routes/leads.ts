import type { FastifyInstance } from "fastify";
import { eq, and, desc, count } from "drizzle-orm";
import { db, mentions, classifications, competitors, competitorMentions } from "@rivaleye/db";
import { leadQuerySchema } from "@rivaleye/shared";
import { requireAuth } from "../plugins/auth.js";

export async function leadRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/:id/leads",
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

      const query = leadQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ success: false, error: "Invalid query params", code: "VALIDATION_ERROR" });
      }

      const { page, limit } = query.data;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(competitorMentions.competitorId, request.params.id),
        eq(classifications.switchIntent, true),
        eq(classifications.isRelevant, true),
      ];

      const [totalResult, items] = await Promise.all([
        db
          .select({ count: count() })
          .from(mentions)
          .innerJoin(classifications, eq(classifications.mentionId, mentions.id))
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(and(...conditions)),
        db
          .select({ mention: mentions, classification: classifications })
          .from(mentions)
          .innerJoin(classifications, eq(classifications.mentionId, mentions.id))
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(and(...conditions))
          .orderBy(desc(mentions.postedAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return reply.send({
        success: true,
        data: {
          items: items.map(({ mention, classification }) => ({ ...mention, classification })),
          total,
          page,
          limit,
          hasMore: offset + items.length < total,
        },
      });
    },
  );
}
