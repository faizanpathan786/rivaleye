import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/components/icons";
import { FounderPage } from "./founder";
import { ProductPage } from "./product";
import { MarketingPage } from "./marketing";
import { GrowthPage } from "./growth";
import { useReportSectionsQuery } from "@/hooks/queries/use-report-sections";
import { useReportQuery, useReportProgressQuery, useReportsQuery } from "@/hooks/queries/use-reports";
import { ReportInProgress } from "@/components/report/report-in-progress";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import type { EvidenceSection } from "@/lib/dashboard-helpers";
import {
  toFounderViewProps,
  type FounderViewSection,
} from "@/lib/dashboard-adapters/founder";
import {
  toProductViewProps,
  type ProductViewSection,
} from "@/lib/dashboard-adapters/product";
import {
  toMarketingViewProps,
  type MarketingViewSection,
} from "@/lib/dashboard-adapters/marketing";
import {
  toGrowthViewProps,
  type GrowthViewSection,
} from "@/lib/dashboard-adapters/growth";

// Scan Report v2 — one scan, five lenses. UI only.
// TODO(backend): replace SCAN_DATA with the scan-synthesis endpoint payload.
// TODO(backend): the unified-header `range` state is local to this component;
// embedded lens pages keep their own (now-suppressed) `range` state. When real
// data lands, lift `range` and thread it as a prop into the lens pages so the
// header control actually filters each lens.

type LensId = "summary" | "founder" | "product" | "marketing" | "growth";

interface LensMeta {
  name: string;
  color: string;
  bg: string;
  glyph: string;
  role: string;
}

const LENS_META: Record<LensId, LensMeta> = {
  summary:   { name: "Summary",   color: "#161412", bg: "rgba(20,16,12,0.05)",   glyph: "◇", role: "Executive memo · neutral" },
  founder:   { name: "Founder",   color: "#0061B1", bg: "rgba(0,97,177,0.10)",  glyph: "⊙", role: "Market opening · wedge to attack" },
  product:   { name: "Product",   color: "#6366f1", bg: "rgba(99,102,241,0.10)", glyph: "⊞", role: "Roadmap intelligence · gaps & evidence" },
  marketing: { name: "Marketing", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", glyph: "❝", role: "Positioning · copy · angles" },
  growth:    { name: "Growth",    color: "#16a34a", bg: "rgba(22,163,74,0.10)",  glyph: "↗", role: "Switch intent · live conversations" },
};

const LENS_ORDER: LensId[] = ["summary", "founder", "product", "marketing", "growth"];



interface ScanCompetitor {
  name: string;
  domain: string;
  scannedAt: string;
  sources: number;
  platforms: { id: string; name: string }[];
  sentiment: {
    overall: number;
    positive: number;
    neutral: number;
    negative: number;
    trend: string;
  };
}

interface SummaryData {
  competitor: {
    name: string;
    domain: string;
    scannedAt: string;
    sources: number;
    platforms: { id: string; name: string }[];
    sentiment: { overall: number; positive: number; neutral: number; negative: number; trend: string };
  };
  headlines: { mainThesis: string; insights: string };
  topThemes: { name: string; mentions: number; trend: string }[];
  topQuotes: { who: string; sub: string | null; when: string; score: number; sentiment: number; text: string; theme: string }[];
}

// ----------------------------------------------------------------------------

export function ScanReportPage() {
  const navigate = useNavigate();
  const { id, lens: lensParam } = useParams<{ id?: string; lens?: string }>();
  // Lens is driven by the route so each dashboard is its own deep-linkable URL.
  const lens: LensId = LENS_ORDER.includes(lensParam as LensId) ? (lensParam as LensId) : "summary";
  const [range, setRange] = useState("90d");
  const [printingAll, setPrintingAll] = useState(false);
  const meta = LENS_META[lens];

  const goToLens = (next: LensId) => {
    if (!id) return;
    navigate(`/scan-report/${id}/${next}`);
  };

  // When no :id, redirect to the most recent report (preserving the lens).
  const { data: allReports } = useReportsQuery();
  useEffect(() => {
    const first = allReports?.[0];
    if (!id && first) {
      navigate(`/scan-report/${first.id}/${lens}`, { replace: true });
    }
  }, [id, allReports, navigate, lens]);

  // Live data fetch — only when :id is present in the route.
  const { data: reportRow } = useReportQuery(id);
  const progressQuery = useReportProgressQuery(id);
  const isCompleted = reportRow?.status === "completed";
  const { data: sections, isLoading, error } = useReportSectionsQuery(isCompleted ? id : undefined);

  useEffect(() => {
    const m = document.querySelector(".main");
    if (m) m.scrollTo({ top: 0, behavior: "smooth" });
  }, [lens]);

  // Full-report PDF: once the stacked print container is mounted, fire the
  // browser print dialog, then revert so the screen view returns.
  useEffect(() => {
    if (!printingAll) return;
    const revert = () => setPrintingAll(false);
    window.addEventListener("afterprint", revert);
    const t = window.setTimeout(() => window.print(), 80);
    return () => {
      window.removeEventListener("afterprint", revert);
      window.clearTimeout(t);
    };
  }, [printingAll]);

  // "This dashboard" prints the on-screen lens; "Full report" mounts the
  // stacked container (the effect above triggers print).
  const exportThis = () => window.print();
  const exportAll = () => setPrintingAll(true);

  const onNav = (to: string) => navigate(to.startsWith("/") ? to : `/${to}`);

  // Show in-progress UI while the report pipeline is still running.
  if (id && reportRow && !isCompleted) {
    return <ReportInProgress report={reportRow} progress={progressQuery.data} />;
  }

  // When :id is present and we are still loading or errored, show a simple state.
  if (id && isLoading) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>LOADING REPORT</div>
        <div style={{ fontSize: 16 }}>Fetching report sections…</div>
      </div>
    );
  }

  // Sections fetched but all role sections are null — LLM analysis is still
  // being written. Keep showing a loading state; the refetchInterval above
  // will retry automatically every 5 seconds. If it takes >10 min, something
  // likely failed in the worker — offer to rescan.
  const hasAnySections = sections && (sections.founder ?? sections.product ?? sections.marketing ?? sections.growth ?? sections.summary);
  const minsSinceReport = reportRow && (Date.now() - new Date(reportRow.created_at).getTime()) / (1000 * 60);
  const isStuck = minsSinceReport && minsSinceReport > 10;

  if (id && sections && !hasAnySections) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
          {isStuck ? "ANALYSIS STUCK" : "GENERATING ANALYSIS"}
        </div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>
          {isStuck ? "Analysis is taking longer than expected." : "AI analysis is being written…"}
        </div>
        <div style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: isStuck ? 16 : 0 }}>
          {isStuck ? "This might indicate a worker error. Check the logs or try rescanning." : "This usually takes 30–60 seconds. The page will update automatically."}
        </div>
        {isStuck && (
          <button
            className="re-btn re-btn-sm"
            onClick={() => navigate(-1)}
            style={{ marginTop: 12 }}
          >
            Go back
          </button>
        )}
      </div>
    );
  }

  if (id && error) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--neg)" }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>ERROR</div>
        <div style={{ fontSize: 16 }}>Failed to load report. Please try again.</div>
      </div>
    );
  }

  // Run all four adapters when live sections are available.
  // Each section comes back as `unknown | null`. If null → pass `data: undefined`
  // so the lens page falls back to its built-in mock. If non-null → cast to the
  // adapter's input type via `as <Role>ViewSection` (intentional boundary cast;
  // the contract is enforced by Stage D schema, not the web layer).
  const founderProps =
    sections?.founder != null
      ? toFounderViewProps(sections.founder as FounderViewSection)
      : undefined;

  const productProps =
    sections?.product != null
      ? toProductViewProps(sections.product as ProductViewSection)
      : undefined;

  const marketingProps =
    sections?.marketing != null
      ? toMarketingViewProps(sections.marketing as MarketingViewSection)
      : undefined;

  const growthProps =
    sections?.growth != null
      ? toGrowthViewProps(sections.growth as GrowthViewSection)
      : undefined;

  const evidenceSection: EvidenceSection | null =
    sections?.evidence != null
      ? (sections.evidence as EvidenceSection)
      : null;

  const liveCompetitor: ScanCompetitor | undefined = reportRow
    ? {
        name: reportRow.primary_competitor_name ?? reportRow.competitors[0] ?? reportRow.category,
        domain: reportRow.primary_competitor_domain ?? "",
        scannedAt: reportRow.scanned_at ?? reportRow.updated_at,
        sources: reportRow.total_threads ?? reportRow.total_sources ?? 0,
        platforms: [],
        sentiment: {
          overall: reportRow.sentiment_overall ?? 0,
          positive: reportRow.sentiment_positive ?? 0,
          neutral: reportRow.sentiment_neutral ?? 0,
          negative: reportRow.sentiment_negative ?? 0,
          trend: reportRow.sentiment_trend ?? "",
        },
      }
    : undefined;

  const summaryData: SummaryData | null = sections?.summary != null ? (sections.summary as SummaryData) : null;

  const competitorData: ScanCompetitor = liveCompetitor ?? summaryData?.competitor ?? {
    name: "—", domain: "", scannedAt: "", sources: 0, platforms: [],
    sentiment: { overall: 0, positive: 0, neutral: 0, negative: 0, trend: "" },
  };

  const renderLens = (l: LensId) => {
    switch (l) {
      case "summary":
        return <ExecutiveSummary data={summaryData} competitor={competitorData} onPickLens={goToLens} />;
      case "founder":
        return <FounderPage embedded data={founderProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />;
      case "product":
        return <ProductPage embedded data={productProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />;
      case "marketing":
        return <MarketingPage embedded data={marketingProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />;
      case "growth":
        return <GrowthPage embedded data={growthProps} evidenceSection={evidenceSection} range={range} />;
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100%" }} className={printingAll ? "printing-all" : undefined}>
      <div
        className="no-print"
        style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: lens === "summary"
            ? "transparent"
            : `radial-gradient(ellipse 1200px 600px at 50% -10%, ${meta.bg} 0%, transparent 60%)`,
          transition: "background 600ms cubic-bezier(.2,.7,.2,1)",
        }}
      />

      <div className="scan-live-view" style={{ position: "relative", zIndex: 1 }}>
        <UnifiedHeader
          competitor={competitorData}
          meta={meta}
          range={range}
          setRange={setRange}
          onNav={onNav}
          onExportThis={exportThis}
          onExportAll={exportAll}
        />

        <div key={lens} className="fade-up">
          {renderLens(lens)}
        </div>

        <div style={{ height: 140 }} />
      </div>

      <LensDock active={lens} onPick={goToLens} />

      {printingAll && (
        <div className="print-all-only">
          {LENS_ORDER.map((l, i) => (
            <section key={l} className={i > 0 ? "print-page-break" : undefined}>
              <div style={{ padding: "16px 28px 0" }}>
                <div className="re-eyebrow" style={{ fontSize: 10, color: LENS_META[l].color }}>
                  {LENS_META[l].glyph} {LENS_META[l].name.toUpperCase()}{l !== "summary" ? " LENS" : ""}
                </div>
              </div>
              {renderLens(l)}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// UNIFIED HEADER

interface UnifiedHeaderProps {
  competitor: ScanCompetitor;
  meta: LensMeta;
  range: string;
  setRange: (r: string) => void;
  onNav: (to: string) => void;
  onExportThis: () => void;
  onExportAll: () => void;
}

function UnifiedHeader({ competitor: c, meta, range, setRange, onNav, onExportThis, onExportAll }: UnifiedHeaderProps) {
  return (
    <div
      className="px-4 py-4 md:px-7"
      style={{
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--glass)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        position: "sticky", top: 0, zIndex: 4,
        transition: "border-color 400ms",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0, flex: "1 1 280px" }}>
            <CompetitorAvatar name={c.name} domain={c.domain} size={52} borderRadius={12} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span className="re-eyebrow" style={{ fontSize: 10 }}>SCAN REPORT</span>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>·</span>
                <span
                  className="font-mono-feat"
                  style={{
                    fontSize: 10, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    color: meta.color, transition: "color 400ms",
                  }}
                >
                  {meta.glyph} {meta.name} lens
                </span>
              </div>
              <h1 className="re-h1 break-words" style={{ fontSize: "clamp(18px, 5vw, 24px)", marginTop: 4, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {c.name}
                <span className="font-mono-feat text-fg-faint break-all" style={{ fontSize: 12, fontWeight: 400 }}>{c.domain}</span>
                <span className="re-chip re-chip-pos" style={{ fontSize: 9 }}>FRESH</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>SCANNED {c.scannedAt}</span>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>·</span>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
                  {c.sources.toLocaleString()} mentions · {c.platforms.length} platforms
                </span>
              </div>
            </div>
          </div>

          <div className="no-print" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginRight: 4 }}>RANGE</span>
            {["30d", "90d", "1y", "all"].map((r) => (
              <button
                key={r}
                className={`re-chip ${range === r ? "re-chip-solid" : ""}`}
                style={{ cursor: "pointer", padding: "3px 10px" }}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
            <div style={{ width: 1, height: 18, background: "var(--border-soft)", margin: "0 6px" }} />
            <button className="re-btn re-btn-ghost re-btn-sm" onClick={() => onNav("/compare")}>
              <Icon name="compare" size={14} /> Compare
            </button>
            <ExportMenu onExportThis={onExportThis} onExportAll={onExportAll} lensName={meta.name} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// EXPORT MENU — browser print-to-PDF, single dashboard or full report

function ExportMenu({
  onExportThis,
  onExportAll,
  lensName,
}: {
  onExportThis: () => void;
  onExportAll: () => void;
  lensName: string;
}) {
  const [open, setOpen] = useState(false);

  const choose = (fn: () => void) => {
    setOpen(false);
    // Defer so the menu unmounts before the print dialog blocks the thread.
    setTimeout(fn, 0);
  };

  return (
    <div style={{ position: "relative" }}>
      <button className="re-btn re-btn-ghost re-btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name="download" size={14} /> Export
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="w-[220px] max-w-[calc(100vw-24px)]"
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
              padding: 5,
              background: "var(--surface-solid)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-lg, 0 16px 40px rgba(0,0,0,0.18))",
            }}
          >
            <button className="re-menu-item" style={exportItemStyle} onClick={() => choose(onExportThis)}>
              <Icon name="download" size={13} />
              <span>Export <b>{lensName}</b> dashboard</span>
            </button>
            <button className="re-menu-item" style={exportItemStyle} onClick={() => choose(onExportAll)}>
              <Icon name="download" size={13} />
              <span>Export full report (all dashboards)</span>
            </button>
            <div style={{ padding: "6px 10px 2px", fontSize: 10 }} className="font-mono-feat text-fg-faint">
              Opens your browser print dialog · choose “Save as PDF”
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const exportItemStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 9,
  width: "100%", padding: "8px 10px",
  border: 0, background: "transparent", cursor: "pointer",
  textAlign: "left", fontSize: 13, color: "var(--fg)",
  borderRadius: "var(--r-sm, 6px)",
};

// ----------------------------------------------------------------------------
// EXECUTIVE SUMMARY

function ExecutiveSummary({
  data,
  competitor,
  onPickLens,
}: {
  data: SummaryData | null;
  competitor: ScanCompetitor;
  onPickLens: (id: LensId) => void;
}) {
  if (!data) {
    return (
      <div className="px-4 py-8 md:px-7" style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 0 }}>
        <div className="re-card" style={{ padding: 32, textAlign: "center", color: "var(--fg-muted)" }}>
          <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>SUMMARY</div>
          <div style={{ fontSize: 16 }}>Generating executive summary…</div>
          <div style={{ fontSize: 13, marginTop: 8, color: "var(--fg-faint)" }}>Switch to a lens below while synthesis completes.</div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>PICK A LENS</div>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
            {(["founder", "product", "marketing", "growth"] as const).map((id) => (
              <LensPreviewCard key={id} id={id} onPick={onPickLens} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const c = data.competitor;
  const lensColors = ["#ff5c1a", "#6366f1", "#8b5cf6"];

  return (
    <div className="px-4 py-8 md:px-7" style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 0 }}>
      <PerceptionHero data={data} />

      <div style={{ marginTop: 28 }}>
        <div className="re-eyebrow" style={{ fontSize: 10 }}>EXECUTIVE MEMO</div>
        <h2 className="re-h2" style={{ fontSize: "clamp(20px, 5vw, 28px)", marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1.2, maxWidth: 920 }}>
          {data.headlines.mainThesis}
        </h2>
        <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: 920 }}>
          {data.headlines.insights}
        </p>
        <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: 920 }}>
          Switch a lens below to read the same evidence through a specific role — founder strategy, product
          roadmap, marketing copy, or growth conversations.
        </p>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>PICK A LENS</div>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
          {(["founder", "product", "marketing", "growth"] as const).map((id) => (
            <LensPreviewCard key={id} id={id} onPick={onPickLens} />
          ))}
        </div>
      </div>

      {data.topQuotes.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="re-eyebrow" style={{ fontSize: 10 }}>TOP QUOTES</div>
              <h3 className="re-h2" style={{ fontSize: 18, marginTop: 6 }}>Top of mind, top of thread</h3>
            </div>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>cross-cutting · all lenses anchor here</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
            {data.topQuotes.slice(0, 3).map((q, i) => (
              <AnchorQuote key={i} q={q} color={lensColors[i] ?? "#8b5cf6"} />
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 32, padding: "22px 24px",
          background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-soft)",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 24,
        }}
      >
        <SummaryStat
          label="Sentiment index"
          value={c.sentiment.overall.toFixed(2)}
          tone={c.sentiment.overall < -0.1 ? "neg" : c.sentiment.overall > 0.1 ? "pos" : undefined}
          sub={c.sentiment.trend}
        />
        <SummaryStat label="Mentions" value={c.sources.toLocaleString()} sub={`${c.platforms.length} platforms`} />
        {data.topThemes.map((t) => (
          <SummaryStat key={t.name} label={t.name} value={String(t.mentions)} tone="warn" sub={t.trend} />
        ))}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone, sub }: { label: string; value: string; tone?: "neg" | "pos" | "warn"; sub: string }) {
  const color =
    tone === "neg" ? "var(--neg)" : tone === "pos" ? "var(--pos)" : tone === "warn" ? "var(--warn)" : "var(--fg)";
  return (
    <div>
      <div className="re-eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="font-mono-feat tnum" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 4, color }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// PERCEPTION HERO

function PerceptionHero({ data }: { data: SummaryData }) {
  const s = data.competitor.sentiment;
  const topTheme = data.topThemes[0];
  const sentimentLabel =
    s.overall < -0.2 ? "Negative-leaning" : s.overall > 0.2 ? "Positive-leaning" : "Mixed sentiment";
  return (
    <div className="re-card re-card-elev" style={{ overflow: "hidden", position: "relative" }}>
      <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />
      <div
        className="grid grid-cols-1 md:grid-cols-[auto_1fr] place-items-center md:place-items-stretch md:items-center"
        style={{
          position: "relative", padding: 24, gap: 28,
        }}
      >
        <PerceptionRing positive={s.positive} neutral={s.neutral} negative={s.negative} index={s.overall} />

        <div style={{ minWidth: 0 }}>
          <div className="re-eyebrow" style={{ fontSize: 10 }}>
            WHAT USERS THINK OF {data.competitor.name.toUpperCase()}
          </div>
          <h2 className="re-h2" style={{ fontSize: "clamp(20px, 5vw, 26px)", marginTop: 6, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {sentimentLabel}
            {topTheme ? <>, with the loudest theme being <span style={{ color: "var(--accent)" }}>{topTheme.name.toLowerCase()}</span>.</> : "."}
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ marginTop: 18, gap: 14 }}>
            {(["founder", "product", "marketing", "growth"] as const).map((id) => {
              const m = LENS_META[id];
              return (
                <div
                  key={id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-solid)",
                    borderTop: `2px solid ${m.color}`,
                  }}
                >
                  <div
                    className="font-mono-feat"
                    style={{ fontSize: 9, color: m.color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
                  >
                    {m.glyph} {m.name}
                  </div>
                  <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginTop: 6 }}>
                    {m.role.split("·")[0]?.trim()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerceptionRing({ positive, neutral, negative, index }: { positive: number; neutral: number; negative: number; index: number }) {
  const r = 76;
  const circ = 2 * Math.PI * r;
  const total = positive + neutral + negative || 1;
  const negLen = (negative / total) * circ;
  const neuLen = (neutral / total) * circ;
  const posLen = (positive / total) * circ;

  return (
    <div style={{ position: "relative", width: "min(200px, 60vw)", aspectRatio: "1 / 1", maxWidth: 200 }}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" style={{ display: "block", transform: "rotate(-90deg)" }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(20,16,12,0.06)" strokeWidth="16" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--neg)" strokeWidth="16"
          strokeDasharray={`${negLen} ${circ}`} strokeDashoffset={0} strokeLinecap="butt" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="#d1ccc2" strokeWidth="16"
          strokeDasharray={`${neuLen} ${circ}`} strokeDashoffset={-negLen} strokeLinecap="butt" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--pos)" strokeWidth="16"
          strokeDasharray={`${posLen} ${circ}`} strokeDashoffset={-(negLen + neuLen)} strokeLinecap="butt" />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
      >
        <div className="font-mono-feat text-fg-faint" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          PERCEPTION
        </div>
        <div
          className="font-mono-feat tnum"
          style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.03em", marginTop: 2, color: "var(--neg)" }}
        >
          {index.toFixed(2)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9 }}>
          <span style={{ color: "var(--pos)" }}>+{Math.round(positive * 100)}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-faint">{Math.round(neutral * 100)}</span>
          <span className="text-fg-faint">·</span>
          <span style={{ color: "var(--neg)" }}>−{Math.round(negative * 100)}</span>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LENS PREVIEW CARD

function LensPreviewCard({ id, onPick }: { id: Exclude<LensId, "summary">; onPick: (id: LensId) => void }) {
  const m = LENS_META[id];
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={() => onPick(id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? m.color + "55" : "var(--border-soft)"}`,
        borderRadius: "var(--r-lg)",
        background: hover ? `linear-gradient(135deg, ${m.bg}, transparent 70%)` : "var(--surface)",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        overflow: "hidden",
        transition: "border-color 200ms, background 200ms, transform 200ms",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hover ? `0 12px 32px ${m.bg}` : "var(--shadow-sm)",
        position: "relative",
      }}
    >
      <div style={{ height: 3, background: m.color }} />

      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
        <div>
          <div
            className="font-mono-feat"
            style={{ fontSize: 10, color: m.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}
          >
            {m.glyph} {m.name.toUpperCase()} LENS
          </div>
          <div className="text-fg-muted" style={{ marginTop: 6, fontSize: 13 }}>{m.role}</div>
        </div>

        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 12px",
            background: hover ? m.color : "var(--surface-solid)",
            color: hover ? "#fff" : m.color,
            border: `1px solid ${hover ? m.color : m.color + "55"}`,
            borderRadius: 99,
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.04em",
            transition: "all 200ms",
            whiteSpace: "nowrap",
          }}
        >
          Enter {m.name} <Icon name="arrow-right" size={11} />
        </span>
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// ANCHOR QUOTE

function AnchorQuote({ q, color }: { q: SummaryData["topQuotes"][number]; color: string }) {
  return (
    <div className="re-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, borderTop: `2px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          className="font-mono-feat"
          style={{ fontSize: 10, color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
        >
          {q.theme ? `THEME · ${q.theme.toUpperCase()}` : "QUOTE"}
        </span>
        {q.score > 0 && <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>{q.score}↑</span>}
      </div>
      <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", lineHeight: 1.55, color: "var(--fg)" }}>
        "{q.text}"
      </p>
      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
        {q.who}{q.sub ? ` · ${q.sub}` : ""}{q.when ? ` · ${q.when}` : ""}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LENS DOCK

function LensDock({ active, onPick }: { active: LensId; onPick: (id: LensId) => void }) {
  const order: LensId[] = ["summary", "founder", "product", "marketing", "growth"];
  const [hovered, setHovered] = useState<LensId | null>(null);

  return (
    <div
      className="no-print max-w-[calc(100vw-24px)] overflow-x-auto"
      style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 40,
        padding: 5,
        background: "rgba(20,16,12,0.86)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 99,
        boxShadow: "0 24px 60px rgba(0,0,0,0.30), 0 4px 12px rgba(0,0,0,0.20), 0 0 0 1px rgba(255,255,255,0.04) inset",
        display: "flex", gap: 2, alignItems: "center",
      }}
    >
      {order.map((id) => {
        const m = LENS_META[id];
        const isActive = active === id;
        const isHov = hovered === id;
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            aria-pressed={isActive}
            className="px-3 py-2 sm:px-3.5 shrink-0"
            style={{
              border: 0,
              borderRadius: 99,
              cursor: "pointer",
              background: isActive ? m.color : isHov ? "rgba(255,255,255,0.08)" : "transparent",
              color: isActive ? "#fff" : "rgba(255,255,255,0.78)",
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              transition: "background 200ms, color 200ms, transform 120ms",
              transform: isActive ? "scale(1.0)" : "scale(0.98)",
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: 99,
                background: isActive ? "#fff" : m.color,
                boxShadow: isActive ? "0 0 0 3px rgba(255,255,255,0.15)" : "none",
                transition: "box-shadow 200ms",
              }}
            />
            {m.name}
            {isActive && id !== "summary" && (
              <span style={{ fontSize: 9, opacity: 0.8, marginLeft: -3, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                LENS
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
