import { useMemo, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Crosshair, Megaphone, Layers, TrendingUp, Zap } from "lucide-react";
import { Icon } from "@/components/icons";
import { formatRelative } from "@/lib/format";
import { useAddPlannedActionMutation } from "@/hooks/queries/use-planned-actions";
import { FounderPage } from "./founder";
import { ProductPage } from "./product";
import { MarketingPage } from "./marketing";
import { GrowthPage } from "./growth";
import {
  ComplaintsCard,
  VoiceTab,
  PricingTab,
  SwitchingTab,
  QuotesCard,
  LeadsCard,
  PositioningCard,
  OpportunitiesCard,
  ActionsCard,
} from "./report";
import { useReportSectionsQuery } from "@/hooks/queries/use-report-sections";
import {
  useReportQuery,
  useReportProgressQuery,
  useReportsQuery,
  useReportComplaintsQuery,
  useReportVoiceQuery,
  useReportPricingQuery,
  useReportSwitchingQuery,
  useReportQuotesQuery,
  useReportLeadsQuery,
  useReportPositioningQuery,
  useReportOpportunitiesQuery,
  useReportActionsQuery,
  useReportPlatformsQuery,
  useReportSentimentSeriesQuery,
  useReportFeatureGapsQuery,
  useRetrySynthesisMutation,
} from "@/hooks/queries/use-reports";
import { ReportInProgress } from "@/components/report/report-in-progress";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import type {
  Complaint,
  VoiceResponse,
  PricingResponse,
  SwitchingResponse,
  QuoteRow,
  LeadRow,
  Positioning,
  Opportunity,
  ActionRow,
  PlatformStat,
  FeatureGap,
} from "@/api/reports";
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

// The pipeline stores each evidence quote's text under the key `quote`, but the
// EvidenceDrawer reads `text`. Normalize the shape (and tolerate either key) so
// quotes render instead of showing empty.
function normalizeEvidenceSection(raw: unknown): EvidenceSection | null {
  if (raw == null || typeof raw !== "object") return null;
  const quotes = (raw as { quotes?: unknown[] }).quotes;
  if (!Array.isArray(quotes)) return { quotes: [] };
  return {
    quotes: quotes.map((q) => {
      const obj = (q ?? {}) as Record<string, unknown>;
      return {
        id: String(obj.id ?? ""),
        text: String(obj.text ?? obj.quote ?? ""),
        source: String(obj.source ?? ""),
        author: (obj.author_or_context as string | null) ?? (obj.author as string | null) ?? null,
        source_url: (obj.source_url as string | null) ?? null,
        sentiment: typeof obj.sentiment === "number" ? obj.sentiment : null,
        signal_type: (obj.signal_type as EvidenceSection["quotes"][number]["signal_type"]) ?? null,
      };
    }),
  };
}

// Scan Report v2 — one scan, five lenses. UI only.
// TODO(backend): replace SCAN_DATA with the scan-synthesis endpoint payload.
// TODO(backend): the unified-header `range` state is local to this component;
// embedded lens pages keep their own (now-suppressed) `range` state. When real
// data lands, lift `range` and thread it as a prop into the lens pages so the
// header control actually filters each lens.

type LensId = "summary" | "founder" | "product" | "marketing" | "growth" | "pain";

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
  pain:      { name: "Pain & Opps", color: "#dc2626", bg: "rgba(220,38,38,0.08)", glyph: "⚡", role: "Complaints · opportunities to win" },
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
  platformBreakdown?: Array<{ id: string; name: string; posts: number; sentiment: number; contexts: string[] }>;
  intelligence?: { brief: string | null; summary: string | null };
}

// ----------------------------------------------------------------------------

export function ScanReportPage() {
  const navigate = useNavigate();
  const { id, lens: lensParam } = useParams<{ id?: string; lens?: string }>();
  // Lens is driven by the route so each dashboard is its own deep-linkable URL.
  const ALL_LENSES = [...LENS_ORDER, "pain"] as LensId[];
  const lens: LensId = ALL_LENSES.includes(lensParam as LensId) ? (lensParam as LensId) : "summary";
  const [range, setRange] = useState("90d");
  const [printingAll, setPrintingAll] = useState(false);
  const meta = LENS_META[lens];

  const goToLens = (next: LensId) => {
    const reportId = id || window.location.pathname.split("/")[3];
    if (!reportId) return;
    navigate(`/scan-report/${reportId}/${next}`);
  };

  // When no :id, redirect to the most recent report (preserving the lens).
  const { data: allReports } = useReportsQuery();
  useEffect(() => {
    const first = allReports?.[0];
    if (!id && first) {
      navigate(`/scan-report/${first.id}/${lens}`, { replace: true });
    }
  }, [id, lens, navigate]);

  // Live data fetch — only when :id is present in the route.
  const reportQuery = useReportQuery(id);
  const reportRow = reportQuery.data;
  const reportIsLoading = reportQuery.isLoading;
  const progressQuery = useReportProgressQuery(id);
  const isCompleted = reportRow?.status === "completed" || reportRow?.stage === "done";
  const { data: sections, isLoading, error } = useReportSectionsQuery(isCompleted ? id : undefined);

  // Fetch all report sections for Summary tabs
  const complaints = useReportComplaintsQuery(isCompleted ? id : undefined).data ?? [];
  const voice = useReportVoiceQuery(isCompleted ? id : undefined).data;
  const pricing = useReportPricingQuery(isCompleted ? id : undefined).data;
  const switching = useReportSwitchingQuery(isCompleted ? id : undefined).data;
  const quotes = useReportQuotesQuery(isCompleted ? id : undefined).data ?? [];
  const leads = useReportLeadsQuery(isCompleted ? id : undefined).data ?? [];
  const positioning = useReportPositioningQuery(isCompleted ? id : undefined).data ?? [];
  const opportunities = useReportOpportunitiesQuery(isCompleted ? id : undefined).data ?? [];
  const actions = useReportActionsQuery(isCompleted ? id : undefined).data ?? [];
  const platforms = useReportPlatformsQuery(isCompleted ? id : undefined).data ?? [];
  const sentimentSeries = useReportSentimentSeriesQuery(isCompleted ? id : undefined).data ?? [];
  const featureGaps = useReportFeatureGapsQuery(isCompleted ? id : undefined).data ?? [];

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

  // Show cancelled state if scan was cancelled
  if (id && reportRow?.status === "cancelled") {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>SCAN CANCELLED</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>This scan was cancelled</div>
        <div style={{ fontSize: 13, marginBottom: 24 }}>You can start a new scan anytime</div>
        <button
          className="re-btn"
          onClick={() => navigate("/")}
          style={{ marginRight: 8 }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // Show a neutral placeholder while either the report row OR sections are loading.
  // Without this guard, a cached-but-stale reportRow can make isCompleted=true before
  // sections arrive, causing the full page to flash with empty content.
  // Use different copy: "Loading scan…" only for brand-new in-flight scans;
  // "Loading report…" when opening an existing completed report.
  const sectionsLoading = isCompleted && isLoading;
  const isKnownReport = !!reportRow; // initialData seeds this from list cache instantly
  const loadingLabel = isKnownReport || isCompleted ? "Loading report…" : "Loading scan…";
  if (id && ((reportIsLoading && !reportRow) || (sectionsLoading && !sections))) {
    return (
      <div
        className="px-4 py-16 md:px-7"
        style={{ textAlign: "center", color: "var(--fg-muted)" }}
      >
        <div style={{ fontSize: 16 }}>{loadingLabel}</div>
      </div>
    );
  }

  // Show in-progress UI while the report pipeline is still running.
  if (id && reportRow && !isCompleted) {
    return <ReportInProgress report={reportRow} progress={progressQuery.data} />;
  }


  // Sections fetched but all role sections are null — LLM analysis is still
  // being written. Keep showing a loading state; the refetchInterval above
  // will retry automatically every 5 seconds. If it takes >10 min, something
  // likely failed in the worker — offer to rescan.
  const hasAnySections = sections && (sections.founder ?? sections.product ?? sections.marketing ?? sections.growth ?? sections.summary);
  const minsSinceReport = reportRow && (Date.now() - new Date(reportRow.created_at).getTime()) / (1000 * 60);
  const isStuck = minsSinceReport && minsSinceReport > 10;

  if (id && sections && !hasAnySections) {
    return <StuckAnalysisState id={id} isStuck={!!isStuck} onBack={() => navigate(-1)} />;
  }

  // If sections query fails but report exists, continue with empty sections
  // (old reports might not have section data yet)

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
      ? normalizeEvidenceSection(sections.evidence)
      : null;

  const liveCompetitor: ScanCompetitor | undefined = reportRow
    ? {
        name: reportRow.primary_competitor_name ?? reportRow.competitors[0] ?? reportRow.category,
        domain: reportRow.primary_competitor_domain ?? "",
        scannedAt: reportRow.scanned_at ?? reportRow.updated_at,
        sources: reportRow.total_sources || reportRow.total_threads || platforms.reduce((s, p) => s + (p.posts ?? 0), 0),
        platforms: platforms.map((p) => ({ id: p.platform_id, name: p.name })),
        sentiment: {
          overall: reportRow.sentiment_overall ?? 0,
          positive: reportRow.sentiment_positive ?? 0,
          neutral: reportRow.sentiment_neutral ?? 0,
          negative: reportRow.sentiment_negative ?? 0,
          trend: reportRow.sentiment_trend ?? "",
        },
      }
    : undefined;

  const summaryData: SummaryData | null = sections?.summary != null
    ? {
        ...(sections.summary as SummaryData),
        intelligence: {
          brief: reportRow?.executive_brief ?? null,
          summary: reportRow?.voice_summary ?? null,
        }
      }
    : null;

  const competitorData: ScanCompetitor = liveCompetitor ?? summaryData?.competitor ?? {
    name: "—", domain: "", scannedAt: "", sources: 0, platforms: [],
    sentiment: { overall: 0, positive: 0, neutral: 0, negative: 0, trend: "" },
  };

  const renderLens = (l: LensId) => {
    switch (l) {
      case "summary":
        return (
          <ExecutiveSummary
            data={summaryData}
            competitor={competitorData}
            onPickLens={goToLens}
            reportId={id!}
            complaints={complaints}
            voice={voice}
            pricing={pricing}
            switching={switching}
            quotes={quotes}
            leads={leads}
            positioning={positioning}
            opportunities={opportunities}
            actions={actions}
            platforms={platforms}
            sentimentSeries={sentimentSeries}
            featureGaps={featureGaps}
          />
        );
      case "founder":
        return <FounderPage embedded data={founderProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} reportId={id} />;
      case "product":
        return <ProductPage embedded data={productProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} reportId={id} />;
      case "marketing":
        return <MarketingPage embedded data={marketingProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />;
      case "growth":
        return <GrowthPage embedded data={growthProps} evidenceSection={evidenceSection} range={range} reportId={id} />;
      case "pain":
        return <PainAndOppsPage complaints={complaints} opportunities={opportunities} competitorName={competitorData.name} />;
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
          activeLens={lens}
          onPickLens={goToLens}
        />

        <div key={lens} className="fade-up">
          {renderLens(lens)}
        </div>

        <div style={{ height: 48 }} />
      </div>

      {printingAll && (
        <div className="print-all-only">
          {LENS_ORDER.map((l, i) => (
            <section key={l} className={i > 0 ? "print-page-break" : undefined}>
              <div style={{ padding: "16px 28px 0" }}>
                <div className="re-eyebrow" style={{ fontSize: 11, color: LENS_META[l].color }}>
                  {LENS_META[l].glyph} {LENS_META[l].name}{l !== "summary" ? " lens" : ""}
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
  activeLens: LensId;
  onPickLens: (id: LensId) => void;
}

function sentimentChip(overall: number): { label: string; cls: string } {
  if (overall <= -0.3) return { label: "Negative", cls: "re-chip-neg" };
  if (overall < -0.05) return { label: "Mixed", cls: "re-chip-warn" };
  if (overall >= 0.15) return { label: "Positive", cls: "re-chip-pos" };
  return { label: "Neutral", cls: "" };
}

function UnifiedHeader({ competitor: c, meta, onNav, onExportThis, onExportAll, activeLens, onPickLens }: UnifiedHeaderProps) {
  const sent = sentimentChip(c.sentiment.overall);
  return (
    <div
      className="px-4 md:px-7"
      style={{
        borderBottom: "1px solid var(--border-soft)",
        background: "var(--glass)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        position: "sticky", top: 0, zIndex: 4,
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        {/* identity row */}
        <div className="pt-4" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: "1 1 280px" }}>
            <CompetitorAvatar name={c.name} domain={c.domain} size={48} borderRadius={12} />
            <div style={{ minWidth: 0 }}>
              <div className="re-eyebrow" style={{ fontSize: 11 }}>Scan report</div>
              <h1 className="re-h1 break-words" style={{ fontSize: "clamp(19px, 5vw, 25px)", marginTop: 3, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {c.name}
                <span className="font-mono-feat text-fg-faint break-all" style={{ fontSize: 13, fontWeight: 400 }}>{c.domain}</span>
                {(c.sentiment.overall !== 0 || c.sources > 0) && (
                  <span className={`re-chip ${sent.cls}`} style={{ fontSize: 11 }}>{sent.label}</span>
                )}
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 5, flexWrap: "wrap" }}>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>
                  {c.sources.toLocaleString()} mentions · {c.platforms.length} platforms
                </span>
                {c.scannedAt && (
                  <>
                    <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>·</span>
                    <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>Scanned {c.scannedAt}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="no-print" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="re-btn re-btn-ghost re-btn-sm" onClick={() => onNav("/compare")}>
              <Icon name="compare" size={14} /> Compare
            </button>
            <ExportMenu onExportThis={onExportThis} onExportAll={onExportAll} lensName={meta.name} />
          </div>
        </div>

        {/* lens tabs */}
        <LensTabs active={activeLens} onPick={onPickLens} />
      </div>
    </div>
  );
}

// Integrated, always-visible lens navigation — replaces the floating dock.
function LensTabs({ active, onPick }: { active: LensId; onPick: (id: LensId) => void }) {
  return (
    <div className="no-print -mb-px flex gap-1 overflow-x-auto" style={{ marginTop: 14 }} role="tablist">
      {LENS_ORDER.map((id) => {
        const m = LENS_META[id];
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onPick(id)}
            className="shrink-0"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "10px 13px",
              border: 0,
              borderBottom: `2px solid ${isActive ? m.color : "transparent"}`,
              background: "transparent",
              color: isActive ? m.color : "var(--fg-muted)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              letterSpacing: "-0.005em",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "color 160ms, border-color 160ms",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "var(--fg)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "var(--fg-muted)"; }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 99, background: m.color, opacity: isActive ? 1 : 0.5 }} />
            {m.name}
          </button>
        );
      })}
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
            <div style={{ padding: "6px 10px 2px", fontSize: 11 }} className="font-mono-feat text-fg-faint">
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
  reportId,
  complaints,
  voice,
  pricing,
  switching,
  quotes,
  leads,
  positioning,
  opportunities,
  actions,
  platforms,
  sentimentSeries,
  featureGaps,
}: {
  data: SummaryData | null;
  competitor: ScanCompetitor;
  onPickLens: (id: LensId) => void;
  reportId: string;
  complaints: Complaint[];
  voice: VoiceResponse | undefined;
  pricing: PricingResponse | undefined;
  switching: SwitchingResponse | undefined;
  quotes: QuoteRow[];
  leads: LeadRow[];
  positioning: Positioning[];
  opportunities: Opportunity[];
  actions: ActionRow[];
  platforms: PlatformStat[];
  sentimentSeries: number[];
  featureGaps: FeatureGap[];
}) {
  type SummaryTabId = "overview" | "complaints" | "voice" | "pricing" | "switching" | "quotes" | "leads" | "positioning" | "opportunities" | "actions";
  const [tab, setTab] = useState<SummaryTabId>("overview");

  if (!data) {
    return (
      <div className="px-4 py-8 md:px-7" style={{ paddingBottom: 0 }}>
        <div className="re-card" style={{ padding: 32, textAlign: "center", color: "var(--fg-muted)" }}>
          <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>SUMMARY</div>
          <div style={{ fontSize: 16 }}>Generating executive summary…</div>
          <div style={{ fontSize: 13, marginTop: 8, color: "var(--fg-faint)" }}>Switch to a lens below while synthesis completes.</div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 14 }}>PICK A LENS</div>
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

  const tabsData: Array<[SummaryTabId, string]> = [
    ["overview", "Overview"],
    ["complaints", `Complaints (${complaints.length})`],
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
    <div className="px-4 py-8 md:px-7" style={{ paddingBottom: 0 }}>
      {/* HERO — verdict + thesis */}
      <SummaryHero data={data} />

      {/* KEY METRICS — only true headline numbers */}
      <div className="grid grid-cols-3" style={{ marginTop: 20, gap: 12 }}>
        <SummaryStat
          label="Sentiment index"
          value={c.sentiment.overall.toFixed(2).replace("-", "−")}
          tone={c.sentiment.overall < -0.1 ? "neg" : c.sentiment.overall > 0.1 ? "pos" : undefined}
          desc={`Average mention sentiment on a −1 (hostile) to +1 (loved) scale. Above 0 leans positive${c.sentiment.trend ? ` · trend ${c.sentiment.trend}` : ""}.`}
        />
        <SummaryStat
          label="Mentions"
          value={c.sources.toLocaleString()}
          desc={`Public posts, comments and reviews we analysed — across ${c.platforms.length} platform${c.platforms.length === 1 ? "" : "s"}.`}
        />
        <SummaryStat
          label="Platforms"
          value={String(c.platforms.length)}
          desc="Source platforms scanned for this competitor — e.g. Reddit, App Store, Hacker News."
        />
      </div>

      {/* TOP THEMES — labelled so the counts mean something */}
      {data.topThemes.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 12, gap: 12 }}>
            <div>
              <div className="re-eyebrow" style={{ fontSize: 11 }}>Top themes</div>
              <h3 className="re-h2" style={{ fontSize: 18, marginTop: 6 }}>What users talk about most</h3>
            </div>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>Ranked by mention volume</span>
          </div>
          <div className="re-card" style={{ padding: "4px 16px" }}>
            {(() => {
              const max = Math.max(...data.topThemes.map((t) => t.mentions), 1);
              return data.topThemes.map((t, i) => (
                <div
                  key={t.name}
                  className="grid items-center"
                  style={{ gridTemplateColumns: "minmax(110px, 1.3fr) 1fr auto", gap: 16, padding: "12px 0", borderTop: i === 0 ? 0 : "1px solid var(--border-soft)" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name}
                  </span>
                  <div className="re-meter warn"><i style={{ width: `${(t.mentions / max) * 100}%` }} /></div>
                  <span className="font-mono-feat" style={{ fontSize: 13, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                    {t.mentions.toLocaleString()} mentions
                    {t.trend && <span className="text-fg-faint" style={{ marginLeft: 8 }}>{t.trend}</span>}
                  </span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {data.topQuotes.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="re-eyebrow" style={{ fontSize: 11 }}>Top quotes</div>
              <h3 className="re-h2" style={{ fontSize: 18, marginTop: 6 }}>What people are actually saying</h3>
            </div>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>Verbatim · across every platform</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 12 }}>
            {data.topQuotes.map((q, i) => {
              const lensColors = ["var(--accent)", "#6366f1", "#8b5cf6"];
              const color = lensColors[i % lensColors.length];
              return (
                <div key={i} className="re-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, transition: "border-color 120ms, box-shadow 120ms" }}>
                  <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 700, color, textTransform: "capitalize", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
                    {q.theme}
                  </span>
                  <p className="break-words" style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--fg)" }}>
                    “{q.text}”
                  </p>
                  <p className="font-mono-feat" style={{ margin: "auto 0 0", fontSize: 12, color: "var(--fg-faint)" }}>
                    {q.who} · {q.when}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.platformBreakdown && data.platformBreakdown.length > 0 && (
        <PlatformBreakdownCard platforms={data.platformBreakdown} />
      )}

      {/* GO DEEPER — highlighted CTA panel driving users into the role lenses */}
      <div
        style={{
          marginTop: 44,
          padding: "26px clamp(18px, 4vw, 28px) 28px",
          borderRadius: 16,
          border: "1px solid color-mix(in srgb, var(--accent) 24%, transparent)",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, transparent), transparent 58%), var(--surface-2)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--accent)" }}>Go deeper · 4 role playbooks</div>
        <h3 className="re-h2" style={{ fontSize: "clamp(20px, 4vw, 26px)", marginTop: 8, letterSpacing: "-0.02em" }}>
          Turn this into your playbook
        </h3>
        <p className="text-fg-muted" style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.55, maxWidth: 640 }}>
          The summary is the <em>what</em>. Each lens reworks the same evidence into a role-specific game plan —
          where to attack, what to build, how to position, and who's ready to switch.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginTop: 20 }}>
          <LensPreviewCard
            id="founder"
            onPick={onPickLens}
            teaser={opportunities.length > 0 ? `${opportunities.length} opportunities` : undefined}
          />
          <LensPreviewCard
            id="product"
            onPick={onPickLens}
            teaser={featureGaps.length > 0 ? `${featureGaps.length} feature gaps` : undefined}
          />
          <LensPreviewCard
            id="marketing"
            onPick={onPickLens}
            teaser={positioning.length > 0 ? `${positioning.length} angles` : undefined}
          />
          <LensPreviewCard
            id="growth"
            onPick={onPickLens}
            teaser={leads.length > 0 ? `${leads.length} high-intent leads` : undefined}
          />
        </div>
      </div>

      {/* TABS AT THE END */}
      <div style={{ marginTop: 48 }}>
        <div
          className="flex gap-1 overflow-x-auto px-4 md:px-7 scrollbar-none [&::-webkit-scrollbar]:hidden"
          style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--bg)", marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, scrollbarWidth: "none" }}
        >
          {tabsData.map(([k, label]) => (
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

        <div className="px-4 pb-16 pt-5 md:px-7">
          <div style={{ width: "100%" }}>
            {tab === "overview" && (
              <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                {/* main column — the substance: read → pain → switch → gap → evidence */}
                <div className="flex flex-col gap-4">
                  <ScanExecutiveBriefCard brief={data.intelligence?.brief ?? null} />
                  <ComplaintsCard
                    complaints={complaints.slice(0, 5)}
                    totalCount={complaints.length}
                    showViewAll
                    onViewAll={() => setTab("complaints")}
                    onOpenThread={() => {}}
                  />
                  {switching && <ScanSwitchingSummary switching={switching} />}
                  {featureGaps.length > 0 && (
                    <ScanFeatureGapsCard featureGaps={featureGaps.slice(0, 6)} />
                  )}
                  <ScanVerbatimCard quotes={quotes.slice(0, 5)} totalCount={quotes.length} onViewAll={() => setTab("quotes")} />
                </div>
                {/* right rail — scale & context */}
                <div className="flex flex-col gap-4">
                  <ScanSummaryCard data={data} complaints={complaints} />
                  {platforms.length > 0 && <ScanPlatformBreakdown platforms={platforms} />}
                  {sentimentSeries.length > 1 && (
                    <ScanSentimentCard series={sentimentSeries} />
                  )}
                </div>
              </div>
            )}

            {tab === "complaints" && (
              <ComplaintsCard complaints={complaints} onOpenThread={() => {}} />
            )}
            {tab === "voice" && <VoiceTab voice={voice} competitorName={c.name} />}
            {tab === "pricing" && <PricingTab pricing={pricing} />}
            {tab === "switching" && <SwitchingTab switching={switching} />}
            {tab === "quotes" && <QuotesCard quotes={quotes} />}
            {tab === "leads" && <LeadsCard leads={leads} />}
            {tab === "positioning" && <PositioningCard positioning={positioning} />}
            {tab === "opportunities" && <OpportunitiesCard opportunities={opportunities} />}
            {tab === "actions" && <ActionsCard actions={actions} reportId={reportId} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tone, desc }: { label: string; value: string; tone?: "neg" | "pos" | "warn"; desc: string }) {
  const color =
    tone === "neg" ? "var(--neg)" : tone === "pos" ? "var(--pos)" : tone === "warn" ? "var(--warn)" : "var(--fg)";
  return (
    <div className="re-card" style={{ padding: 15, display: "flex", flexDirection: "column" }}>
      <div className="re-eyebrow" style={{ fontSize: 11, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div className="font-mono-feat tnum" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 6, color }}>
        {value}
      </div>
      <p style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--fg-muted)", marginTop: 8 }}>{desc}</p>
    </div>
  );
}

function PlatformBreakdownCard({ platforms }: { platforms: Array<{ id: string; name: string; posts: number; sentiment: number; contexts: string[] }> }) {
  const total = platforms.reduce((a, b) => a + b.posts, 0) || 1;
  return (
    <div className="re-card" style={{ marginTop: 28 }}>
      <div className="re-card-hd">
        <h3>Platform breakdown</h3>
        <span className="font-mono-feat text-[12px] text-fg-faint">
          {total} items
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {platforms.map((p) => {
          const pct = (p.posts / total) * 100;
          return (
            <div key={p.id}>
              <div className="mb-1 flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2" style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span className="truncate font-mono-feat text-[11px] text-fg-faint">
                    {p.contexts.slice(0, 2).join(" · ")}
                  </span>
                </span>
                <span
                  className="flex-shrink-0 font-mono-feat tnum text-fg-muted"
                  style={{ fontSize: 12 }}
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

// ----------------------------------------------------------------------------
// SUMMARY HERO — the verdict + the thesis, in one band

function SummaryHero({ data }: { data: SummaryData }) {
  const s = data.competitor.sentiment;
  const topTheme = data.topThemes[0];
  const verdict =
    s.overall <= -0.3 ? { label: "Negative", color: "var(--neg)" }
    : s.overall < -0.05 ? { label: "Mixed", color: "var(--warn)" }
    : s.overall >= 0.15 ? { label: "Positive", color: "var(--pos)" }
    : { label: "Neutral", color: "var(--fg-faint)" };

  return (
    <div className="re-card re-card-elev" style={{ overflow: "hidden", position: "relative" }}>
      <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.35 }} />
      <div
        className="grid grid-cols-1 md:grid-cols-[auto_1fr] place-items-center md:place-items-stretch md:items-center"
        style={{ position: "relative", padding: 26, gap: 30 }}
      >
        <PerceptionRing positive={s.positive} neutral={s.neutral} negative={s.negative} index={s.overall} />

        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="re-eyebrow" style={{ fontSize: 11 }}>Executive summary</span>
            <span
              className="re-chip"
              style={{ fontSize: 11, color: verdict.color, background: `color-mix(in srgb, ${verdict.color} 12%, transparent)`, borderColor: "transparent" }}
            >
              {verdict.label}
            </span>
            {topTheme && (
              <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>
                loudest theme · {topTheme.name.toLowerCase()}
              </span>
            )}
          </div>

          <h2 className="re-h2 break-words" style={{ fontSize: "clamp(21px, 4vw, 30px)", marginTop: 10, letterSpacing: "-0.02em", lineHeight: 1.2, maxWidth: 760 }}>
            {data.headlines.mainThesis}
          </h2>

          {data.headlines.insights && (
            <p className="text-fg-muted break-words" style={{ marginTop: 12, fontSize: 15, lineHeight: 1.6, maxWidth: 720 }}>
              {data.headlines.insights}
            </p>
          )}
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
  const pct = (n: number) => Math.round((n / total) * 100);

  const indexColor = index <= -0.05 ? "var(--neg)" : index >= 0.15 ? "var(--pos)" : "var(--warn)";
  const verdict = index <= -0.3 ? "Negative" : index < -0.05 ? "Mixed" : index >= 0.15 ? "Positive" : "Neutral";

  const legend = [
    { label: "Positive", value: pct(positive), color: "var(--pos)" },
    { label: "Neutral", value: pct(neutral), color: "#d1ccc2" },
    { label: "Negative", value: pct(negative), color: "var(--neg)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "min(180px, 56vw)" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 180 }}>
        <svg width="100%" height="100%" viewBox="0 0 200 200" style={{ display: "block", transform: "rotate(-90deg)" }}>
          <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(20,16,12,0.06)" strokeWidth="16" />
          <circle cx="100" cy="100" r={r} fill="none" stroke="var(--neg)" strokeWidth="16"
            strokeDasharray={`${negLen} ${circ}`} strokeDashoffset={0} strokeLinecap="butt" />
          <circle cx="100" cy="100" r={r} fill="none" stroke="#d1ccc2" strokeWidth="16"
            strokeDasharray={`${neuLen} ${circ}`} strokeDashoffset={-negLen} strokeLinecap="butt" />
          <circle cx="100" cy="100" r={r} fill="none" stroke="var(--pos)" strokeWidth="16"
            strokeDasharray={`${posLen} ${circ}`} strokeDashoffset={-(negLen + neuLen)} strokeLinecap="butt" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, letterSpacing: "0.02em" }}>Perception</div>
          <div className="font-mono-feat tnum" style={{ fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em", marginTop: 2, color: indexColor }}>
            {index.toFixed(2).replace("-", "−")}
          </div>
          <div className="font-mono-feat" style={{ fontSize: 11, fontWeight: 600, marginTop: 1, color: indexColor }}>{verdict}</div>
        </div>
      </div>

      {/* labelled legend — replaces the cryptic +68 · 15 · −28 row */}
      <div style={{ display: "grid", gap: 5, width: "100%" }}>
        {legend.map((l) => (
          <div key={l.label} className="flex items-center" style={{ fontSize: 12.5, gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            <span className="text-fg-muted">{l.label}</span>
            <span className="font-mono-feat tnum ml-auto" style={{ color: "var(--fg)", fontWeight: 600 }}>{l.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LENS PREVIEW CARD

const LENS_ICON: Record<Exclude<LensId, "summary">, ComponentType<{ size?: number | string }>> = {
  founder: Crosshair,
  product: Layers,
  marketing: Megaphone,
  growth: TrendingUp,
  pain: Zap,
};

function LensPreviewCard({ id, onPick, teaser }: { id: Exclude<LensId, "summary">; onPick: (id: LensId) => void; teaser?: string }) {
  const m = LENS_META[id];
  const LensIcon = LENS_ICON[id];
  return (
    <button
      onClick={() => onPick(id)}
      className="re-card group text-left"
      style={{ cursor: "pointer", padding: 16, display: "flex", alignItems: "center", gap: 14, transition: "border-color 140ms, box-shadow 140ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `color-mix(in srgb, ${m.color} 45%, transparent)`; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      <span
        className="grid place-items-center shrink-0"
        style={{ width: 42, height: 42, borderRadius: 11, background: `color-mix(in srgb, ${m.color} 13%, transparent)`, color: m.color }}
      >
        <LensIcon size={19} />
      </span>
      <span className="min-w-0" style={{ flex: 1 }}>
        <span className="flex items-center gap-2 flex-wrap">
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{m.name}</span>
          {teaser && (
            <span
              className="font-mono-feat"
              style={{ fontSize: 11, fontWeight: 600, color: m.color, background: `color-mix(in srgb, ${m.color} 13%, transparent)`, borderRadius: 99, padding: "1px 8px" }}
            >
              {teaser}
            </span>
          )}
        </span>
        <span className="block text-fg-muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>{m.role}</span>
      </span>
      <span className="font-mono-feat shrink-0 transition-transform group-hover:translate-x-0.5" style={{ fontSize: 14, color: m.color }}>→</span>
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
          style={{ fontSize: 11, color, letterSpacing: "0.02em", fontWeight: 700, textTransform: "capitalize" }}
        >
          {q.theme ? `Theme · ${q.theme}` : "Quote"}
        </span>
        {q.score > 0 && <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 12 }}>{q.score}↑</span>}
      </div>
      <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", lineHeight: 1.55, color: "var(--fg)" }}>
        "{q.text}"
      </p>
      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>
        {q.who}{q.sub ? ` · ${q.sub}` : ""}{q.when ? ` · ${q.when}` : ""}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB HELPER COMPONENTS

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
      <div className="re-eyebrow mb-2" style={{ fontSize: 11 }}>
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
        {flows.map((s, idx) => (
          <div
            key={`${s[field]}-${idx}`}
            className="grid items-center gap-2"
            style={{ gridTemplateColumns: "70px 1fr 36px" }}
          >
            <span style={{ fontSize: 13 }}>{s[field]}</span>
            <div className={`re-meter ${tone}`}>
              <i style={{ width: `${(s.count / max) * 100}%` }} />
            </div>
            <span
              className="font-mono-feat tnum text-right text-fg-faint"
              style={{ fontSize: 12 }}
            >
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScanExecutiveBriefCard({ brief }: { brief: string | null }) {
  if (!brief) return null;
  return (
    <div className="rounded-[10px] border p-5" style={{ borderColor: "var(--accent)", borderWidth: 1.5 }}>
      <div className="mb-2 text-[12px] font-semibold tracking-wide" style={{ color: "var(--accent)" }}>
        Intelligence brief
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--fg)" }}>
        {brief}
      </p>
    </div>
  );
}

function ScanSummaryCard({
  data,
  complaints,
}: {
  data: SummaryData | null;
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

  const summary = data?.intelligence?.summary;

  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>
          <Icon name="alert" size={14} /> Executive summary
        </h3>
        <span className="font-mono-feat text-[12px] text-fg-faint">
          auto · {data?.competitor.scannedAt ? formatRelative(data.competitor.scannedAt) : "1d ago"}
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

function ScanSentimentCard({ series }: { series: number[] }) {
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
        <span className="font-mono-feat text-[12px] text-fg-faint">
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

function ScanSwitchingSummary({ switching }: { switching: SwitchingResponse }) {
  const maxIn = Math.max(...switching.inbound.map((s) => s.count), 1);
  const maxOut = Math.max(...switching.outbound.map((s) => s.count), 1);
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Switching signals</h3>
        <span className="font-mono-feat text-[12px] text-fg-faint">
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

function ScanPlatformBreakdown({ platforms }: { platforms: PlatformStat[] }) {
  const total = platforms.reduce((a, b) => a + (b.posts ?? 0), 0) || 1;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Platform breakdown</h3>
        <span className="font-mono-feat text-[12px] text-fg-faint">
          {total} items
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-3">
        {platforms.map((p) => {
          const pct = ((p.posts ?? 0) / total) * 100;
          return (
            <div key={p.id}>
              <div className="mb-1 flex justify-between gap-2">
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <span
                  className="flex-shrink-0 font-mono-feat tnum text-fg-muted"
                  style={{ fontSize: 12 }}
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

function ScanVerbatimCard({
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
        <span className="font-mono-feat text-[12px] text-fg-faint">live</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {quotes.map((q) => (
          <div key={q.id}>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono-feat text-[12px] font-semibold tracking-wide flex-shrink-0"
                style={{ color: "var(--accent)" }}
              >
                {q.who}
              </span>
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background:
                    q.sentiment > 0
                      ? "var(--pos)"
                      : q.sentiment < -0.5
                        ? "var(--neg)"
                        : "var(--warn)",
                }}
              />
            </div>
            <p className="m-0 mt-1" style={{ fontSize: 13, lineHeight: 1.55 }}>
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
          <button onClick={onViewAll} className="re-btn re-btn-ghost re-btn-sm">
            View all {totalCount}
          </button>
        </div>
      )}
    </div>
  );
}

function StuckAnalysisState({
  id,
  isStuck,
  onBack,
}: {
  id: string;
  isStuck: boolean;
  onBack: () => void;
}) {
  const { mutate, isPending, isSuccess } = useRetrySynthesisMutation();

  if (isSuccess) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>RETRYING</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Analysis re-queued.</div>
        <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>
          The worker will resume from where it left off. This page will update automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
      <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>
        {isStuck ? "ANALYSIS STUCK" : "GENERATING ANALYSIS"}
      </div>
      <div style={{ fontSize: 16, marginBottom: 8 }}>
        {isStuck ? "Analysis is taking longer than expected." : "AI analysis is being written…"}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: isStuck ? 16 : 0 }}>
        {isStuck
          ? "The synthesis job may have failed. Retry to resume from the last checkpoint — no re-scraping needed."
          : "This usually takes 30–60 seconds. The page will update automatically."}
      </div>
      {isStuck && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
          <button
            className="re-btn re-btn-sm"
            onClick={onBack}
            disabled={isPending}
          >
            Go back
          </button>
          <button
            className="re-btn re-btn-sm re-btn-accent"
            onClick={() => mutate(id)}
            disabled={isPending}
          >
            {isPending ? "Retrying…" : "Retry analysis"}
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// PAIN & OPPS FULL PAGE

function PainAndOppsPage({
  complaints,
  opportunities,
  competitorName,
}: {
  complaints: Complaint[];
  opportunities: Opportunity[];
  competitorName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

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

  const selectedComplaint = complaints.find((c) => c.id === selected) ?? null;
  const linkedOpps = selected ? (oppByComplaint.get(selected) ?? []) : [];
  const standaloneOpps = opportunities.filter((o) => !o.anchor_complaint_id);

  return (
    <div className="px-4 py-8 md:px-7" style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--neg)" }}>⚡ PAIN & OPPORTUNITIES</div>
        <h2 className="re-h2" style={{ fontSize: "clamp(18px,4vw,24px)", marginTop: 6, letterSpacing: "-0.02em" }}>
          What {competitorName}'s users complain about — and where you can win
        </h2>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 6 }}>
          {complaints.length} complaints · {opportunities.length} opportunities
        </p>
      </div>

      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: selectedComplaint ? "1fr 1fr" : "1fr" }}
      >
        {/* LEFT: complaints list */}
        <div className="flex flex-col gap-3">
          <div className="re-eyebrow" style={{ fontSize: 11, padding: "0 0 4px" }}>
            COMPLAINTS <span className="font-mono-feat text-fg-faint">({complaints.length})</span>
          </div>
          {complaints.length === 0 ? (
            <div className="re-card px-5 py-10 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
              No complaints recorded for this report yet.
            </div>
          ) : (
            complaints.map((cp) => {
              const isSelected = selected === cp.id;
              const linkedCount = oppByComplaint.get(cp.id)?.length ?? 0;
              return (
                <button
                  key={cp.id}
                  onClick={() => setSelected(isSelected ? null : cp.id)}
                  className="re-card w-full cursor-pointer border-0 text-left"
                  style={{
                    padding: "14px 16px",
                    borderLeft: `3px solid ${isSelected ? "var(--neg)" : "var(--border-soft)"}`,
                    background: isSelected ? "color-mix(in srgb, var(--neg) 6%, var(--surface))" : "var(--surface)",
                    transition: "border-color 150ms, background 150ms",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="font-mono-feat tnum mt-0.5 shrink-0"
                      style={{ fontSize: 12, color: "var(--neg)", minWidth: 18 }}
                    >
                      {cp.mentions ?? ""}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", lineHeight: 1.4 }}>
                        {cp.title}
                      </div>
                      {cp.summary && (
                        <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55 }}>
                          {cp.summary}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {cp.tag && (
                          <span className="re-chip" style={{ fontSize: 11 }}>{cp.tag}</span>
                        )}
                        {linkedCount > 0 && (
                          <span className="re-chip re-chip-accent" style={{ fontSize: 11 }}>
                            {linkedCount} opp{linkedCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icon
                      name="chev-right"
                      size={13}
                      className="shrink-0 mt-0.5"
                      style={{ color: isSelected ? "var(--neg)" : "var(--fg-faint)", transition: "color 150ms", transform: isSelected ? "rotate(90deg)" : "none" }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* RIGHT: opportunities panel — shown when a complaint is selected */}
        {selectedComplaint && (
          <div className="flex flex-col gap-3">
            <div className="re-eyebrow" style={{ fontSize: 11, padding: "0 0 4px" }}>
              Opportunities for “{selectedComplaint.title}”
            </div>
            {linkedOpps.length === 0 ? (
              <div className="re-card px-5 py-8 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
                No opportunities linked to this complaint yet.
              </div>
            ) : (
              linkedOpps.map((opp, i) => (
                <div
                  key={opp.id ?? i}
                  className="re-card"
                  style={{ padding: "14px 16px", borderLeft: "3px solid var(--pos)" }}
                >
                  <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--pos)", marginBottom: 6 }}>
                    OPPORTUNITY
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", lineHeight: 1.4 }}>
                    {opp.title}
                  </div>
                  {opp.thesis && (
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55 }}>
                      {opp.thesis}
                    </p>
                  )}
                  {opp.effort && (
                    <div className="mt-2">
                      <span className="re-chip" style={{ fontSize: 11 }}>Effort: {opp.effort}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Standalone opportunities not linked to a specific complaint */}
      {standaloneOpps.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 12 }}>
            ALL OPPORTUNITIES <span className="font-mono-feat text-fg-faint">({standaloneOpps.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {standaloneOpps.map((opp, i) => (
              <div
                key={opp.id ?? i}
                className="re-card"
                style={{ padding: "14px 16px", borderTop: "2px solid var(--pos)" }}
              >
                <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--pos)", marginBottom: 6 }}>
                  OPPORTUNITY
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", lineHeight: 1.4 }}>
                  {opp.title}
                </div>
                {opp.thesis && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55 }}>
                    {opp.thesis}
                  </p>
                )}
                {opp.effort && (
                  <div className="mt-2">
                    <span className="re-chip" style={{ fontSize: 11 }}>Effort: {opp.effort}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScanFeatureGapsCard({ featureGaps }: { featureGaps: FeatureGap[] }) {
  const max = Math.max(...featureGaps.map((g) => g.votes), 1);
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Feature gaps</h3>
        <span className="font-mono-feat text-[12px] text-fg-faint">
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
            <span className="truncate" style={{ fontSize: 13 }}>{g.feature}</span>
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
              style={{ fontSize: 12 }}
            >
              {g.votes}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
