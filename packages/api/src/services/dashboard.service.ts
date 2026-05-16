import { and, avg, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { competitors, type Competitor } from "@/db/schema/competitors";
import { radar_events, type RadarEvent } from "@/db/schema/radar";
import { reports, type Report } from "@/db/schema/reports";
import { users, type User } from "@/db/schema/users";

export type DashboardStats = {
  total_competitors: number;
  total_reports: number;
  total_radar_events: number;
  urgent_radar_events_7d: number;
  avg_sentiment: number | null;
};

export type DashboardRecentReport = Pick<
  Report,
  | "id"
  | "primary_competitor_name"
  | "category"
  | "status"
  | "stage"
  | "sentiment_overall"
  | "total_sources"
  | "created_at"
>;

export type DashboardRecentRadarEvent = Pick<
  RadarEvent,
  "id" | "competitor_id" | "platform" | "type" | "severity" | "title" | "detected_at"
> & { competitor_name: string };

export type DashboardCompetitorSummary = Pick<
  Competitor,
  | "id"
  | "name"
  | "slug"
  | "color"
  | "stat_sentiment"
  | "stat_mentions"
  | "stat_alerts_7d"
  | "last_activity_at"
>;

export type DashboardPayload = {
  user: { name: User["name"]; email: User["email"] };
  stats: DashboardStats;
  recent_reports: DashboardRecentReport[];
  recent_radar_events: DashboardRecentRadarEvent[];
  competitors_summary: DashboardCompetitorSummary[];
};

export async function getDashboard(userId: string): Promise<DashboardPayload | null> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const userRows = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const userRow = userRows[0];
  if (!userRow) return null;

  const [
    [competitorsCount],
    [reportsCount],
    [radarTotal],
    [radarUrgent],
    [sentimentAvg],
    recentReports,
    recentRadarEvents,
    competitorsSummary,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(competitors)
      .where(eq(competitors.owner_id, userId)),
    db.select({ value: count() }).from(reports).where(eq(reports.owner_id, userId)),
    db
      .select({ value: count() })
      .from(radar_events)
      .innerJoin(competitors, eq(radar_events.competitor_id, competitors.id))
      .where(eq(competitors.owner_id, userId)),
    db
      .select({ value: count() })
      .from(radar_events)
      .innerJoin(competitors, eq(radar_events.competitor_id, competitors.id))
      .where(
        and(
          eq(competitors.owner_id, userId),
          eq(radar_events.severity, "urgent"),
          gte(radar_events.detected_at, sevenDaysAgo),
        ),
      ),
    db
      .select({ value: avg(competitors.stat_sentiment) })
      .from(competitors)
      .where(eq(competitors.owner_id, userId)),
    db
      .select({
        id: reports.id,
        primary_competitor_name: reports.primary_competitor_name,
        category: reports.category,
        status: reports.status,
        stage: reports.stage,
        sentiment_overall: reports.sentiment_overall,
        total_sources: reports.total_sources,
        created_at: reports.created_at,
      })
      .from(reports)
      .where(eq(reports.owner_id, userId))
      .orderBy(desc(reports.created_at))
      .limit(10),
    db
      .select({
        id: radar_events.id,
        competitor_id: radar_events.competitor_id,
        competitor_name: competitors.name,
        platform: radar_events.platform,
        type: radar_events.type,
        severity: radar_events.severity,
        title: radar_events.title,
        detected_at: radar_events.detected_at,
      })
      .from(radar_events)
      .innerJoin(competitors, eq(radar_events.competitor_id, competitors.id))
      .where(eq(competitors.owner_id, userId))
      .orderBy(desc(radar_events.detected_at))
      .limit(10),
    db
      .select({
        id: competitors.id,
        name: competitors.name,
        slug: competitors.slug,
        color: competitors.color,
        stat_sentiment: competitors.stat_sentiment,
        stat_mentions: competitors.stat_mentions,
        stat_alerts_7d: competitors.stat_alerts_7d,
        last_activity_at: competitors.last_activity_at,
      })
      .from(competitors)
      .where(eq(competitors.owner_id, userId))
      .orderBy(sql`${competitors.last_activity_at} desc nulls last`),
  ]);

  const avgSentimentRaw = sentimentAvg?.value ?? null;
  const avgSentiment =
    avgSentimentRaw === null || avgSentimentRaw === undefined
      ? null
      : Number(avgSentimentRaw);

  return {
    user: { name: userRow.name, email: userRow.email },
    stats: {
      total_competitors: Number(competitorsCount?.value ?? 0),
      total_reports: Number(reportsCount?.value ?? 0),
      total_radar_events: Number(radarTotal?.value ?? 0),
      urgent_radar_events_7d: Number(radarUrgent?.value ?? 0),
      avg_sentiment: avgSentiment,
    },
    recent_reports: recentReports,
    recent_radar_events: recentRadarEvents,
    competitors_summary: competitorsSummary,
  };
}
