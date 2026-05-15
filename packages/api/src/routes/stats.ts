import type { FastifyInstance } from "fastify";
import { eq, and, count, sql } from "drizzle-orm";
import { db, mentions, classifications, competitors, competitorMentions } from "@rivaleye/db";
import { requireAuth } from "../plugins/auth.js";

export async function statsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/:id/stats",
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

      const cId = request.params.id;

      const [
        totalMentions,
        classified,
        sentimentBreakdown,
        categoryBreakdown,
        switchIntentCount,
        volumeOverTime,
      ] = await Promise.all([
        db.select({ count: count() }).from(mentions).innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id)).where(eq(competitorMentions.competitorId, cId)),
        db
          .select({ count: count() })
          .from(classifications)
          .innerJoin(mentions, eq(mentions.id, classifications.mentionId))
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(and(eq(competitorMentions.competitorId, cId), eq(classifications.isRelevant, true))),
        db
          .select({ sentiment: classifications.sentiment, count: count() })
          .from(classifications)
          .innerJoin(mentions, eq(mentions.id, classifications.mentionId))
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(and(eq(competitorMentions.competitorId, cId), eq(classifications.isRelevant, true)))
          .groupBy(classifications.sentiment),
        db
          .select({ category: classifications.category, count: count() })
          .from(classifications)
          .innerJoin(mentions, eq(mentions.id, classifications.mentionId))
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(and(eq(competitorMentions.competitorId, cId), eq(classifications.isRelevant, true)))
          .groupBy(classifications.category),
        db
          .select({ count: count() })
          .from(classifications)
          .innerJoin(mentions, eq(mentions.id, classifications.mentionId))
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(and(eq(competitorMentions.competitorId, cId), eq(classifications.isRelevant, true), eq(classifications.switchIntent, true))),
        db
          .select({
            date: sql<string>`DATE(${mentions.postedAt})`.as("date"),
            count: count(),
          })
          .from(mentions)
          .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
          .where(eq(competitorMentions.competitorId, cId))
          .groupBy(sql`DATE(${mentions.postedAt})`)
          .orderBy(sql`DATE(${mentions.postedAt})`),
      ]);

      const sentimentMap = Object.fromEntries(
        sentimentBreakdown.map((r) => [r.sentiment, r.count]),
      );
      const categoryMap = Object.fromEntries(
        categoryBreakdown.map((r) => [r.category, r.count]),
      );

      return reply.send({
        success: true,
        data: {
          totalMentions: totalMentions[0]?.count ?? 0,
          classified: classified[0]?.count ?? 0,
          sentimentBreakdown: sentimentMap,
          categoryBreakdown: categoryMap,
          switchIntentCount: switchIntentCount[0]?.count ?? 0,
          volumeOverTime,
        },
      });
    },
  );
}
