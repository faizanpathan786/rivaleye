import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { useDashboardQuery } from "@/hooks/queries/use-dashboard";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import { formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";
import type { RadarEvent, RadarSeverity } from "@/api/radar";

type NavKey =
  | "dashboard"
  | "radar"
  | "scan"
  | "report"
  | "competitors"
  | "history"
  | "compare"
  | "account";

const ROUTE_MAP: Record<NavKey, string> = {
  dashboard: "/",
  radar: "/radar",
  scan: "/scan",
  report: "/scan-report",
  competitors: "/competitors",
  history: "/history",
  compare: "/compare",
  account: "/account",
};

type Trend = "up" | "down";
type Tone = "neg" | "warn" | "pos" | "default";

export function DashboardPage() {
  const navigate = useNavigate();
  const onNav = (key: NavKey) => navigate(ROUTE_MAP[key]);

  const dashboardQuery = useDashboardQuery();
  const reportsQuery = useReportsQuery();

  const isLoading = dashboardQuery.isLoading || reportsQuery.isLoading;
  const error = dashboardQuery.error || reportsQuery.error;

  if (isLoading) {
    return (
      <div className="px-4 py-5 pb-14 md:px-7 w-full max-w-[1280px] mx-auto">
        <Skeleton style={{ height: 80, marginBottom: 20 }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Skeleton style={{ height: 90 }} />
          <Skeleton style={{ height: 90 }} />
          <Skeleton style={{ height: 90 }} />
          <Skeleton style={{ height: 90 }} />
        </div>
        <Skeleton style={{ height: 280, marginBottom: 20 }} />
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <Skeleton style={{ height: 320 }} />
          <Skeleton style={{ height: 320 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-5 pb-14 md:px-7 w-full max-w-[1280px] mx-auto">
        <div
          className="re-card"
          style={{
            padding: 16,
            color: "var(--neg)",
            border: "1px solid var(--border-soft)",
          }}
        >
          Failed to load dashboard. {error instanceof Error ? error.message : "Unknown error."}
        </div>
      </div>
    );
  }

  const data = dashboardQuery.data;
  const reports: ReportRow[] = data?.recent_reports ?? reportsQuery.data ?? [];
  const radarEvents: RadarEvent[] = data?.recent_radar_events ?? [];
  const opportunities = data?.opportunities ?? [];
  const stats = data?.stats;
  const user = data?.user;

  const sentimentValue =
    stats?.avg_sentiment != null ? stats.avg_sentiment.toFixed(2) : "—";
  const sentimentTone: Tone =
    stats?.avg_sentiment != null && stats.avg_sentiment < -0.15 ? "neg" : "default";

  return (
    <div className="px-4 py-5 pb-14 md:px-7 w-full max-w-[1280px] mx-auto">
      {/* Hero row */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-5">
        <div className="min-w-0">
          <div className="re-eyebrow">WORKSPACE / stitchworks</div>
          <h1 className="re-h1" style={{ marginTop: 8 }}>
            Good morning{user?.name ? `, ${user.name}` : ""}.
          </h1>
          <p className="text-fg-muted break-words" style={{ marginTop: 6, maxWidth: 600 }}>
            {stats?.total_competitors ?? 0} competitors analysed · {stats?.total_reports ?? 0} reports ·{" "}
            {stats?.total_radar_events ?? 0} radar events
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <button className="re-btn" onClick={() => onNav("compare")}>
            <Icon name="compare" size={14} /> Compare two
          </button>
          <button className="re-btn re-btn-accent" onClick={() => onNav("scan")}>
            <Icon name="plus" size={14} /> New scan
          </button>
        </div>
      </div>

      {/* Stat strip */}
      {(() => {
        const showRadar = (stats?.total_radar_events ?? 0) > 0;
        return (
          <div
            className={`grid grid-cols-2 gap-3 mb-5 ${showRadar ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            <StatTile
              label="Competitors analysed"
              value={String(stats?.total_competitors ?? 0)}
              delta="active"
              trend="up"
            />
            <StatTile
              label="Reports generated"
              value={String(stats?.total_reports ?? 0)}
              delta="all-time"
              trend="up"
            />
            <StatTile
              label="Sentiment index"
              value={sentimentValue}
              delta="avg across reports"
              trend={sentimentTone === "neg" ? "down" : "up"}
              tone={sentimentTone}
            />
            {showRadar && (
              <StatTile
                label="Urgent radar (7d)"
                value={String(stats?.urgent_radar_events_7d ?? 0)}
                delta="needs review"
                trend="up"
                tone="warn"
              />
            )}
          </div>
        );
      })()}

      {/* Recent reports — card grid */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>Recent reports</h3>
          <button className="re-btn re-btn-ghost re-btn-sm" onClick={() => onNav("history")}>
            View all <Icon name="arrow-right" size={12} />
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="re-card" style={{ padding: 32, textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
            No reports yet.{" "}
            <button className="re-btn re-btn-ghost re-btn-sm" style={{ display: "inline", padding: "0 4px", fontSize: 13 }} onClick={() => onNav("scan")}>
              Run your first scan
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto", paddingBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, width: "max-content", alignItems: "stretch" }}>
              {reports.map((r) => (
                <div key={r.id} style={{ width: 260, flexShrink: 0, display: "flex" }}>
                  <ReportCard report={r} onClick={() => navigate(`/scan-report/${r.id}`)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Two-column bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4 mt-5">
        <div className="re-card">
          <div className="re-card-hd flex-wrap gap-2">
            <h3>
              <span className="re-dot re-dot-live" /> Radar — competitor moves
            </h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                last 24h
              </span>
              <button className="re-btn re-btn-ghost re-btn-sm" onClick={() => onNav("radar")}>
                Open radar <Icon name="arrow-right" size={12} />
              </button>
            </div>
          </div>
          <div style={{ padding: "4px 0" }}>
            {radarEvents.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--fg-faint)",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                Radar monitoring activates after your first competitor is added. Run a scan to get started.{" "}
                <button
                  className="re-btn re-btn-ghost re-btn-sm"
                  style={{ display: "inline", padding: "0 4px", fontSize: 13 }}
                  onClick={() => onNav("scan")}
                >
                  Run a scan
                </button>
              </div>
            ) : (
              radarEvents.slice(0, 4).map((ev, i) => {
                const sev: RadarSeverity = ev.severity;
                const sevColor =
                  sev === "urgent" ? "var(--neg)" : sev === "high" ? "var(--warn)" : "#6366f1";
                const sevBg =
                  sev === "urgent"
                    ? "rgba(220,38,38,0.08)"
                    : sev === "high"
                    ? "rgba(217,119,6,0.08)"
                    : "rgba(99,102,241,0.08)";
                const compName = ev.competitor_name ?? "—";
                return (
                  <div
                    key={ev.id}
                    onClick={() => onNav("radar")}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 22px 1fr auto",
                      padding: "14px 16px",
                      borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
                      gap: 12,
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span
                      className="re-chip"
                      style={{
                        background: sevBg,
                        color: sevColor,
                        borderColor: "transparent",
                        fontSize: 9,
                        padding: "2px 6px",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        justifySelf: "start",
                      }}
                    >
                      {ev.severity.toUpperCase()}
                    </span>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: "#666",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {compName[0]}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ev.title}
                      </div>
                      <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                        {compName} · {ev.platform} · {formatRelative(ev.detected_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="re-card">
          <div className="re-card-hd flex-wrap gap-2">
            <h3>Opportunity hopper</h3>
            <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              cross-competitor
            </span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {opportunities.length === 0 ? (
              <div
                className="font-mono-feat"
                style={{ fontSize: 12, color: "var(--fg-faint)", textAlign: "center", padding: "12px 0" }}
              >
                Opportunities appear here after your first scan.
              </div>
            ) : (
              opportunities.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate(`/scan-report/${o.report_id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    background: "var(--surface-2)",
                    borderRadius: "var(--r-md, 8px)",
                    border: "1px solid var(--border-soft)",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="break-words" style={{ fontSize: 13, fontWeight: 500 }}>{o.title}</div>
                    <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                      signal from {o.competitor_name ?? "competitor"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 ${o.payoff === "high" ? "re-chip re-chip-accent" : "re-chip"}`}
                    style={{ fontSize: 10 }}
                  >
                    {o.payoff} payoff
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  delta,
  trend,
  tone = "default",
}: {
  label: string;
  value: string;
  delta: string;
  trend: Trend;
  tone?: Tone;
}) {
  const color =
    tone === "neg"
      ? "var(--neg)"
      : tone === "warn"
      ? "var(--warn)"
      : tone === "pos"
      ? "var(--pos)"
      : "var(--fg-muted)";
  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div className="re-eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <span
          className="font-mono-feat tnum"
          style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, color, fontSize: 11 }}>
        {trend === "up" && <Icon name="arrow-up" size={11} />}
        {trend === "down" && <Icon name="arrow-down" size={11} />}
        <span>{delta}</span>
      </div>
    </div>
  );
}

function MiniSpark({ seed }: { seed: string }) {
  const points = useMemo(() => {
    let s = 0;
    for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    const arr: number[] = [];
    for (let i = 0; i < 16; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      arr.push(((s >>> 8) & 0xff) / 255);
    }
    return arr;
  }, [seed]);
  const w = 72;
  const h = 22;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * w} ${h - p * (h - 2) - 1}`)
    .join(" ");
  const last = points[points.length - 1] ?? 0;
  const first = points[0] ?? 0;
  const delta = last - first;
  const color = delta > 0.1 ? "var(--neg)" : delta < -0.1 ? "var(--pos)" : "var(--fg-faint)";
  return (
    <svg width={w} height={h}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx={w} cy={h - last * (h - 2) - 1} r="2" fill={color} />
    </svg>
  );
}

function ReportCard({ report: r, onClick }: { report: ReportRow; onClick: () => void }) {
  const name = r.primary_competitor_name ?? "Untitled";
  const sentiment = r.sentiment_overall;
  const isCompleted = r.status === "completed";
  const isRunning = r.status === "running" || r.status === "queued";

  const statusColor = isCompleted
    ? "var(--pos)"
    : isRunning
    ? "#6366f1"
    : r.status === "failed"
    ? "var(--neg)"
    : "var(--fg-faint)";
  const statusLabel = isCompleted ? "Completed" : isRunning ? "Scanning…" : r.status === "failed" ? "Failed" : r.status;

  const sentimentTone =
    sentiment == null ? null : sentiment < -0.3 ? "neg" : sentiment < -0.15 ? "warn" : null;
  const sentimentColor =
    sentimentTone === "neg" ? "var(--neg)" : sentimentTone === "warn" ? "var(--warn)" : "var(--fg)";

  return (
    <div
      className="re-card"
      onClick={onClick}
      style={{ cursor: "pointer", transition: "border-color 100ms, box-shadow 100ms", width: "100%", display: "flex", flexDirection: "column" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-soft)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Header */}
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <CompetitorAvatar name={name} domain={r.primary_competitor_domain} size={36} borderRadius={8} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </div>
              <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.primary_competitor_domain ?? ""}
              </div>
            </div>
          </div>
          <span
            className="re-chip"
            style={{ fontSize: 10, color: statusColor, background: `color-mix(in srgb, ${statusColor} 12%, transparent)`, flexShrink: 0 }}
          >
            {statusLabel.toUpperCase()}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          {r.category && <span className="re-chip" style={{ fontSize: 10 }}>{r.category}</span>}
          {r.goal && <span className="re-chip" style={{ fontSize: 10 }}>{r.goal.replace(/_/g, " ")}</span>}
        </div>
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: 0 }} />

      {/* Stats */}
      <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, flex: 1 }}>
        <div>
          <div className="font-mono-feat" style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sentiment</div>
          <div className="font-mono-feat tnum" style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color: sentimentColor }}>
            {sentiment != null ? sentiment.toFixed(2) : "—"}
          </div>
        </div>
        <div>
          <div className="font-mono-feat" style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mentions</div>
          <div className="font-mono-feat tnum" style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>
            {(r.total_sources ?? 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="font-mono-feat" style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Stage</div>
          <div className="font-mono-feat tnum" style={{ fontSize: 10, fontWeight: 500, marginTop: 2, color: "var(--fg-muted)" }}>
            {r.stage ?? "—"}
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: 0 }} />

      {/* Footer */}
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="font-mono-feat" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
          last run {formatRelative(r.created_at)}
        </span>
        <button
          className="re-btn re-btn-ghost re-btn-sm re-btn-icon"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <Icon name="chev-right" size={14} />
        </button>
      </div>
    </div>
  );
}

