import axios, { endpoints } from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiList, ApiSuccess } from "./_envelope";

export type RadarSeverity = "low" | "med" | "high" | "urgent";

export type RadarEvent = {
  id: string;
  competitor_id: string;
  competitor_name?: string;
  platform: string;
  type: string;
  severity: RadarSeverity;
  title: string;
  snippet: string | null;
  url: string | null;
  who: string | null;
  role: string | null;
  confidence: number;
  impact: string | null;
  detected_at: string;
};

export type ListRadarEventsParams = {
  limit?: number;
  severity?: RadarSeverity;
  competitor_id?: string;
};

export async function listRadarEvents(
  params?: ListRadarEventsParams,
): Promise<RadarEvent[]> {
  const res = await axios.get<ApiList<RadarEvent>>(endpoints.radar.events, {
    params,
  });
  return unwrapList(res).items;
}

export async function getRadarEvent(id: string): Promise<RadarEvent> {
  const res = await axios.get<ApiSuccess<RadarEvent>>(endpoints.radar.event(id));
  return unwrap(res);
}
