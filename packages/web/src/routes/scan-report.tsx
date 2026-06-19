import { useMemo, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  platformBreakdown?: Array<{ id: string; name: string; posts: number; sentiment: number; contexts: string[] }>;
  intelligence?: { brief: string | null; summary: string | null };
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
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>SCAN CANCELLED</div>
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
      {/* SUMMARY CONTENT FIRST - ALL DETAILS */}
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
          Switch a lens below to read the same evidence through a specific role — founder strategy, product roadmap, marketing copy, or growth conversations.
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
            {data.topQuotes.map((q, i) => {
              const lensColors = ["#ff5c1a", "#6366f1", "#8b5cf6"];
              const color = lensColors[i % lensColors.length];
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card"
                  style={{
                    borderTop: `4px solid ${color}`,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: 16 }}>
                    <div className="re-eyebrow" style={{ fontSize: 10, color, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {q.theme}
                    </div>
                    <p style={{ margin: 0, fontStyle: "italic", fontSize: 14, lineHeight: 1.65, color: "var(--fg)" }}>
                      "{q.text}"
                    </p>
                    <p style={{ margin: "12px 0 0 0", fontSize: 11, color: "var(--fg-faint)" }}>
                      {q.who} · {q.when}
                    </p>
                  </div>
                </div>
              );
            })}
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

      {data.platformBreakdown && data.platformBreakdown.length > 0 && (
        <PlatformBreakdownCard platforms={data.platformBreakdown} />
      )}

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
                <div className="flex flex-col gap-4">
                  <ScanExecutiveBriefCard brief={data.intelligence?.brief ?? null} />
                  <ScanSummaryCard data={data} complaints={complaints} />
                  <ComplaintsCard
                    complaints={complaints.slice(0, 5)}
                    totalCount={complaints.length}
                    showViewAll
                    onViewAll={() => setTab("complaints")}
                    onOpenThread={() => {}}
                  />
                  {sentimentSeries.length > 1 && (
                    <ScanSentimentCard series={sentimentSeries} />
                  )}
                  {switching && <ScanSwitchingSummary switching={switching} />}
                </div>
                <div className="flex flex-col gap-4">
                  {platforms.length > 0 && <ScanPlatformBreakdown platforms={platforms} />}
                  <ScanVerbatimCard quotes={quotes.slice(0, 5)} totalCount={quotes.length} onViewAll={() => setTab("quotes")} />
                  {featureGaps.length > 0 && (
                    <ScanFeatureGapsCard featureGaps={featureGaps.slice(0, 6)} />
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

function PlatformBreakdownCard({ platforms }: { platforms: Array<{ id: string; name: string; posts: number; sentiment: number; contexts: string[] }> }) {
  const total = platforms.reduce((a, b) => a + b.posts, 0) || 1;
  return (
    <div className="re-card" style={{ marginTop: 28 }}>
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

function ScanExecutiveBriefCard({ brief }: { brief: string | null }) {
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
        <span className="font-mono-feat text-[11px] text-fg-faint">
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

function ScanSwitchingSummary({ switching }: { switching: SwitchingResponse }) {
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

function ScanPlatformBreakdown({ platforms }: { platforms: PlatformStat[] }) {
  const total = platforms.reduce((a, b) => a + (b.posts ?? 0), 0) || 1;
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
          const pct = ((p.posts ?? 0) / total) * 100;
          return (
            <div key={p.id}>
              <div className="mb-1 flex justify-between gap-2">
                <span style={{ fontSize: 13 }}>{p.name}</span>
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
        <span className="font-mono-feat text-[11px] text-fg-faint">live</span>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        {quotes.map((q) => (
          <div key={q.id}>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono-feat text-[10px] font-semibold uppercase tracking-wider flex-shrink-0"
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
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>RETRYING</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Analysis re-queued.</div>
        <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>
          The worker will resume from where it left off. This page will update automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
      <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
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

function ScanFeatureGapsCard({ featureGaps }: { featureGaps: FeatureGap[] }) {
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
