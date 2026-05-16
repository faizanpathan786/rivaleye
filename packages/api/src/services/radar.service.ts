import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db/client";
import { competitors } from "@/db/schema/competitors";
import { radar_events, type RadarEvent } from "@/db/schema/radar";

export type RadarSeverity = RadarEvent["severity"];

export type ListRadarEventsOptions = {
  limit?: number;
  severity?: RadarSeverity;
  competitorId?: string;
};

export async function listRadarEvents(
  ownerId: string,
  opts: ListRadarEventsOptions = {},
): Promise<RadarEvent[]> {
  const where: SQL[] = [eq(competitors.owner_id, ownerId)];
  if (opts.severity) where.push(eq(radar_events.severity, opts.severity));
  if (opts.competitorId)
    where.push(eq(radar_events.competitor_id, opts.competitorId));

  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 200) : 50;

  const rows = await db
    .select({ event: radar_events })
    .from(radar_events)
    .innerJoin(competitors, eq(radar_events.competitor_id, competitors.id))
    .where(and(...where))
    .orderBy(desc(radar_events.detected_at))
    .limit(limit);

  return rows.map((r) => r.event);
}

export async function getRadarEvent(
  id: string,
  ownerId: string,
): Promise<RadarEvent | null> {
  const rows = await db
    .select({ event: radar_events })
    .from(radar_events)
    .innerJoin(competitors, eq(radar_events.competitor_id, competitors.id))
    .where(and(eq(radar_events.id, id), eq(competitors.owner_id, ownerId)))
    .limit(1);
  return rows[0]?.event ?? null;
}

export async function listEventsForCompetitor(
  competitorId: string,
  ownerId: string,
): Promise<RadarEvent[] | null> {
  const owned = await db
    .select({ id: competitors.id })
    .from(competitors)
    .where(and(eq(competitors.id, competitorId), eq(competitors.owner_id, ownerId)))
    .limit(1);
  if (owned.length === 0) return null;

  return db
    .select()
    .from(radar_events)
    .where(eq(radar_events.competitor_id, competitorId))
    .orderBy(desc(radar_events.detected_at));
}
