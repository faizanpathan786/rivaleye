import type { FastifyInstance } from "fastify";
import { eq, and, desc, count, gte } from "drizzle-orm";
import { db, mentions, classifications, competitors, competitorMentions } from "@rivaleye/db";
import { mentionQuerySchema } from "@rivaleye/shared";
import { requireAuth } from "../plugins/auth.js";

export async function mentionRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/:id/mentions",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      // Verify competitor belongs to workspace
      const [competitor] = await db
        .select()
        .from(competitors)
        .where(and(eq(competitors.id, request.params.id), eq(competitors.workspaceId, request.user.workspaceId)))
        .limit(1);

      if (!competitor) {
        return reply.status(404).send({ success: false, error: "Competitor not found", code: "NOT_FOUND" });
      }

      const query = mentionQuerySchema.safeParse(request.query);
      if (!query.success) {
        return reply.status(400).send({ success: false, error: "Invalid query params", code: "VALIDATION_ERROR" });
      }

      const { page, limit, sentiment, category, since, switchIntent } = query.data;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(competitorMentions.competitorId, request.params.id),
        eq(classifications.isRelevant, true),
      ];

      if (since) conditions.push(gte(mentions.postedAt, new Date(since)));

      // Build query with join to classifications for filtering
      let baseQuery = db
        .select({
          mention: mentions,
          classification: classifications,
        })
        .from(mentions)
        .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
        .leftJoin(classifications, eq(classifications.mentionId, mentions.id))
        .$dynamic();

      if (sentiment) {
        conditions.push(eq(classifications.sentiment, sentiment));
      }
      if (category) {
        conditions.push(eq(classifications.category, category));
      }
      if (switchIntent !== undefined) {
        conditions.push(eq(classifications.switchIntent, switchIntent));
      }

      baseQuery = baseQuery.where(and(...conditions));

      const [totalResult, items] = await Promise.all([
        db
          .select({ count: count() })
          .from(mentions)
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .leftJoin(classifications, eq(classifications.mentionId, mentions.id))
          .where(and(...conditions)),
        baseQuery
          .orderBy(desc(mentions.postedAt))
          .limit(limit)
          .offset(offset),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return reply.send({
        success: true,
        data: {
          items: items.map(({ mention, classification }) => ({
            ...mention,
            classification: classification ?? null,
          })),
          total,
          page,
          limit,
          hasMore: offset + items.length < total,
        },
      });
    },
  );
}
