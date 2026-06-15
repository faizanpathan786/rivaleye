import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Icon, type IconName } from "@/components/icons";
import { useRadarEventsQuery } from "@/hooks/queries/use-radar";
import { useCompetitorsQuery } from "@/hooks/queries/use-competitors";
import type { RadarEvent, RadarSeverity } from "@/api/radar";
import type { Competitor } from "@/api/competitors";
import { formatRelative } from "@/lib/format";
import { CompetitorAvatar } from "@/components/competitor-avatar";

type Severity = "urgent" | "high" | "med" | "low";

interface SeverityMeta {
  color: string;
  bg: string;
  border: string;
  label: string;
}

const SEVERITY: Record<Severity, SeverityMeta> = {
  urgent: { color: "var(--neg)", bg: "rgba(220,38,38,0.08)", border: "rgba(220,38,38,0.25)", label: "URGENT" },
  high: { color: "var(--warn)", bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.25)", label: "HIGH" },
  med: { color: "#6366f1", bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.25)", label: "MED" },
  low: { color: "var(--fg-muted)", bg: "var(--surface-2)", border: "var(--border-soft)", label: "LOW" },
};

const EVENT_TYPE_META: Record<string, { label: string; icon: IconName }> = {
  "feature-leak": { label: "Feature leak", icon: "alert" },
  "feature-launch": { label: "Feature launch", icon: "spark" },
  "demo-video": { label: "Demo video", icon: "external" },
  "pricing-change": { label: "Pricing change", icon: "trend-up" },
  "exec-post": { label: "Exec post", icon: "user" },
  "viral-complaint": { label: "Viral complaint", icon: "quote" },
  launch: { label: "Public launch", icon: "spark" },
  "review-spike": { label: "Review spike", icon: "trend-up" },
  hire: { label: "Notable hire", icon: "user" },
};

function PlatformIcon({ id }: { id: string }) {
  const initial = id.charAt(0).toUpperCase();
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        background: "var(--surface-2)",
        border: "1px solid var(--border-soft)",
        display: "inline-grid",
        placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 600,
        color: "var(--fg-muted)",
      }}
    >
      {initial}
    </span>
  );
}

export function RadarPage() {
  const navigate = useNavigate();

  const [filterSev, setFilterSev] = useState<"all" | Severity>("all");
  const [filterComp, setFilterComp] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const competitorsQuery = useCompetitorsQuery();
  const eventsQuery = useRadarEventsQuery({
    ...(filterSev !== "all" ? { severity: filterSev as RadarSeverity } : {}),
    ...(filterComp !== "all" ? { competitor_id: filterComp } : {}),
  });

  const competitors = competitorsQuery.data ?? [];
  const competitorById = useMemo(() => {
    const map = new Map<string, Competitor>();
    for (const c of competitors) map.set(c.id, c);
    return map;
  }, [competitors]);

  const allEvents = eventsQuery.data ?? [];
  const events = useMemo(() => {
    return allEvents.filter((ev) => {
      if (filterType !== "all" && ev.type !== filterType) return false;
      if (search && !ev.title.toLowerCase().includes(search.toLowerCase()) &&
          !(ev.snippet?.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [allEvents, filterType, search]);

  const urgentCount = allEvents.filter((e) => e.severity === "urgent").length;
  const highCount = allEvents.filter((e) => e.severity === "high").length;
  const activeMonitors = competitors.filter((c) => c.monitor_enabled).length;

  const platformCounts = allEvents.reduce<Record<string, number>>((a, ev) => {
    a[ev.platform] = (a[ev.platform] || 0) + 1;
    return a;
  }, {});

  const digest = useMemo(() => {
    if (allEvents.length === 0) return null;
    const urgent = allEvents.filter((e) => e.severity === "urgent");
    const high = allEvents.filter((e) => e.severity === "high");
    const priority = urgent.length > 0 ? urgent : high.length > 0 ? high : allEvents;

    const nameOf = (e: RadarEvent) =>
      e.competitor_name ?? competitorById.get(e.competitor_id)?.name ?? "a competitor";

    const byComp = new Map<string, number>();
    for (const e of priority) {
      const n = nameOf(e);
      byComp.set(n, (byComp.get(n) ?? 0) + 1);
    }
    const topComp = [...byComp.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const typeLabels = [
      ...new Set(
        priority
          .slice(0, 3)
          .map((e) => (EVENT_TYPE_META[e.type]?.label ?? e.type).toLowerCase()),
      ),
    ];

    return {
      count: priority.length,
      severityWord: urgent.length > 0 ? "urgent" : high.length > 0 ? "high-priority" : "",
      topComp,
      onlyOneComp: byComp.size === 1,
      typeLabels,
    };
  }, [allEvents, competitorById]);

  const isLoading = eventsQuery.isLoading || competitorsQuery.isLoading;
  const error = eventsQuery.error ?? competitorsQuery.error;

  return (
    <div className="px-4 py-5 pb-14 md:px-7 md:pb-16" style={{ maxWidth: 1440, margin: "0 auto" }}>
      {/* Hero */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" style={{ marginBottom: 20 }}>
        <div className="min-w-0">
          <div className="re-eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="re-dot re-dot-live pulse-dot" /> RADAR · LIVE
          </div>
          <h1 className="re-h1 break-words" style={{ marginTop: 8 }}>What your competitors are doing right now</h1>
          <p className="text-fg-muted" style={{ marginTop: 6, maxWidth: 600, fontSize: 13, lineHeight: 1.55 }}>
            We monitor LinkedIn, X, YouTube, Product Hunt, blogs, changelogs, Reddit, and G2 for every
            tracked competitor. Anything they ship, leak, or stumble over — you see it first.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:flex-shrink-0">
          <button className="re-btn" onClick={() => eventsQuery.refetch()}>
            <Icon name="refresh" size={14} /> Sweep now
          </button>
          <button className="re-btn" onClick={() => toast.info("Alert rules coming soon")}>
            <Icon name="settings" size={14} /> Alert rules
          </button>
          <button className="re-btn re-btn-accent" onClick={() => navigate("/competitors")}>
            <Icon name="plus" size={14} /> Track competitor
          </button>
        </div>
      </div>

      {/* Stat strip — hidden when there are no competitors and no events yet */}
      {competitors.length === 0 && allEvents.length === 0 ? (
        <div
          style={{
            padding: "20px 0",
            textAlign: "center",
            color: "var(--fg-muted)",
            fontSize: 13,
            lineHeight: 1.55,
            marginBottom: 20,
          }}
        >
          Radar monitoring shows competitor moves detected across the web. Add competitors or run a scan to activate it.{" "}
          <button
            className="re-btn re-btn-ghost re-btn-sm"
            style={{ display: "inline", padding: "0 4px", fontSize: 13 }}
            onClick={() => navigate("/scan")}
          >
            Run a scan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 12, marginBottom: 20 }}>
          <RadarStat label="Active monitors" value={activeMonitors} sub={`of ${competitors.length} competitors`} />
          <RadarStat label="Events this week" value={allEvents.length} sub="across all sources" trend="up" />
          <RadarStat label="Urgent" value={urgentCount} tone="neg" sub="needs response today" />
          <RadarStat label="High priority" value={highCount} tone="warn" sub="watch this week" />
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginRight: 4 }}>
            SEVERITY
          </span>
          {(["all", "urgent", "high", "med", "low"] as const).map((k) => (
            <button
              key={k}
              className={`re-chip ${filterSev === k ? "re-chip-solid" : ""}`}
              style={{ cursor: "pointer", padding: "3px 10px" }}
              onClick={() => setFilterSev(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border-soft)" }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginRight: 4 }}>
            COMPETITOR
          </span>
          <button
            className={`re-chip ${filterComp === "all" ? "re-chip-solid" : ""}`}
            style={{ cursor: "pointer", padding: "3px 10px" }}
            onClick={() => setFilterComp("all")}
          >
            all
          </button>
          {competitors
            .filter((c) => c.monitor_enabled)
            .slice(0, 5)
            .map((c) => (
              <button
                key={c.id}
                className={`re-chip ${filterComp === c.id ? "re-chip-solid" : ""}`}
                style={{ cursor: "pointer", padding: "3px 10px" }}
                onClick={() => setFilterComp(c.id === filterComp ? "all" : c.id)}
              >
                {c.name}
              </button>
            ))}
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border-soft)" }} />
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginRight: 4 }}>
            TYPE
          </span>
          <button
            className={`re-chip ${filterType === "all" ? "re-chip-solid" : ""}`}
            style={{ cursor: "pointer", padding: "3px 10px", fontSize: 11 }}
            onClick={() => setFilterType("all")}
          >
            all
          </button>
          {Object.entries(EVENT_TYPE_META)
            .slice(0, 4)
            .map(([type, meta]) => (
              <button
                key={type}
                className={`re-chip ${filterType === type ? "re-chip-solid" : ""}`}
                style={{ cursor: "pointer", padding: "3px 10px", fontSize: 11 }}
                onClick={() => setFilterType(filterType === type ? "all" : type)}
              >
                {meta.label}
              </button>
            ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-soft)",
              background: "var(--surface-solid)",
              color: "var(--fg)",
              fontSize: 12,
              width: 140,
              outline: "none",
            }}
          />
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            {events.length} events
          </span>
        </div>
      </div>

      {/* Timeline + rail */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]" style={{ gap: 16 }}>
        <div className="re-card" style={{ overflow: "hidden" }}>
          {isLoading && (
            <div style={{ padding: 0 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: "18px 20px",
                    borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div style={{ width: 70, height: 32, background: "var(--surface-2)", borderRadius: 4 }} />
                  <div style={{ width: 28, height: 28, background: "var(--surface-2)", borderRadius: 6 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 10, width: "30%", background: "var(--surface-2)", borderRadius: 4 }} />
                    <div style={{ height: 14, width: "70%", background: "var(--surface-2)", borderRadius: 4 }} />
                    <div style={{ height: 10, width: "50%", background: "var(--surface-2)", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!isLoading && error && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--neg)" }}>
              Failed to load events. {error instanceof Error ? error.message : "Please try again."}
            </div>
          )}
          {!isLoading && !error && events.length === 0 && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--fg-muted)" }}>
              No events match. Try clearing filters.
            </div>
          )}
          {!isLoading && !error && events.map((ev, i) => (
            <RadarEventRow
              key={ev.id}
              event={ev}
              competitor={competitorById.get(ev.competitor_id)}
              first={i === 0}
            />
          ))}
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="re-card">
            <div className="re-card-hd">
              <h3>Alert digest</h3>
              <span className="text-fg-faint" style={{ fontSize: 11 }}>today</span>
            </div>
            <div style={{ padding: 14 }}>
              {digest ? (
                <>
                  <p className="text-fg-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
                    {digest.count}{" "}
                    {digest.severityWord ? `${digest.severityWord} ` : ""}
                    move{digest.count === 1 ? "" : "s"} detected
                    {digest.topComp ? (
                      <>
                        {digest.onlyOneComp ? ", all from " : ", led by "}
                        <b style={{ color: "var(--fg)" }}>{digest.topComp}</b>
                      </>
                    ) : null}
                    {digest.typeLabels.length > 0
                      ? ` — ${digest.typeLabels.join(", ")}.`
                      : "."}
                  </p>
                  <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      className="re-btn re-btn-sm"
                      onClick={() => toast.info("Slack integration coming soon")}
                    >
                      <Icon name="share" size={12} /> Slack team
                    </button>
                    <button
                      className="re-btn re-btn-sm"
                      style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }}
                      onClick={() => {
                        const summary = `📊 Radar Brief\n\n${digest.count} ${digest.severityWord || "new"} moves detected${digest.topComp ? ` from ${digest.topComp}` : ""}.\n\nTypes: ${digest.typeLabels.join(", ") || "various"}`;
                        navigator.clipboard.writeText(summary);
                        toast.success("Brief copied to clipboard");
                      }}
                    >
                      <Icon name="quote" size={12} /> Copy brief
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-fg-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
                  No competitor moves detected yet. Track competitors or run a scan to start populating your radar.
                </p>
              )}
            </div>
          </div>

          <div className="re-card">
            <div className="re-card-hd">
              <h3>By platform</h3>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(platformCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([p, count]) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <PlatformIcon id={p} />
                    <span style={{ flex: 1, fontSize: 12, textTransform: "capitalize" }}>{p}</span>
                    <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
                      {count}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="re-card">
            <div className="re-card-hd">
              <h3>Recently active</h3>
            </div>
            <div style={{ padding: "8px 0" }}>
              {competitors
                .filter((c) => c.monitor_enabled)
                .slice(0, 5)
                .map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "8px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <CompetitorAvatar name={c.name} domain={c.website ?? undefined} size={22} borderRadius={5} color={c.color ?? undefined} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>
                        {formatRelative(c.last_activity_at)}
                      </div>
                    </div>
                    <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
                      {c.stat_alerts_7d}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RadarStatProps {
  label: string;
  value: number;
  sub: string;
  tone?: "neg" | "warn";
  trend?: "up";
}

function RadarStat({ label, value, sub, tone, trend }: RadarStatProps) {
  const color = tone === "neg" ? "var(--neg)" : tone === "warn" ? "var(--warn)" : "var(--fg)";
  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div className="re-eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span
          className="font-mono-feat tnum"
          style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color }}
        >
          {value}
        </span>
        {trend === "up" && <Icon name="arrow-up" size={11} className="text-fg-faint" />}
      </div>
      <div className="text-fg-muted" style={{ fontSize: 11, marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}

interface RadarEventRowProps {
  event: RadarEvent;
  competitor: Competitor | undefined;
  first: boolean;
}

function RadarEventRow({ event: ev, competitor, first }: RadarEventRowProps) {
  const sev = SEVERITY[ev.severity as Severity] ?? SEVERITY.low;
  const meta = EVENT_TYPE_META[ev.type] ?? { label: ev.type, icon: "spark" as IconName };
  const [expanded, setExpanded] = useState<boolean>(ev.severity === "urgent" && first);

  const baseBg = ev.severity === "urgent" ? "rgba(220,38,38,0.02)" : "transparent";

  const rowStyle: CSSProperties = {
    gap: 14,
    borderTop: first ? 0 : "1px solid var(--border-soft)",
    cursor: "pointer",
    position: "relative",
    background: baseBg,
  };

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="grid grid-cols-[56px_1fr_18px] px-4 py-4 md:grid-cols-[70px_28px_1fr_90px_18px] md:px-5 md:py-[18px]"
      style={rowStyle}
      onMouseEnter={(e) => {
        if (!expanded) e.currentTarget.style.background = "var(--surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!expanded) e.currentTarget.style.background = baseBg;
      }}
    >
      {/* Severity + time */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
        <span
          className="re-chip"
          style={{
            background: sev.bg,
            color: sev.color,
            borderColor: sev.border,
            fontSize: 9,
            padding: "2px 6px",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {sev.label}
        </span>
        <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>
          {formatRelative(ev.detected_at)}
        </span>
      </div>

      {/* Competitor logo */}
      <div
        className="hidden md:grid"
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: competitor?.color ?? "#666",
          color: "#fff",
          placeItems: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {competitor?.name[0] ?? "?"}
      </div>

      {/* Main */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
            {competitor?.name ?? "?"}
          </span>
          <span className="font-mono-feat text-fg-faint">·</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--fg-muted)",
            }}
          >
            <PlatformIcon id={ev.platform} />
            <span style={{ textTransform: "capitalize" }}>{ev.platform}</span>
          </span>
          <span className="font-mono-feat text-fg-faint">·</span>
          <span
            className="re-chip"
            style={{
              fontSize: 10,
              color: sev.color,
              background: sev.bg,
              borderColor: sev.border,
              padding: "1px 8px",
            }}
          >
            <Icon name={meta.icon} size={10} /> {meta.label}
          </span>
          {ev.confidence < 0.9 && (
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>
              · {Math.round(ev.confidence * 100)}% confidence
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: "-0.005em" }}>
          {ev.title}
        </div>
        {!expanded && ev.snippet && (
          <div
            className="text-fg-muted"
            style={{
              fontSize: 12.5,
              marginTop: 6,
              lineHeight: 1.5,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
            }}
          >
            {ev.snippet}
          </div>
        )}
        {expanded && (
          <div className="fade-up" style={{ marginTop: 10 }}>
            <div
              style={{
                padding: 12,
                background: "var(--surface-2)",
                borderRadius: 8,
                borderLeft: `2px solid ${sev.color}`,
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--fg)",
              }}
            >
              {ev.snippet}
              {ev.who && (
                <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginTop: 8 }}>
                  — {ev.who}
                  {ev.role ? ` · ${ev.role}` : ""}
                </div>
              )}
            </div>
            {ev.impact && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  background:
                    ev.severity === "urgent" ? "rgba(220,38,38,0.05)" : "var(--accent-soft)",
                  borderRadius: 8,
                  fontSize: 12.5,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Icon name="spark" size={14} style={{ color: sev.color, marginTop: 2 }} />
                <div>
                  <span
                    className="font-mono-feat"
                    style={{
                      fontSize: 9,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: sev.color,
                      fontWeight: 600,
                    }}
                  >
                    WHY IT MATTERS
                  </span>
                  <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{ev.impact}</div>
                </div>
              </div>
            )}
            <div className="flex-wrap" style={{ display: "flex", gap: 6, marginTop: 12 }}>
              <button
                className="re-btn re-btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (ev.url) window.open(ev.url, "_blank");
                }}
              >
                <Icon name="external" size={12} /> Open source
              </button>
              <button
                className="re-btn re-btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(ev.title + (ev.snippet ? "\n\n" + ev.snippet : ""));
                  toast.success("Event copied to clipboard");
                }}
              >
                <Icon name="share" size={12} /> Copy event
              </button>
              <button
                className="re-btn re-btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.success("Marked as handled");
                }}
              >
                <Icon name="check" size={12} /> Mark handled
              </button>
              <button
                className="re-btn re-btn-ghost re-btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  toast.info("Snoozed for 24 hours");
                }}
                style={{ marginLeft: "auto" }}
              >
                Snooze
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confidence */}
      <div className="hidden md:flex" style={{ flexDirection: "column", justifyContent: "center", gap: 4 }}>
        <span
          className="font-mono-feat text-fg-faint"
          style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}
        >
          Conf
        </span>
        <span
          className="font-mono-feat tnum"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color:
              ev.confidence > 0.9
                ? "var(--pos)"
                : ev.confidence > 0.75
                ? "var(--warn)"
                : "var(--fg-muted)",
          }}
        >
          {Math.round(ev.confidence * 100)}%
        </span>
      </div>

      {/* Chevron */}
      <div style={{ display: "flex", alignItems: "center", color: "var(--fg-faint)" }}>
        <Icon name={expanded ? "chev-down" : "chev-right"} size={14} />
      </div>
    </div>
  );
}
