import axios, { endpoints } from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiList, ApiSuccess } from "./_envelope";
import type { RadarEvent } from "./radar";

export type CompetitorPriority = "primary" | "secondary" | "tertiary";
export type CompetitorSensitivity = "low" | "med" | "high";

export type Competitor = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  website: string | null;
  category: string | null;
  color: string | null;
  priority: CompetitorPriority;
  tags: string[];
  socials: Record<string, string>;
  monitor_enabled: boolean;
  monitor_sensitivity: CompetitorSensitivity;
  monitor_watch: string[];
  notes: string | null;
  stat_sentiment: number | null;
  stat_mentions: number;
  stat_alerts_7d: number;
  last_activity_at: string | null;
  added_at: string;
  created_at: string;
  updated_at: string;
};

export type CreateCompetitorPayload = Partial<Competitor> & { name: string };
export type UpdateCompetitorPayload = Partial<Competitor>;

export async function listCompetitors(): Promise<Competitor[]> {
  const res = await axios.get<ApiList<Competitor>>(endpoints.competitors.list);
  return unwrapList(res).items;
}

export async function getCompetitor(id: string): Promise<Competitor> {
  const res = await axios.get<ApiSuccess<Competitor>>(
    endpoints.competitors.detail(id),
  );
  return unwrap(res);
}

export async function createCompetitor(
  payload: CreateCompetitorPayload,
): Promise<Competitor> {
  const res = await axios.post<ApiSuccess<Competitor>>(
    endpoints.competitors.list,
    payload,
  );
  return unwrap(res);
}

export async function updateCompetitor(
  id: string,
  payload: UpdateCompetitorPayload,
): Promise<Competitor> {
  const res = await axios.patch<ApiSuccess<Competitor>>(
    endpoints.competitors.detail(id),
    payload,
  );
  return unwrap(res);
}

export async function deleteCompetitor(id: string): Promise<{ ok: boolean }> {
  const res = await axios.delete<ApiSuccess<{ ok: boolean }>>(
    endpoints.competitors.detail(id),
  );
  return unwrap(res);
}

export async function listCompetitorEvents(id: string): Promise<RadarEvent[]> {
  const res = await axios.get<ApiList<RadarEvent>>(
    endpoints.competitors.events(id),
  );
  return unwrapList(res).items;
}
