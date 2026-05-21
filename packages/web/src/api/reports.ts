import axios, { endpoints } from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiList, ApiSuccess } from "./_envelope";

export type ReportRow = {
  id: string;
  category: string;
  competitors: string[];
  audience: string | null;
  goal: string;
  status: string;
  stage: string;
  error: string | null;
  primary_competitor_name: string | null;
  primary_competitor_domain: string | null;
  scanned_at: string | null;
  time_range: string | null;
  total_sources: number | null;
  total_threads: number | null;
  sentiment_overall: number | null;
  sentiment_positive: number | null;
  sentiment_neutral: number | null;
  sentiment_negative: number | null;
  sentiment_trend: string | null;
  voice_summary: string | null;
  executive_brief: string | null;
  voice_phrases: string[];
  pricing_blended: string | null;
  pricing_pain_score: number | null;
  switching_net_signal: string | null;
  switching_reasons_out: string[];
  partial: boolean;
  failed_platforms: string[];
  created_at: string;
  updated_at: string;
};

export type Complaint = {
  id: string;
  report_id: string;
  external_id: string;
  title: string;
  tag: string | null;
  mentions: number;
  delta: string | null;
  severity: number;
  summary: string | null;
  threads: number;
  sample: string | null;
  sort_order: number;
};

export type FeatureGap = {
  id: string;
  report_id: string;
  feature: string;
  votes: number;
  signal: number;
  sort_order: number;
};

export type PricingTier = { tier: string; pain: number; note: string | null };
export type PricingQuote = { who: string; sub: string | null; text: string };
export type PricingResponse = {
  tiers: PricingTier[];
  quotes: PricingQuote[];
  blended: string | null;
  pain_score: number | null;
};

export type SwitchingFlow = { partner: string; count: number; share: number };
export type SwitchingResponse = {
  inbound: SwitchingFlow[];
  outbound: SwitchingFlow[];
  net_signal: string | null;
  reasons_out: string[];
};

export type QuoteRow = {
  id: string;
  report_id: string;
  who: string;
  sub: string | null;
  posted_at: string | null;
  when_label: string | null;
  score: number;
  sentiment: number;
  text: string;
  sort_order: number;
};

export type VoiceWord = { word: string; count: number };
export type VoiceResponse = {
  summary: string | null;
  phrases: string[];
  positive: VoiceWord[];
  negative: VoiceWord[];
};

export type Positioning = {
  id: string;
  report_id: string;
  angle: string;
  thesis: string;
  audience: string | null;
  against: string | null;
  sort_order: number;
};

export type ActionRow = {
  id: string;
  report_id: string;
  step: string;
  detail: string | null;
  effort: string | null;
  role: string | null;
  sort_order: number;
};

export type LeadRow = {
  id: string;
  report_id: string;
  who: string;
  sub: string | null;
  when_label: string | null;
  score: number;
  signal: string | null;
  quote: string;
  sort_order: number;
};

export type Opportunity = {
  id: string;
  report_id: string;
  title: string;
  thesis: string;
  effort: string | null;
  payoff: string | null;
  anchor_complaint_id: string | null;
  sort_order: number;
};

export type PlatformStat = {
  id: string;
  report_id: string;
  platform_id: string;
  name: string;
  posts: number;
  sentiment: number | null;
  contexts: string[];
  sort_order: number;
};

export type Subreddit = {
  id: string;
  report_id: string;
  name: string;
  posts: number;
  sentiment: number | null;
  sort_order: number;
};

export type ThreadRow = {
  id: string;
  report_id: string;
  external_id: string;
  title: string;
  url: string | null;
  source: string | null;
  posted_at: string | null;
  score: number;
  sentiment: number | null;
  excerpt: string | null;
};

export type ThreadDetail = ThreadRow & {
  body: string | null;
  comments: Array<{
    id: string;
    author: string;
    body: string;
    score: number;
    posted_at: string | null;
  }>;
};

export type ReportProgressPlatform = {
  platform: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: "scrape" | "stage_a" | "stage_b" | "done" | "failed";
  attempt_count: number;
  last_error: string | null;
  last_event_at: string | null;
};

export type ReportProgressEvent = {
  stage: string;
  event: "started" | "completed" | "failed" | "retrying";
  platform: string | null;
  attempt: number;
  duration_ms: number | null;
  created_at: string;
};

export type ReportProgress = {
  report: {
    id: string;
    status: string;
    partial: boolean;
    failed_platforms: string[];
  };
  platforms: ReportProgressPlatform[];
  events: ReportProgressEvent[];
  metrics: { mentions: number; complaints: number; quotes: number; comments: number };
};

export type CreateReportPayload = {
  category: string;
  competitors: string[];
  target_audience: string;
  founder_goal: string;
  selected_platforms: string[];
  website_url?: string;
};

export type CreateReportResponse = { id: string; stage: string };

export async function listReports(): Promise<ReportRow[]> {
  const res = await axios.get<ApiList<ReportRow>>(endpoints.reports.list);
  return unwrapList(res).items;
}

export async function getReport(id: string): Promise<ReportRow> {
  const res = await axios.get<ApiSuccess<ReportRow>>(
    endpoints.reports.detail(id),
  );
  return unwrap(res);
}

export async function getReportProgress(id: string): Promise<ReportProgress> {
  const res = await axios.get<ApiSuccess<ReportProgress>>(
    endpoints.reports.progress(id),
  );
  return unwrap(res);
}

export async function createReport(
  payload: CreateReportPayload,
): Promise<CreateReportResponse> {
  const res = await axios.post<ApiSuccess<CreateReportResponse>>(
    endpoints.reports.list,
    payload,
  );
  return unwrap(res);
}

export async function getComplaints(id: string): Promise<Complaint[]> {
  const res = await axios.get<ApiList<Complaint>>(
    endpoints.reports.complaints(id),
  );
  return unwrapList(res).items;
}

export async function getFeatureGaps(id: string): Promise<FeatureGap[]> {
  const res = await axios.get<ApiList<FeatureGap>>(
    endpoints.reports.featureGaps(id),
  );
  return unwrapList(res).items;
}

export async function getPricing(id: string): Promise<PricingResponse> {
  const res = await axios.get<ApiSuccess<PricingResponse>>(
    endpoints.reports.pricing(id),
  );
  return unwrap(res);
}

export async function getSwitching(id: string): Promise<SwitchingResponse> {
  const res = await axios.get<ApiSuccess<SwitchingResponse>>(
    endpoints.reports.switching(id),
  );
  return unwrap(res);
}

export async function getQuotes(id: string): Promise<QuoteRow[]> {
  const res = await axios.get<ApiList<QuoteRow>>(endpoints.reports.quotes(id));
  return unwrapList(res).items;
}

export async function getVoice(id: string): Promise<VoiceResponse> {
  const res = await axios.get<ApiSuccess<VoiceResponse>>(
    endpoints.reports.voice(id),
  );
  return unwrap(res);
}

export async function getPositioning(id: string): Promise<Positioning[]> {
  const res = await axios.get<ApiList<Positioning>>(
    endpoints.reports.positioning(id),
  );
  return unwrapList(res).items;
}

export async function getActions(id: string): Promise<ActionRow[]> {
  const res = await axios.get<ApiList<ActionRow>>(
    endpoints.reports.actions(id),
  );
  return unwrapList(res).items;
}

export async function getLeads(id: string): Promise<LeadRow[]> {
  const res = await axios.get<ApiList<LeadRow>>(endpoints.reports.leads(id));
  return unwrapList(res).items;
}

export async function getOpportunities(id: string): Promise<Opportunity[]> {
  const res = await axios.get<ApiList<Opportunity>>(
    endpoints.reports.opportunities(id),
  );
  return unwrapList(res).items;
}

export async function getPlatforms(id: string): Promise<PlatformStat[]> {
  const res = await axios.get<ApiList<PlatformStat>>(
    endpoints.reports.platforms(id),
  );
  return unwrapList(res).items;
}

export async function getSubreddits(id: string): Promise<Subreddit[]> {
  const res = await axios.get<ApiList<Subreddit>>(
    endpoints.reports.subreddits(id),
  );
  return unwrapList(res).items;
}

export async function getSentimentSeries(id: string): Promise<number[]> {
  const res = await axios.get<ApiSuccess<number[]>>(
    endpoints.reports.sentimentSeries(id),
  );
  return unwrap(res);
}

export async function getThreads(id: string): Promise<ThreadRow[]> {
  const res = await axios.get<ApiList<ThreadRow>>(
    endpoints.reports.threads(id),
  );
  return unwrapList(res).items;
}

export async function getThread(
  id: string,
  threadId: string,
): Promise<ThreadDetail> {
  const res = await axios.get<ApiSuccess<ThreadDetail>>(
    endpoints.reports.thread(id, threadId),
  );
  return unwrap(res);
}

export async function retryPlatform(
  reportId: string,
  platform: string,
): Promise<void> {
  await axios.post(endpoints.reports.retryPlatform(reportId), { platform });
}
