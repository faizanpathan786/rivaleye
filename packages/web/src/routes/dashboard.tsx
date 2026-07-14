import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Plus, RefreshCw } from "lucide-react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { ActivationHero } from "@/components/dashboard/activation";
import { CompetitorBriefing } from "@/components/dashboard/competitor-briefing";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import { ReportRail } from "@/components/dashboard/report-rail";
import { SentimentBars } from "@/components/dashboard/sentiment-bars";
import { useDashboardQuery } from "@/hooks/queries/use-dashboard";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import type { ReportRow } from "@/api/reports";
import type { CompetitorSummary, DashboardOpportunity } from "@/api/dashboard";

const PAGE = "px-4 py-6 pb-16 md:px-8 w-full";

export function DashboardPage() {
  const navigate = useNavigate();
  const dashboardQuery = useDashboardQuery();
  const reportsQuery = useReportsQuery();

  const isPending =
    (dashboardQuery.isPending && !dashboardQuery.data) ||
    (reportsQuery.isPending && !reportsQuery.data);
  const error = dashboardQuery.error || reportsQuery.error;

  if (isPending) {
    return (
      <div className={PAGE}>
        <Skeleton style={{ height: 56, marginBottom: 28, maxWidth: 440 }} />
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8">
          <Skeleton style={{ height: 340 }} />
          <Skeleton style={{ height: 340 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={PAGE}>
        <div className="re-card" style={{ padding: 16, color: "var(--neg)" }}>
          Failed to load dashboard. {error instanceof Error ? error.message : "Unknown error."}
        </div>
      </div>
    );
  }

  const data = dashboardQuery.data;
  const fullReports: ReportRow[] = reportsQuery.data ?? [];
  const opportunities = data?.opportunities ?? [];
  const competitors = data?.competitors_summary ?? [];
  const stats = data?.stats;
  const user = data?.user;

  const totalCompetitors = stats?.total_competitors ?? 0;
  const totalReports = stats?.total_reports ?? 0;

  // N = 0 — activation
  if (totalCompetitors === 0 && totalReports === 0) {
    return (
      <div className={PAGE}>
        <ActivationHero userName={user?.name ?? null} />
      </div>
    );
  }

  const focusReport =
    fullReports.find((r) => r.status === "completed") ?? fullReports[0];

  // N = 1 — single-competitor intel briefing
  if (totalCompetitors <= 1) {
    if (focusReport && focusReport.status === "completed") {
      const focusOpps = opportunities.filter((o) => o.report_id === focusReport.id);
      return (
        <div className={PAGE}>
          <CompetitorBriefing report={focusReport} opportunities={focusOpps.length ? focusOpps : opportunities} />
        </div>
      );
    }
    return (
      <div className={PAGE}>
        <PendingState report={focusReport} userName={user?.name ?? null} onScan={() => navigate("/scan")} onOpen={(id) => navigate(`/scan-report/${id}`)} />
      </div>
    );
  }

  // N >= 2 — comparison hub
  const highPayoff = opportunities.filter((o) => o.payoff === "high").length;
  const oppCount = opportunities.length;
  const headline =
    oppCount > 0
      ? `${oppCount} ${oppCount === 1 ? "opportunity" : "opportunities"} to act on`
      : `Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}.`;

  return (
    <div className={PAGE}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
        className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4"
        style={{ marginBottom: 22 }}
      >
        <div className="min-w-0">
          <div className="re-eyebrow">Across {totalCompetitors} competitors</div>
          <h1 className="re-h1" style={{ marginTop: 8 }}>{headline}</h1>
          <p className="text-fg-muted" style={{ marginTop: 6, fontSize: 13.5 }}>
            {highPayoff} high-payoff · {totalReports} reports generated
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <button className="re-btn" onClick={() => navigate("/compare")}>
            <Icon name="compare" size={14} /> Compare
          </button>
          <button className="re-btn re-btn-accent" onClick={() => navigate("/scan")}>
            <Plus size={14} /> New scan
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-3" style={{ marginBottom: 24 }}>
        <KpiTile label="Competitors" value={String(totalCompetitors)} hint="tracked" onClick={() => navigate("/competitors")} />
        <KpiTile label="Reports" value={String(totalReports)} hint="generated" onClick={() => navigate("/history")} />
        <KpiTile label="Opportunities" value={String(oppCount)} hint={`${highPayoff} high-payoff`} accent={highPayoff > 0} onClick={() => navigate("/pain-opps")} />
      </div>

      {/* Jump back in — moved to top */}
      {fullReports.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHead title="Jump back in" actionLabel="View all" onAction={() => navigate("/history")} />
          <ReportRail reports={fullReports} onOpen={(id) => navigate(`/scan-report/${id}`)} />
        </section>
      )}

      {/* analytics band — two balanced widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start" style={{ marginBottom: 28 }}>
        <div>
          <SectionHead title="Competitor sentiment" hint="Most disliked = most exposed" />
          <div className="re-card" style={{ padding: 14 }}>
            <SentimentBars competitors={competitors} />
          </div>
        </div>
        <div>
          <SectionHead title="Your competitors" actionLabel="Manage" onAction={() => navigate("/competitors")} />
          <CompetitorList competitors={competitors} onReScan={(name) => navigate("/scan", { state: { prefillCompetitor: name } })} onManage={() => navigate("/competitors")} />
        </div>
      </div>

      {/* opportunities — full width, two-up grid */}
      <section style={{ marginBottom: 32 }}>
        <SectionHead title="Opportunities to act on" hint="Across all competitors" actionLabel="All opps" onAction={() => navigate("/pain-opps")} />
        {oppCount === 0 ? (
          <div className="re-card" style={{ padding: 24, textAlign: "center" }}>
            <p className="text-fg-muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
              No opportunities surfaced yet — they appear once scans finish analysing.
            </p>
            <button className="re-btn re-btn-sm mx-auto" style={{ marginTop: 12 }} onClick={() => navigate("/scan")}>
              <Plus size={13} /> Run a scan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            {opportunities.slice(0, 6).map((o, i) => (
              <OpportunityCard key={o.id} opportunity={o} index={i} onOpen={() => navigate(`/scan-report/${o.report_id}`)} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function PendingState({
  report,
  userName,
  onScan,
  onOpen,
}: {
  report: ReportRow | undefined;
  userName: string | null;
  onScan: () => void;
  onOpen: (id: string) => void;
}) {
  const name = report?.primary_competitor_name ?? report?.competitors?.[0] ?? "your competitor";
  const failed = report?.status === "failed";
  return (
    <div className="re-card mx-auto" style={{ maxWidth: 560, padding: 32, textAlign: "center", marginTop: 24 }}>
      <div className="re-eyebrow">{failed ? "Scan failed" : "Scan in progress"}</div>
      <h1 className="re-h2" style={{ marginTop: 10 }}>
        {failed ? `We couldn't finish ${name}` : `Analysing ${name}…`}
      </h1>
      <p className="text-fg-muted mx-auto" style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.5, maxWidth: 380 }}>
        {failed
          ? "Something went wrong pulling public discussions. Try running it again."
          : `Hang tight${userName ? `, ${userName.split(" ")[0]}` : ""} — we're pulling complaints, switching signals, and quotes. Your briefing appears here when it's ready.`}
      </p>
      <div className="flex gap-2 justify-center" style={{ marginTop: 18 }}>
        {report && !failed && (
          <button className="re-btn re-btn-sm" onClick={() => onOpen(report.id)}>
            View progress <ArrowRight size={13} />
          </button>
        )}
        <button className="re-btn re-btn-accent re-btn-sm" onClick={onScan}>
          <RefreshCw size={13} /> {failed ? "Try again" : "New scan"}
        </button>
      </div>
    </div>
  );
}

function CompetitorList({
  competitors,
  onReScan,
  onManage,
}: {
  competitors: CompetitorSummary[];
  onReScan: (name: string) => void;
  onManage: () => void;
}) {
  if (competitors.length === 0) {
    return (
      <div className="re-card text-fg-muted" style={{ padding: 16, fontSize: 12.5 }}>
        Competitors you scan appear here.
      </div>
    );
  }
  return (
    <div className="re-card" style={{ overflow: "hidden" }}>
      {competitors.slice(0, 6).map((c, i) => {
        const s = c.stat_sentiment;
        const tone =
          s == null ? "var(--fg-faint)" : s <= -0.3 ? "var(--neg)" : s < -0.05 ? "var(--warn)" : s >= 0.15 ? "var(--pos)" : "var(--fg-faint)";
        return (
          <div
            key={c.id}
            className="group flex items-center gap-3"
            style={{ padding: "11px 13px", borderTop: i === 0 ? 0 : "1px solid var(--border-soft)" }}
          >
            <CompetitorAvatar name={c.name} size={26} borderRadius={6} />
            <button type="button" onClick={onManage} className="text-left" style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
              <div className="font-mono-feat" style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>
                {(c.stat_mentions ?? 0).toLocaleString()} mentions
              </div>
            </button>
            <span className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 600, color: tone }}>
              {s != null ? s.toFixed(2).replace("-", "−") : "—"}
            </span>
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-icon re-btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
              title="Re-scan"
              onClick={() => onReScan(c.name)}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SectionHead({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 16 }}>
      <div className="flex items-baseline gap-2 min-w-0">
        <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.01em" }}>{title}</h3>
        {hint && (
          <span className="font-mono-feat truncate" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
            {hint}
          </span>
        )}
      </div>
      {actionLabel && onAction && (
        <button className="re-btn re-btn-ghost re-btn-sm shrink-0" onClick={onAction}>
          {actionLabel} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="re-card text-left" style={{ padding: 14, cursor: "pointer" }}>
      <div className="re-eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="font-mono-feat tnum" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 6, color: accent ? "var(--accent)" : "var(--fg)" }}>
        {value}
      </div>
      <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 4 }}>{hint}</div>
    </button>
  );
}
