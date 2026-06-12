import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { billingKeys } from "@/hooks/queries/use-billing";
import { applyScanStart } from "@/lib/credits";
import type { Balance } from "@/api/billing";
import {
  cancelReport,
  createReport,
  getActions,
  getComplaints,
  getFeatureGaps,
  getLeads,
  getOpportunities,
  getPlatforms,
  getPositioning,
  getPricing,
  getQuotes,
  getReport,
  getReportProgress,
  getSentimentSeries,
  getSubreddits,
  getSwitching,
  getThread,
  getThreads,
  getVoice,
  listReports,
} from "@/api/reports";
import type {
  ActionRow,
  Complaint,
  CreateReportPayload,
  CreateReportResponse,
  FeatureGap,
  LeadRow,
  Opportunity,
  PlatformStat,
  Positioning,
  PricingResponse,
  ReportProgress,
  QuoteRow,
  ReportRow,
  Subreddit,
  SwitchingResponse,
  ThreadDetail,
  ThreadRow,
  VoiceResponse,
} from "@/api/reports";

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "succeeded",
  "error",
]);

export const reportsKeys = {
  all: ["reports"] as const,
  lists: () => [...reportsKeys.all, "list"] as const,
  list: () => [...reportsKeys.lists()] as const,
  details: () => [...reportsKeys.all, "detail"] as const,
  detail: (id: string | undefined) =>
    [...reportsKeys.details(), id ?? ""] as const,
  section: (id: string | undefined, section: string) =>
    [...reportsKeys.detail(id), section] as const,
  thread: (id: string | undefined, threadId: string | undefined) =>
    [...reportsKeys.detail(id), "thread", threadId ?? ""] as const,
};

export function useReportsQuery() {
  return useQuery<ReportRow[]>({
    queryKey: reportsKeys.list(),
    queryFn: listReports,
  });
}

export function useReportQuery(id: string | undefined) {
  const query = useQuery<ReportRow>({
    queryKey: reportsKeys.detail(id),
    queryFn: () => getReport(id as string),
    enabled: !!id,
    staleTime: 60000,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status && TERMINAL_STATUSES.has(status)) return false;
      return 5000;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.failureCount === 3) {
      toast.error("Having trouble connecting… still trying");
    }
  }, [query.failureCount]);

  return query;
}

export function useReportProgressQuery(id: string | undefined) {
  return useQuery<ReportProgress>({
    queryKey: reportsKeys.section(id, "progress"),
    queryFn: () => getReportProgress(id as string),
    enabled: !!id,
    staleTime: 60000,
    refetchInterval: (q) => {
      const status = q.state.data?.report.status;
      if (status && TERMINAL_STATUSES.has(status)) return false;
      return 5000;
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });
}

export function useCreateReportMutation() {
  const qc = useQueryClient();
  return useMutation<CreateReportResponse, unknown, CreateReportPayload>({
    mutationFn: (payload) => createReport(payload),
    onSuccess: () => {
      // The server consumed the credit inside the create transaction — show
      // the deduction immediately, then let the refetch confirm it.
      qc.setQueryData<Balance>(billingKeys.balance, (prev) =>
        prev ? applyScanStart(prev) : prev,
      );
      qc.invalidateQueries({ queryKey: reportsKeys.lists() });
      qc.invalidateQueries({ queryKey: billingKeys.balance });
      qc.invalidateQueries({ queryKey: billingKeys.transactions });
    },
  });
}

export function useCancelReportMutation() {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (reportId) => cancelReport(reportId),
    onSuccess: (_data, reportId) => {
      qc.invalidateQueries({ queryKey: reportsKeys.detail(reportId) });
      qc.invalidateQueries({ queryKey: reportsKeys.lists() });
    },
  });
}

function useReportSection<T>(
  id: string | undefined,
  section: string,
  fetcher: (id: string) => Promise<T>,
) {
  return useQuery<T>({
    queryKey: reportsKeys.section(id, section),
    queryFn: () => fetcher(id as string),
    enabled: !!id,
  });
}

export function useReportComplaintsQuery(id: string | undefined) {
  return useReportSection<Complaint[]>(id, "complaints", getComplaints);
}

export function useReportFeatureGapsQuery(id: string | undefined) {
  return useReportSection<FeatureGap[]>(id, "feature-gaps", getFeatureGaps);
}

export function useReportPricingQuery(id: string | undefined) {
  return useReportSection<PricingResponse>(id, "pricing", getPricing);
}

export function useReportSwitchingQuery(id: string | undefined) {
  return useReportSection<SwitchingResponse>(id, "switching", getSwitching);
}

export function useReportQuotesQuery(id: string | undefined) {
  return useReportSection<QuoteRow[]>(id, "quotes", getQuotes);
}

export function useReportVoiceQuery(id: string | undefined) {
  return useReportSection<VoiceResponse>(id, "voice", getVoice);
}

export function useReportPositioningQuery(id: string | undefined) {
  return useReportSection<Positioning[]>(id, "positioning", getPositioning);
}

export function useReportActionsQuery(id: string | undefined) {
  return useReportSection<ActionRow[]>(id, "actions", getActions);
}

export function useReportLeadsQuery(id: string | undefined) {
  return useReportSection<LeadRow[]>(id, "leads", getLeads);
}

export function useReportOpportunitiesQuery(id: string | undefined) {
  return useReportSection<Opportunity[]>(
    id,
    "opportunities",
    getOpportunities,
  );
}

export function useReportPlatformsQuery(id: string | undefined) {
  return useReportSection<PlatformStat[]>(id, "platforms", getPlatforms);
}

export function useReportSubredditsQuery(id: string | undefined) {
  return useReportSection<Subreddit[]>(id, "subreddits", getSubreddits);
}

export function useReportSentimentSeriesQuery(id: string | undefined) {
  return useReportSection<number[]>(
    id,
    "sentiment-series",
    getSentimentSeries,
  );
}

export function useReportThreadsQuery(id: string | undefined) {
  return useReportSection<ThreadRow[]>(id, "threads", getThreads);
}

export function useReportThreadQuery(
  id: string | undefined,
  threadId: string | undefined,
) {
  return useQuery<ThreadDetail>({
    queryKey: reportsKeys.thread(id, threadId),
    queryFn: () => getThread(id as string, threadId as string),
    enabled: !!id && !!threadId,
  });
}
