import axios, { endpoints } from "@/lib/axios";
import { unwrap } from "./_envelope";
import type { ApiSuccess } from "./_envelope";
import type { Competitor } from "./competitors";
import type { RadarEvent } from "./radar";
import type { ReportRow } from "./reports";

export type DashboardStats = {
  total_competitors: number;
  total_reports: number;
  total_radar_events: number;
  urgent_radar_events_7d: number;
  avg_sentiment: number | null;
};

export type CompetitorSummary = Pick<
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

export type DashboardOpportunity = {
  id: string;
  title: string;
  payoff: "low" | "med" | "high";
  effort: "low" | "med" | "high";
  thesis: string | null;
  report_id: string;
  competitor_name: string | null;
  evidence_quote: string | null;
  evidence_author: string | null;
  signal_tag: string | null;
};

export type DashboardData = {
  user: { name: string | null; email: string };
  stats: DashboardStats;
  recent_reports: ReportRow[];
  recent_radar_events: RadarEvent[];
  competitors_summary: CompetitorSummary[];
  opportunities: DashboardOpportunity[];
};

export async function getDashboard(): Promise<DashboardData> {
  const res = await axios.get<ApiSuccess<DashboardData>>(endpoints.dashboard);
  return unwrap(res);
}
