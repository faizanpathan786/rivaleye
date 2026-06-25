import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/icons";
import {
  useReportActionsQuery,
  useReportComplaintsQuery,
  useReportFeatureGapsQuery,
  useReportLeadsQuery,
  useReportOpportunitiesQuery,
  useReportPlatformsQuery,
  useReportPositioningQuery,
  useReportPricingQuery,
  useReportProgressQuery,
  useReportQuery,
  useReportQuotesQuery,
  useReportSentimentSeriesQuery,
  useReportSwitchingQuery,
  useReportVoiceQuery,
} from "@/hooks/queries/use-reports";
import { retryPlatform } from "@/api/reports";
import { formatRelative } from "@/lib/format";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { ReportErrorBoundary } from "@/components/report/report-error-boundary";
import { ReportInProgress } from "@/components/report/report-in-progress";
import { ReportSkeleton } from "@/components/report/report-skeleton";
import { ThreadModal } from "@/components/report/thread-modal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  ActionRow,
  Complaint,
  FeatureGap,
  LeadRow,
  Opportunity,
  PlatformStat,
  Positioning,
  PricingResponse,
  QuoteRow,
  ReportRow,
  SwitchingResponse,
  VoiceResponse,
} from "@/api/reports";

type Tone = "pos" | "neg" | "warn" | undefined;

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const query = useReportQuery(reportId);
  const progressQuery = useReportProgressQuery(reportId);

  if (query.isLoading || !query.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <ReportSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <Alert variant="destructive">
          <AlertTitle>Could not load report</AlertTitle>
          <AlertDescription>
            {(query.error as Error)?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (query.data.status !== "completed") {
    return (
      <ReportInProgress report={query.data} progress={progressQuery.data} />
    );
  }

  return (
    <ReportErrorBoundary>
      <PainReport report={query.data} reportId={reportId} />
    </ReportErrorBoundary>
  );
}

type TabKey =
  | "overview"
  | "complaints"
  | "voice"
  | "pricing"
  | "switching"
  | "quotes"
  | "leads"
  | "positioning"
  | "opportunities"
  | "actions";

function PainReport({
  report,
  reportId,
}: {
  report: ReportRow;
  reportId: string;
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const sidebarOpen = searchParams.get("panel") === "pain";

  function setSidebarOpen(open: boolean) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (open) next.set("panel", "pain");
      else next.delete("panel");
      return next;
    });
  }
  const queryClient = useQueryClient();

  const onRetryFailed = async () => {
    for (const p of report.failed_platforms ?? []) {
      await retryPlatform(report.id, p);
    }
    queryClient.invalidateQueries({ queryKey: ["report", report.id] });
  };

  const complaints = useReportComplaintsQuery(reportId).data ?? [];
  const voice = useReportVoiceQuery(reportId).data;
  const pricing = useReportPricingQuery(reportId).data;
  const switching = useReportSwitchingQuery(reportId).data;
  const quotes = useReportQuotesQuery(reportId).data ?? [];
  const leads = useReportLeadsQuery(reportId).data ?? [];
  const positioning = useReportPositioningQuery(reportId).data ?? [];
  const opportunities = useReportOpportunitiesQuery(reportId).data ?? [];
  const actions = useReportActionsQuery(reportId).data ?? [];
  const featureGaps = useReportFeatureGapsQuery(reportId).data ?? [];
  const platforms = useReportPlatformsQuery(reportId).data ?? [];
  const sentimentSeries = useReportSentimentSeriesQuery(reportId).data ?? [];

  const tabs: Array<[TabKey, string]> = [
    ["overview", "Overview"],
    ["complaints", `Pain (${complaints.length})`],
    ["voice", "Voice of customer"],
    ["pricing", "Pricing"],
    ["switching", "Switching"],
    ["quotes", `Verbatim (${quotes.length})`],
    ["leads", `Leads (${leads.length})`],
    ["positioning", "Positioning"],
    ["opportunities", `Opportunities (${opportunities.length})`],
    ["actions", "Recommended actions"],
  ];

  return (
    <div>
      <ReportHeader
        report={report}
        platformsCount={platforms.length}
        partial={report.partial}
        failed_platforms={report.failed_platforms}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onRetryFailed={
          report.partial && report.failed_platforms.length > 0
            ? onRetryFailed
            : undefined
        }
      />


      <div
        className="flex gap-1 overflow-x-auto px-4 md:px-7"
        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--bg)" }}
      >
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="relative cursor-pointer whitespace-nowrap border-0 bg-transparent py-3 pr-4 text-[13px]"
            style={{
              color: tab === k ? "var(--fg)" : "var(--fg-muted)",
              fontWeight: tab === k ? 500 : 400,
              borderBottom:
                tab === k ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mx-auto flex max-w-[1440px] items-start gap-0">
        {/* Main content */}
        <div className="min-w-0 flex-1 px-4 pb-16 pt-5 md:px-7">
          {tab === "overview" && (
            <OverviewTab
              report={report}
              complaints={complaints}
              quotes={quotes}
              platforms={platforms}
              switching={switching}
              sentimentSeries={sentimentSeries}
              featureGaps={featureGaps}
              onOpenThread={setOpenThread}
              onSwitchTab={setTab}
            />
          )}
          {tab === "complaints" && (
            <PainCard
              complaints={complaints}
              opportunities={opportunities}
              onOpenThread={setOpenThread}
            />
          )}
          {tab === "voice" && <VoiceTab voice={voice} competitorName={report.primary_competitor_name ?? "Competitor"} />}
          {tab === "pricing" && <PricingTab pricing={pricing} />}
          {tab === "switching" && <SwitchingTab switching={switching} />}
          {tab === "quotes" && <QuotesCard quotes={quotes} />}
          {tab === "leads" && <LeadsCard leads={leads} />}
          {tab === "positioning" && <PositioningCard positioning={positioning} />}
          {tab === "opportunities" && (
            <OpportunitiesCard opportunities={opportunities} />
          )}
          {tab === "actions" && <ActionsCard actions={actions} reportId={reportId} />}
        </div>

        {/* Pain & Opportunities sidebar */}
        {sidebarOpen && (
          <PainSidebar
            complaints={complaints}
            opportunities={opportunities}
            onOpenThread={setOpenThread}
            onGoToPain={() => setTab("complaints")}
          />
        )}
      </div>

      <ThreadModal
        reportId={reportId}
        threadId={openThread}
        onClose={() => setOpenThread(null)}
      />
    </div>
  );
}

function ReportHeader({
  report,
  platformsCount,
  partial,
  failed_platforms,
  sidebarOpen,
  onToggleSidebar,
  onRetryFailed,
}: {
  report: ReportRow;
  platformsCount: number;
  partial?: boolean;
  failed_platforms?: string[];
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onRetryFailed?: () => void;
}) {
  const navigate = useNavigate();
  const name =
    report.primary_competitor_name ?? report.competitors[0] ?? "Report";
  const domain = report.primary_competitor_domain;
  const sentiment = report.sentiment_overall;
  return (
    <div
      className="px-4 pb-3 pt-5 md:px-7"
      style={{ borderBottom: "1px solid var(--border-soft)" }}
    >
      {partial && failed_platforms && failed_platforms.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          <span>
            Partial report. Missing platforms:{" "}
            <span className="font-medium">{failed_platforms.join(", ")}</span>.
          </span>
          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              Retry failed platforms
            </button>
          )}
        </div>
      )}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <CompetitorAvatar name={name} domain={domain} size={52} borderRadius={12} />
          <div className="min-w-0">
            <div className="re-eyebrow">
              INTELLIGENCE REPORT · {(report.category ?? "").toUpperCase()}
            </div>
            <h1 className="re-h1 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 break-words">
              {name}
              {domain && (
                <span className="break-all font-mono-feat text-sm font-normal text-fg-faint">
                  {domain}
                </span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <span className="font-mono-feat text-[11px] text-fg-faint">
                SCANNED {formatRelative(report.scanned_at)}
              </span>
              <span className="font-mono-feat text-[11px] text-fg-faint">·</span>
              <span className="font-mono-feat text-[11px] text-fg-faint">
                {(report.total_sources ?? 0).toLocaleString()} mentions across{" "}
                {platformsCount} platforms
              </span>
              {report.status === "completed" && (
                <span className="re-chip re-chip-pos" style={{ fontSize: 10 }}>
                  FRESH
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="re-btn re-btn-ghost"
            onClick={onToggleSidebar}
            style={{
              color: sidebarOpen ? "var(--accent)" : undefined,
              background: sidebarOpen ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined,
            }}
          >
            <Icon name="list" size={14} />
            Pain & Opps
            <Icon name={sidebarOpen ? "chev-right" : "chev-left"} size={12} />
          </button>
          <button className="re-btn" onClick={() => navigate("/compare")}>
            <Icon name="compare" size={14} /> Compare
          </button>
          <button className="re-btn">
            <Icon name="spark" size={14} /> Re-run scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <BigStat
          label="Sentiment index"
          value={sentiment != null ? sentiment.toFixed(2) : "—"}
          sub={report.sentiment_trend ?? ""}
          tone="neg"
          painted
        />
        <BigStat
          label="Mentions"
          value={(report.total_sources ?? 0).toLocaleString()}
          sub={`${report.total_threads ?? 0} threads`}
        />
        <BigStat
          label="Platforms"
          value={platformsCount.toString()}
          sub="all sources active"
        />
        <BigStat
          label="Switching net"
          value={report.switching_net_signal ?? "—"}
          sub="inbound · 90d"
          tone="pos"
        />
        <BigStat
          label="Pricing pain"
          value={
            report.pricing_pain_score != null
              ? report.pricing_pain_score.toFixed(2)
              : "—"
          }
          sub={report.pricing_blended ?? ""}
          tone="warn"
        />
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  tone,
  painted,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  painted?: boolean;
}) {
  const color = toneColor(tone);
  return (
    <div
      className="rounded-[10px] border p-3"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border-soft)",
      }}
    >
      <div className="re-eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="font-mono-feat tnum"
          style={{
            fontSize: value.length > 6 ? 13 : 22,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 2,
            color: painted ? color : "var(--fg)",
          }}
        >
          {value}
        </span>
      </div>
      {sub && (
        <div className="mt-0.5 line-clamp-2" style={{ fontSize: 11, color }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function toneColor(tone: Tone): string {
  if (tone === "neg") return "var(--neg)";
  if (tone === "pos") return "var(--pos)";
  if (tone === "warn") return "var(--warn)";
  return "var(--fg)";
}

// ─────────────────────────────────────────────────────────────────────────
// OVERVIEW

function OverviewTab({
  report,
  complaints,
  quotes,
  platforms,
  switching,
  sentimentSeries,
  featureGaps,
  onOpenThread,
  onSwitchTab,
}: {
  report: ReportRow;
  complaints: Complaint[];
  quotes: QuoteRow[];
  platforms: PlatformStat[];
  switching: SwitchingResponse | undefined;
  sentimentSeries: number[];
  featureGaps: FeatureGap[];
  onOpenThread: (id: string) => void;
  onSwitchTab: (tab: TabKey) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-4">
        <ExecutiveBriefCard brief={report.executive_brief ?? null} />
        <SummaryCard report={report} complaints={complaints} />
        <ComplaintsCard
          complaints={complaints.slice(0, 5)}
          totalCount={complaints.length}
          showViewAll
          onOpenThread={onOpenThread}
        />
        {sentimentSeries.length > 1 && (
          <SentimentCard series={sentimentSeries} />
        )}
        {switching && <SwitchingSummary switching={switching} />}
      </div>
      <div className="flex flex-col gap-4">
        {platforms.length > 0 && <PlatformBreakdown platforms={platforms} />}
        <VerbatimCard quotes={quotes.slice(0, 5)} totalCount={quotes.length} onViewAll={() => onSwitchTab("quotes")} />
        {featureGaps.length > 0 && (
          <FeatureGapsCard featureGaps={featureGaps.slice(0, 6)} />
        )}
      </div>
    </div>
  );
}

function ExecutiveBriefCard({ brief }: { brief: string | null }) {
  if (!brief) return null;
  return (
    <div className="rounded-[10px] border p-5" style={{ borderColor: "var(--accent)", borderWidth: 1.5 }}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
        Intelligence Brief
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--fg)" }}>
        {brief}
      </p>
    </div>
  );
}

function SummaryCard({
  report,
  complaints,
}: {
  report: ReportRow;
  complaints: Complaint[];
}) {
  const topTags = useMemo(() => {
    const seen = new Set<string>();
    for (const c of complaints) {
      if (c.tag && !seen.has(c.tag)) seen.add(c.tag);
      if (seen.size >= 4) break;
    }
    return Array.from(seen);
  }, [complaints]);

  const summary = report.voice_summary;

  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>
          <Icon name="alert" size={14} /> Executive summary
        </h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          auto · {formatRelative(report.scanned_at)}
        </span>
      </div>
      <div className="re-card-body">
        {summary ? (
          <p
            className="m-0 text-fg-muted"
            style={{ fontSize: 14, lineHeight: 1.65 }}
          >
            {summary}
          </p>
        ) : (
          <p className="m-0 text-fg-faint" style={{ fontSize: 13 }}>
            Summary not yet generated.
          </p>
        )}
        {topTags.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-2">
            {topTags.map((t, i) => (
              <span
                key={t}
                className={`re-chip ${i === 0 ? "re-chip-accent" : ""}`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ComplaintsCard({
  complaints,
  totalCount,
  showViewAll,
  onViewAll,
  onOpenThread,
}: {
  complaints: Complaint[];
  totalCount?: number;
  showViewAll?: boolean;
  onViewAll?: () => void;
  onOpenThread: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    complaints[0]?.id ?? null,
  );

  if (complaints.length === 0) {
    return (
      <div className="re-card">
        <div className="re-card-hd">
          <h3>Top complaints</h3>
        </div>
        <div className="re-card-body">
          <p className="m-0 text-fg-faint" style={{ fontSize: 13 }}>
            No complaints detected yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Top complaints</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          ranked by severity × frequency
        </span>
      </div>
      <div>
        {complaints.map((cp, i) => {
          const isExp = expanded === cp.id;
          const deltaPositive = cp.delta?.startsWith("+");
          return (
            <div
              key={cp.id}
              style={{
                borderTop:
                  i === 0 ? 0 : "1px solid var(--border-soft)",
              }}
            >
              <button
                onClick={() => setExpanded(isExp ? null : cp.id)}
                className="grid w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left hover:bg-hover"
                style={{
                  gridTemplateColumns: "24px minmax(0,1fr) auto auto 48px 14px",
                }}
              >
                <span
                  className="font-mono-feat tnum text-fg-faint"
                  style={{ fontSize: 11 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words" style={{ fontSize: 14, fontWeight: 500 }}>
                      {cp.title}
                    </span>
                    {cp.tag && (
                      <span className={`re-tag ${tagClass(cp.tag)}`}>
                        {cp.tag}
                      </span>
                    )}
                    {cp.mentions > 0 && (
                      <span className="text-[10px] rounded px-1.5 py-0.5 font-medium" style={{ background: "var(--surface-raised)", color: "var(--fg-muted)" }}>
                        {cp.mentions} {cp.mentions === 1 ? "mention" : "mentions"}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="font-mono-feat tnum text-fg-muted"
                  style={{ fontSize: 12 }}
                >
                  {cp.mentions}
                </span>
                <span
                  className="font-mono-feat tnum text-right"
                  style={{
                    fontSize: 12,
                    width: 36,
                    color: deltaPositive ? "var(--neg)" : "var(--pos)",
                  }}
                >
                  {cp.delta ?? ""}
                </span>
                <div className="re-meter neg">
                  <i style={{ width: `${(cp.severity ?? 0) * 100}%` }} />
                </div>
                <Icon
                  name={isExp ? "chev-down" : "chev-right"}
                  size={14}
                  className="text-fg-faint"
                />
              </button>
              {isExp && (
                <div
                  className="fade-up grid grid-cols-1 gap-4 pb-4 pl-4 pr-4 md:grid-cols-[1.4fr_1fr] md:pl-[52px]"
                >
                  <div>
                    {cp.summary && (
                      <p
                        className="m-0 text-fg-muted"
                        style={{ fontSize: 13, lineHeight: 1.6 }}
                      >
                        {cp.summary}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        className="re-btn re-btn-sm"
                        onClick={() => onOpenThread(cp.external_id || cp.id)}
                      >
                        <Icon name="list" size={12} /> View {cp.threads}{" "}
                        threads
                      </button>
                    </div>
                  </div>
                  {cp.sample && (
                    <div
                      className="rounded-md p-3"
                      style={{
                        background: "var(--surface-2)",
                        borderLeft: "2px solid var(--accent)",
                      }}
                    >
                      {cp.sample_author && (
                        <div className="re-eyebrow mb-1.5" style={{ fontSize: 10 }}>
                          @{cp.sample_author}
                        </div>
                      )}
                      <p
                        className="m-0 italic"
                        style={{ fontSize: 13, lineHeight: 1.55 }}
                      >
                        "{cp.sample}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showViewAll && totalCount && totalCount > complaints.length && (
        <div
          className="px-4 py-2.5 text-center"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <button className="re-btn re-btn-ghost re-btn-sm" onClick={onViewAll}>
            View all {totalCount} <Icon name="arrow-right" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function PainSidebar({
  complaints,
  opportunities,
  onOpenThread,
  onGoToPain,
}: {
  complaints: Complaint[];
  opportunities: Opportunity[];
  onOpenThread: (id: string) => void;
  onGoToPain: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const oppByComplaint = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const o of opportunities) {
      if (!o.anchor_complaint_id) continue;
      const list = map.get(o.anchor_complaint_id) ?? [];
      list.push(o);
      map.set(o.anchor_complaint_id, list);
    }
    return map;
  }, [opportunities]);

  return (
    <div
      className="hidden lg:flex"
      style={{
        width: 300,
        flexShrink: 0,
        flexDirection: "column",
        borderLeft: "1px solid var(--border-soft)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--bg)" , position: "sticky", top: 0, zIndex: 1 }}
      >
        <div>
          <div className="font-mono-feat" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)" }}>
            Pain & Opportunities
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
            {complaints.length} complaints · {opportunities.length} opportunities
          </div>
        </div>
        <button className="re-btn re-btn-ghost re-btn-sm" onClick={onGoToPain}>
          Full view <Icon name="chev-right" size={11} />
        </button>
      </div>

      {/* Complaint list */}
      {complaints.length === 0 ? (
        <div className="px-4 py-8 text-center" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
          No pain signals yet
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          {complaints.map((cp, i) => {
            const isExp = expanded === cp.id;
            const linked = oppByComplaint.get(cp.id) ?? [];
            return (
              <div
                key={cp.id}
                style={{ borderBottom: "1px solid var(--border-soft)" }}
              >
                {/* Row */}
                <button
                  onClick={() => setExpanded(isExp ? null : cp.id)}
                  className="w-full cursor-pointer border-0 bg-transparent px-4 py-3 text-left hover:bg-hover"
                  style={{ display: "block" }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="font-mono-feat tnum mt-0.5 shrink-0"
                      style={{ fontSize: 10, color: "var(--fg-faint)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="break-words leading-snug"
                        style={{ fontSize: 13, fontWeight: 500 }}
                      >
                        {cp.title}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        {/* Severity bar */}
                        <div className="re-meter neg" style={{ flex: 1, height: 3 }}>
                          <i style={{ width: `${(cp.severity ?? 0) * 100}%` }} />
                        </div>
                        <span className="font-mono-feat tnum shrink-0" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                          {cp.mentions}
                        </span>
                      </div>
                      {/* Opportunity pill */}
                      {linked.length > 0 && (
                        <div className="mt-1.5">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 font-medium leading-tight"
                            style={{
                              fontSize: 10,
                              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                              color: "var(--accent)",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "block",
                            }}
                          >
                            ↳ {linked[0]?.title}
                          </span>
                        </div>
                      )}
                    </div>
                    <Icon
                      name={isExp ? "chev-down" : "chev-right"}
                      size={12}
                      className="mt-0.5 shrink-0 text-fg-faint"
                    />
                  </div>
                </button>

                {/* Expanded detail */}
                {isExp && (
                  <div
                    className="fade-up px-4 pb-3"
                    style={{ borderTop: "1px solid var(--border-soft)", background: "var(--surface-2)" }}
                  >
                    {cp.summary && (
                      <p className="mb-2 mt-3 text-fg-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
                        {cp.summary}
                      </p>
                    )}
                    {cp.sample && (
                      <div
                        className="mb-3 rounded p-2.5"
                        style={{ borderLeft: "2px solid var(--accent)", background: "var(--bg)" }}
                      >
                        {cp.sample_author && (
                          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 4 }}>
                            @{cp.sample_author}
                          </div>
                        )}
                        <p className="m-0 italic" style={{ fontSize: 12, lineHeight: 1.55 }}>
                          "{cp.sample}"
                        </p>
                      </div>
                    )}
                    {linked.length > 0 && (
                      <div
                        className="rounded"
                        style={{ border: "1px solid var(--border-soft)", overflow: "hidden" }}
                      >
                        <div
                          className="px-3 py-1.5"
                          style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--border-soft)" }}
                        >
                          <span className="font-mono-feat" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
                            What to do
                          </span>
                        </div>
                        {linked.map((o, oi) => (
                          <div
                            key={o.id}
                            className="px-3 py-2.5"
                            style={{ borderTop: oi === 0 ? 0 : "1px solid var(--border-soft)" }}
                          >
                            <div className="font-medium" style={{ fontSize: 12 }}>{o.title}</div>
                            {o.thesis && (
                              <div className="mt-1 text-fg-muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
                                {o.thesis}
                              </div>
                            )}
                            <div className="mt-2 flex gap-2">
                              {o.effort && <StatLabel label="effort" value={o.effort} />}
                              {o.payoff && <StatLabel label="payoff" value={o.payoff} hot={o.payoff === "high"} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="re-btn re-btn-ghost re-btn-sm mt-2"
                      onClick={() => onOpenThread(cp.external_id || cp.id)}
                    >
                      <Icon name="list" size={11} /> {cp.threads} threads
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function tagClass(tag: string): string {
  const m: Record<string, string> = {
    Pricing: "re-tag-pricing",
    "Feature gap": "re-tag-gap",
    Mobile: "re-tag-mobile",
    Reporting: "re-tag-report",
    Admin: "re-tag-admin",
    Performance: "re-tag-perf",
    Workflow: "re-tag-flow",
  };
  return m[tag] ?? "";
}

function PainCard({
  complaints,
  opportunities,
  onOpenThread,
}: {
  complaints: Complaint[];
  opportunities: Opportunity[];
  onOpenThread: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(
    complaints[0]?.id ?? null,
  );

  const oppByComplaint = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const o of opportunities) {
      if (!o.anchor_complaint_id) continue;
      const existing = map.get(o.anchor_complaint_id) ?? [];
      existing.push(o);
      map.set(o.anchor_complaint_id, existing);
    }
    return map;
  }, [opportunities]);

  if (complaints.length === 0)
    return <EmptyTab label="No pain signals detected yet." />;

  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Pain signals</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          complaint → evidence → opportunity
        </span>
      </div>
      <div>
        {complaints.map((cp, i) => {
          const isExp = expanded === cp.id;
          const deltaPositive = cp.delta?.startsWith("+");
          const linked = oppByComplaint.get(cp.id) ?? [];

          return (
            <div
              key={cp.id}
              style={{ borderTop: i === 0 ? 0 : "1px solid var(--border-soft)" }}
            >
              {/* Row header — click to expand */}
              <button
                onClick={() => setExpanded(isExp ? null : cp.id)}
                className="grid w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left hover:bg-hover"
                style={{ gridTemplateColumns: "24px minmax(0,1fr) auto 52px 14px" }}
              >
                <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words" style={{ fontSize: 14, fontWeight: 500 }}>
                      {cp.title}
                    </span>
                    {cp.tag && (
                      <span className={`re-tag ${tagClass(cp.tag)}`}>{cp.tag}</span>
                    )}
                    {cp.mentions > 0 && (
                      <span
                        className="rounded px-1.5 py-0.5 font-medium"
                        style={{ fontSize: 10, background: "var(--surface-raised)", color: "var(--fg-muted)" }}
                      >
                        {cp.mentions} {cp.mentions === 1 ? "mention" : "mentions"}
                      </span>
                    )}
                    {linked.length > 0 && (
                      <span
                        className="rounded px-1.5 py-0.5 font-medium"
                        style={{ fontSize: 10, background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
                      >
                        {linked.length} {linked.length === 1 ? "opportunity" : "opportunities"}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="font-mono-feat tnum text-right"
                  style={{ fontSize: 12, color: deltaPositive ? "var(--neg)" : "var(--pos)" }}
                >
                  {cp.delta ?? ""}
                </span>
                <div className="re-meter neg">
                  <i style={{ width: `${(cp.severity ?? 0) * 100}%` }} />
                </div>
                <Icon name={isExp ? "chev-down" : "chev-right"} size={14} className="text-fg-faint" />
              </button>

              {/* Expanded body */}
              {isExp && (
                <div className="fade-up pb-5 pl-4 pr-4 md:pl-[52px]" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Summary + threads */}
                  <div>
                    {cp.summary && (
                      <p className="m-0 text-fg-muted" style={{ fontSize: 13, lineHeight: 1.65 }}>
                        {cp.summary}
                      </p>
                    )}
                    <div className="mt-3">
                      <button
                        className="re-btn re-btn-sm"
                        onClick={() => onOpenThread(cp.external_id || cp.id)}
                      >
                        <Icon name="list" size={12} /> View {cp.threads} threads
                      </button>
                    </div>
                  </div>

                  {/* Verbatim quote */}
                  {cp.sample && (
                    <div
                      className="rounded-md p-3.5"
                      style={{ background: "var(--surface-2)", borderLeft: "2px solid var(--accent)" }}
                    >
                      {cp.sample_author && (
                        <div className="re-eyebrow mb-1.5" style={{ fontSize: 10 }}>
                          @{cp.sample_author}
                        </div>
                      )}
                      <p className="m-0 italic" style={{ fontSize: 13, lineHeight: 1.6 }}>
                        "{cp.sample}"
                      </p>
                    </div>
                  )}

                  {/* Linked opportunities */}
                  {linked.length > 0 && (
                    <div
                      className="rounded-md"
                      style={{ border: "1px solid var(--border-soft)", overflow: "hidden" }}
                    >
                      <div
                        className="flex items-center gap-2 px-4 py-2.5"
                        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-raised)" }}
                      >
                        <Icon name="arrow-right" size={12} className="text-fg-faint" />
                        <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          What to do about it
                        </span>
                      </div>
                      {linked.map((o, oi) => (
                        <div
                          key={o.id}
                          className="px-4 py-3.5"
                          style={{ borderTop: oi === 0 ? 0 : "1px solid var(--border-soft)" }}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="m-0 font-medium" style={{ fontSize: 14 }}>{o.title}</p>
                              {o.thesis && (
                                <p className="m-0 mt-1 text-fg-muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
                                  {o.thesis}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-3">
                              {o.effort && <StatLabel label="effort" value={o.effort} />}
                              {o.payoff && <StatLabel label="payoff" value={o.payoff} hot={o.payoff === "high"} />}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SentimentCard({ series }: { series: number[] }) {
  const w = 600;
  const h = 160;
  const pad = 24;
  const minY = Math.min(...series, -0.45);
  const maxY = Math.max(...series, 0);
  const x = (i: number) =>
    pad + (i / Math.max(series.length - 1, 1)) * (w - pad * 2);
  const y = (v: number) =>
    pad + ((maxY - v) / (maxY - minY || 1)) * (h - pad * 2);
  const linePath = series
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(series.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;

  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Sentiment over time</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          weekly · 90d
        </span>
      </div>
      <div style={{ padding: 12 }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="block h-auto w-full"
        >
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neg)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--neg)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#sg)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--neg)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {series.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={i === series.length - 1 ? 3.5 : 1.6}
              fill={
                i === series.length - 1 ? "var(--neg)" : "var(--surface)"
              }
              stroke="var(--neg)"
              strokeWidth="1.4"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function SwitchingSummary({ switching }: { switching: SwitchingResponse }) {
  const maxIn = Math.max(...switching.inbound.map((s) => s.count), 1);
  const maxOut = Math.max(...switching.outbound.map((s) => s.count), 1);
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Switching signals</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          {switching.net_signal ?? ""}
        </span>
      </div>
      <div className="grid gap-6 p-4 sm:grid-cols-2">
        <FlowList
          eyebrow="INBOUND"
          tone="pos"
          flows={switching.inbound}
          max={maxIn}
          field="partner"
        />
        <FlowList
          eyebrow="OUTBOUND"
          tone="neg"
          flows={switching.outbound}
          max={maxOut}
          field="partner"
        />
      </div>
    </div>
  );
}

function FlowList({
  eyebrow,
  tone,
  flows,
  max,
  field,
}: {
  eyebrow: string;
  tone: "pos" | "neg";
  flows: Array<{ partner: string; count: number }>;
  max: number;
  field: "partner";
}) {
  return (
    <div>
      <div className="re-eyebrow mb-2" style={{ fontSize: 10 }}>
        <Icon
          name="arrow-right"
          size={10}
          style={{
            display: "inline",
            verticalAlign: "middle",
            color: tone === "pos" ? "var(--pos)" : "var(--neg)",
          }}
        />{" "}
        {eyebrow}
      </div>
      <div className="flex flex-col gap-2">
        {flows.map((s) => (
          <div
            key={s[field]}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "70px 1fr 36px" }}
          >
            <span style={{ fontSize: 13 }}>{s[field]}</span>
            <div className={`re-meter ${tone}`}>
              <i style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
            <span
              className="font-mono-feat tnum text-right text-fg-faint"
              style={{ fontSize: 11 }}
            >
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformBreakdown({ platforms }: { platforms: PlatformStat[] }) {
  const total = platforms.reduce((a, b) => a + b.posts, 0) || 1;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Platform breakdown</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          {total} items
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {platforms.map((p) => {
          const pct = (p.posts / total) * 100;
          return (
            <div key={p.id}>
              <div className="mb-1 flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2" style={{ fontSize: 12 }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span className="truncate font-mono-feat text-[10px] text-fg-faint">
                    {p.contexts.slice(0, 2).join(" · ")}
                  </span>
                </span>
                <span
                  className="flex-shrink-0 font-mono-feat tnum text-fg-muted"
                  style={{ fontSize: 11 }}
                >
                  {p.posts}{" "}
                  <span className="text-fg-faint">·</span>{" "}
                  <span
                    style={{
                      color:
                        (p.sentiment ?? 0) < -0.35
                          ? "var(--neg)"
                          : "var(--fg-muted)",
                    }}
                  >
                    {(p.sentiment ?? 0).toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="re-meter">
                <i
                  style={{ width: `${pct}%`, background: "var(--fg)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerbatimCard({
  quotes,
  totalCount,
  onViewAll,
}: {
  quotes: QuoteRow[];
  totalCount: number;
  onViewAll?: () => void;
}) {
  if (quotes.length === 0) {
    return (
      <div className="re-card">
        <div className="re-card-hd">
          <h3>
            <Icon name="quote" size={14} /> Verbatim feed
          </h3>
        </div>
        <div className="re-card-body">
          <p className="m-0 text-fg-faint" style={{ fontSize: 13 }}>
            No quotes yet.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>
          <Icon name="quote" size={14} /> Verbatim feed
        </h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">live</span>
      </div>
      <div>
        {quotes.map((q, i) => (
          <div
            key={q.id}
            className="cursor-pointer px-4 py-3 hover:bg-hover"
            style={{
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono-feat text-[11px] text-fg">
                {q.who}
              </span>
              <span className="font-mono-feat text-[11px] text-fg-faint">
                {q.sub ?? ""}
              </span>
              <span className="font-mono-feat text-[11px] text-fg-faint">
                ·
              </span>
              <span className="font-mono-feat text-[11px] text-fg-faint">
                {q.when_label ?? formatRelative(q.posted_at)}
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <span
                  className="font-mono-feat tnum text-fg-faint"
                  style={{ fontSize: 11 }}
                >
                  {q.score}↑
                </span>
                <span
                  className="re-dot"
                  style={{
                    background:
                      q.sentiment > 0
                        ? "var(--pos)"
                        : q.sentiment < -0.5
                          ? "var(--neg)"
                          : "var(--warn)",
                  }}
                />
              </span>
            </div>
            <p className="m-0" style={{ fontSize: 13, lineHeight: 1.55 }}>
              "{q.text}"
            </p>
          </div>
        ))}
      </div>
      {totalCount > quotes.length && (
        <div
          className="px-4 py-2.5 text-center"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <button className="re-btn re-btn-ghost re-btn-sm" onClick={onViewAll}>
            View all {totalCount}
          </button>
        </div>
      )}
    </div>
  );
}

function FeatureGapsCard({ featureGaps }: { featureGaps: FeatureGap[] }) {
  const max = Math.max(...featureGaps.map((g) => g.votes), 1);
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Feature gaps</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          requests · 90d
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {featureGaps.map((g) => (
          <div
            key={g.id}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "minmax(0,1fr) 70px 36px" }}
          >
            <span className="truncate" style={{ fontSize: 12 }}>{g.feature}</span>
            <div className="re-meter">
              <i
                style={{
                  width: `${(g.votes / max) * 100}%`,
                  background: "var(--fg)",
                }}
              />
            </div>
            <span
              className="font-mono-feat tnum text-right text-fg-faint"
              style={{ fontSize: 11 }}
            >
              {g.votes}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// VOICE OF CUSTOMER

export function VoiceTab({
  voice,
  competitorName,
}: {
  voice: VoiceResponse | undefined;
  competitorName: string;
}) {
  if (!voice) return <EmptyTab label="Voice of customer not yet generated." />;
  const maxPos = Math.max(...voice.positive.map((w) => w.count), 1);
  const maxNeg = Math.max(...voice.negative.map((w) => w.count), 1);

  return (
    <div className="flex flex-col gap-4">
      {voice.summary && (
        <div className="re-card">
          <div className="re-card-hd">
            <h3>How users describe {competitorName}</h3>
            <span className="font-mono-feat text-[11px] text-fg-faint">
              summarized vocabulary · 90d
            </span>
          </div>
          <div className="p-3.5">
            <p
              className="m-0 text-fg-muted"
              style={{ fontSize: 14, lineHeight: 1.65 }}
            >
              {voice.summary}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <WordCard
          title="Positive vocabulary"
          subtitle="what gets praised"
          tone="pos"
          words={voice.positive}
          max={maxPos}
        />
        <WordCard
          title="Negative vocabulary"
          subtitle="what gets complained about"
          tone="neg"
          words={voice.negative}
          max={maxNeg}
        />
      </div>

      {voice.phrases.length > 0 && (
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Repeated phrases</h3>
            <span className="font-mono-feat text-[11px] text-fg-faint">
              verbatim, ranked by reuse
            </span>
          </div>
          <div className="py-1">
            {voice.phrases.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 px-5 py-3.5"
                style={{
                  borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
                }}
              >
                <span
                  className="font-mono-feat tnum text-fg-faint"
                  style={{ fontSize: 11, width: 22 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="italic" style={{ fontSize: 14 }}>
                  "{p}"
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WordCard({
  title,
  subtitle,
  tone,
  words,
  max,
}: {
  title: string;
  subtitle: string;
  tone: "pos" | "neg";
  words: Array<{ word: string; count: number }>;
  max: number;
}) {
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>
          <span className={`re-dot re-dot-${tone}`} /> {title}
        </h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          {subtitle}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-4">
        {words.map((w) => (
          <div
            key={w.word}
            className="grid items-center gap-2.5"
            style={{ gridTemplateColumns: "minmax(80px,120px) 1fr 40px" }}
          >
            <span
              className="truncate font-mono-feat"
              style={{
                fontSize: 13,
                color: tone === "neg" ? "var(--neg)" : undefined,
              }}
            >
              {w.word}
            </span>
            <div className={`re-meter ${tone}`}>
              <i style={{ width: `${(w.count / max) * 100}%` }} />
            </div>
            <span
              className="font-mono-feat tnum text-right text-fg-faint"
              style={{ fontSize: 11 }}
            >
              {w.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PRICING

export function PricingTab({ pricing }: { pricing: PricingResponse | undefined }) {
  if (!pricing) return <EmptyTab label="Pricing analysis not yet generated." />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Pricing pain by tier</h3>
            <span className="font-mono-feat text-[11px] text-fg-faint">
              pain score 0–1
            </span>
          </div>
          <div className="flex flex-col gap-3.5 p-4">
            {pricing.tiers.map((b) => {
              const color =
                b.pain > 0.7
                  ? "var(--neg)"
                  : b.pain > 0.4
                    ? "var(--warn)"
                    : "var(--pos)";
              return (
                <div key={b.tier}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span style={{ fontWeight: 500, fontSize: 14 }}>
                        {b.tier}
                      </span>
                      {b.note && (
                        <span className="text-fg-muted" style={{ fontSize: 12 }}>
                          {b.note}
                        </span>
                      )}
                    </div>
                    <span
                      className="font-mono-feat tnum"
                      style={{ fontSize: 13, color }}
                    >
                      {b.pain.toFixed(2)}
                    </span>
                  </div>
                  <div className="re-meter" style={{ height: 6 }}>
                    <i style={{ width: `${b.pain * 100}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pricing.quotes.length > 0 && (
          <div className="re-card">
            <div className="re-card-hd">
              <h3>Cost-related quotes</h3>
              <span className="font-mono-feat text-[11px] text-fg-faint">
                {pricing.quotes.length}
              </span>
            </div>
            <div>
              {pricing.quotes.map((q, i) => (
                <div
                  key={i}
                  className="p-4"
                  style={{
                    borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
                  }}
                >
                  <p
                    className="m-0 italic"
                    style={{ fontSize: 14, lineHeight: 1.55 }}
                  >
                    "{q.text}"
                  </p>
                  <div
                    className="mt-2 font-mono-feat text-fg-faint"
                    style={{ fontSize: 11 }}
                  >
                    {q.who} · {q.sub ?? ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="re-card p-3.5">
          <div className="re-eyebrow">BLENDED ASK</div>
          <div
            className="mt-1.5 font-mono-feat tnum"
            style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            {pricing.blended ?? "—"}
          </div>
          {pricing.pain_score != null && (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between">
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{ fontSize: 11 }}
                >
                  OVERALL PAIN
                </span>
                <span
                  className="font-mono-feat tnum"
                  style={{ fontSize: 12, color: "var(--neg)" }}
                >
                  {pricing.pain_score.toFixed(2)}
                </span>
              </div>
              <div className="re-meter neg" style={{ height: 6 }}>
                <i style={{ width: `${pricing.pain_score * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SWITCHING

export function SwitchingTab({
  switching,
}: {
  switching: SwitchingResponse | undefined;
}) {
  if (!switching) return <EmptyTab label="Switching analysis not yet generated." />;
  return (
    <div className="flex flex-col gap-4">
      <SwitchingSummary switching={switching} />
      {switching.reasons_out.length > 0 && (
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Common reasons to leave</h3>
            <span className="font-mono-feat text-[11px] text-fg-faint">
              outbound
            </span>
          </div>
          <div className="grid gap-2.5 p-4 sm:grid-cols-2">
            {switching.reasons_out.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-md border p-3.5"
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border-soft)",
                }}
              >
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{ fontSize: 11 }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 13 }}>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// QUOTES / LEADS / POSITIONING / OPPORTUNITIES / ACTIONS

export function QuotesCard({ quotes }: { quotes: QuoteRow[] }) {
  return <VerbatimCard quotes={quotes} totalCount={quotes.length} />;
}

export function LeadsCard({ leads }: { leads: LeadRow[] }) {
  if (leads.length === 0)
    return <EmptyTab label="No high-intent leads yet." />;
  const signalColors: Record<string, string> = {
    "explicit-switch": "var(--accent)",
    "feature-gap": "#6366f1",
    "price-pain": "var(--warn)",
    compliance: "#8b5cf6",
  };
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>High-intent leads</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          users actively signaling switch
        </span>
      </div>
      <div className="overflow-x-auto">
      <div
        className="grid items-center gap-3.5 px-5 py-2.5 font-mono-feat text-[10px] uppercase text-fg-faint"
        style={{
          gridTemplateColumns: "120px 160px minmax(180px,1fr) 70px 110px",
          minWidth: 760,
          borderBottom: "1px solid var(--border-soft)",
          letterSpacing: "0.08em",
        }}
      >
        <span>Signal</span>
        <span>User · Platform</span>
        <span>Quote</span>
        <span>Score</span>
        <span />
      </div>
      {leads.map((l, i) => (
        <div
          key={l.id}
          className="grid cursor-pointer items-center gap-3.5 px-5 py-4 hover:bg-hover"
          style={{
            gridTemplateColumns: "120px 160px minmax(180px,1fr) 70px 110px",
            minWidth: 760,
            borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
          }}
        >
          <span
            className="re-chip justify-self-start"
            style={{
              background: signalColors[l.signal ?? ""] ?? "var(--fg)",
              color: "#fff",
              borderColor: "transparent",
              fontSize: 10,
            }}
          >
            {l.signal ?? "—"}
          </span>
          <div>
            <div
              className="font-mono-feat"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              {l.who}
            </div>
            <div
              className="font-mono-feat text-fg-faint"
              style={{ fontSize: 10 }}
            >
              {l.sub ?? ""} · {l.when_label ?? ""}
            </div>
          </div>
          <div
            className="overflow-hidden italic"
            style={{
              fontSize: 13,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            "{l.quote}"
          </div>
          <span className="font-mono-feat tnum" style={{ fontSize: 12 }}>
            {l.score}↑
          </span>
          <button className="re-btn re-btn-sm justify-self-end">
            <Icon name="arrow-right" size={12} /> Outreach
          </button>
        </div>
      ))}
      </div>
    </div>
  );
}

export function PositioningCard({ positioning }: { positioning: Positioning[] }) {
  if (positioning.length === 0)
    return <EmptyTab label="No positioning angles yet." />;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Positioning angles</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          what to say · derived from competitor weakness
        </span>
      </div>
      <div>
        {positioning.map((p, i) => (
          <div
            key={p.id}
            className="grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-3 px-4 py-5 md:grid-cols-[auto_1fr_auto] md:px-7 md:py-6"
            style={{
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            }}
          >
            <span
              className="font-mono-feat tnum"
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: "var(--accent)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginTop: 6,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3
                className="m-0 break-words"
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                }}
              >
                "{p.angle}"
              </h3>
              <p
                className="mt-2.5 text-fg-muted"
                style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 720 }}
              >
                {p.thesis}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {p.audience && (
                  <span className="re-chip" style={{ fontSize: 10 }}>
                    FOR · {p.audience}
                  </span>
                )}
                {p.against && (
                  <span className="re-chip re-chip-neg" style={{ fontSize: 10 }}>
                    AGAINST · {p.against}
                  </span>
                )}
              </div>
            </div>
            <button className="re-btn re-btn-sm col-start-2 justify-self-start md:col-start-auto md:justify-self-auto">
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OpportunitiesCard({
  opportunities,
}: {
  opportunities: Opportunity[];
}) {
  if (opportunities.length === 0)
    return <EmptyTab label="No opportunities surfaced yet." />;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Competitive opportunities</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          what to build · what to say
        </span>
      </div>
      <div>
        {opportunities.map((o, i) => (
          <div
            key={o.id}
            className="grid grid-cols-[40px_1fr] items-center gap-x-5 gap-y-3 px-4 py-5 md:grid-cols-[40px_1fr_220px] md:px-6"
            style={{
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            }}
          >
            <span
              className="font-mono-feat tnum text-fg-faint"
              style={{
                fontSize: 28,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="re-h3 break-words">{o.title}</h3>
              <p
                className="mt-1.5 text-fg-muted"
                style={{ fontSize: 13, lineHeight: 1.55 }}
              >
                {o.thesis}
              </p>
            </div>
            <div className="col-start-2 flex justify-start gap-4 md:col-start-auto md:justify-end">
              {o.effort && <StatLabel label="effort" value={o.effort} />}
              {o.payoff && (
                <StatLabel
                  label="payoff"
                  value={o.payoff}
                  hot={o.payoff === "high"}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatLabel({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="re-eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div
        className="font-mono-feat"
        style={{
          fontSize: 14,
          fontWeight: 500,
          marginTop: 2,
          color: hot ? "var(--accent)" : "var(--fg)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function ActionsCard({ actions, reportId }: { actions: ActionRow[]; reportId: string }) {

  if (actions.length === 0)
    return <EmptyTab label="No recommended actions yet." />;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Recommended next actions</h3>
        <span className="font-mono-feat text-[11px] text-fg-faint">
          do these this week
        </span>
      </div>
      <div>
        {actions.map((a, i) => (
          <div
            key={a.id}
            className="grid grid-cols-[32px_1fr] items-center gap-x-4 gap-y-3 px-4 py-5 md:grid-cols-[32px_1fr_100px_110px_120px] md:px-6"
            style={{
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            }}
          >
            <span
              className="grid h-6.5 w-6.5 place-items-center rounded-full font-mono-feat tnum text-fg-muted"
              style={{
                width: 26,
                height: 26,
                border: "1px solid var(--border-strong)",
                fontSize: 12,
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="break-words" style={{ fontSize: 14, fontWeight: 500 }}>{a.step}</div>
              {a.detail && (
                <div
                  className="mt-1 text-fg-muted"
                  style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 580 }}
                >
                  {a.detail}
                </div>
              )}
            </div>
            {a.role && (
              <span
                className="re-chip col-start-2 justify-self-start md:col-start-auto"
                style={{ fontSize: 9, opacity: 0.7 }}
              >
                {a.role}
              </span>
            )}
            {a.effort && (
              <span
                className={`re-chip ${a.effort === "high" ? "re-chip-warn" : a.effort === "med" ? "" : "re-chip-pos"} col-start-2 justify-self-start md:col-start-auto`}
                style={{ fontSize: 9, opacity: 0.7 }}
              >
                effort · {a.effort}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="re-card">
      <div className="re-card-body">
        <p className="m-0 text-fg-faint" style={{ fontSize: 13 }}>
          {label}
        </p>
      </div>
    </div>
  );
}
