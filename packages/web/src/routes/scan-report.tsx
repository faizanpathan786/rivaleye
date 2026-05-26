import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/components/icons";
import { FounderPage } from "./founder";
import { ProductPage } from "./product";
import { MarketingPage } from "./marketing";
import { GrowthPage } from "./growth";
import { useReportSectionsQuery } from "@/hooks/queries/use-report-sections";
import { useReportQuery, useReportsQuery } from "@/hooks/queries/use-reports";
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
  founder:   { name: "Founder",   color: "#ff5c1a", bg: "rgba(255,92,26,0.10)",  glyph: "⊙", role: "Market opening · wedge to attack" },
  product:   { name: "Product",   color: "#6366f1", bg: "rgba(99,102,241,0.10)", glyph: "⊞", role: "Roadmap intelligence · gaps & evidence" },
  marketing: { name: "Marketing", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", glyph: "❝", role: "Positioning · copy · angles" },
  growth:    { name: "Growth",    color: "#16a34a", bg: "rgba(22,163,74,0.10)",  glyph: "↗", role: "Switch intent · live conversations" },
};

interface LensHighlight {
  score: number;
  scoreLabel: string;
  insight: string;
  stats: { k: string; v: string }[];
}

const LENS_HIGHLIGHTS: Record<Exclude<LensId, "summary">, LensHighlight> = {
  founder: {
    score: 82, scoreLabel: "Strong opportunity",
    insight: "Best wedge: The project tool that doesn't punish you for growing.",
    stats: [
      { k: "Wedge confidence", v: "92%" },
      { k: "Risks flagged",    v: "4"   },
      { k: "Action moves",     v: "3"   },
    ],
  },
  product: {
    score: 78, scoreLabel: "Strong roadmap opportunity",
    insight: "Top gap: Native time tracking — 412 mentions, agency wedge wide open.",
    stats: [
      { k: "Feature gaps",     v: "8" },
      { k: "Build candidates", v: "4" },
      { k: "Roadmap items",    v: "5" },
    ],
  },
  marketing: {
    score: 86, scoreLabel: "Strong messaging opportunity",
    insight: "Best angle: “All the speed. None of the seat tax.”",
    stats: [
      { k: "Angles",        v: "6"   },
      { k: "Copy ideas",    v: "17"  },
      { k: "Quote library", v: "10+" },
    ],
  },
  growth: {
    score: 79, scoreLabel: "Strong intent signal",
    insight: "Hottest: r/SaaS cancellation thread — 1.4k upvotes, still on the front page.",
    stats: [
      { k: "Hot threads",     v: "3" },
      { k: "Communities",     v: "7" },
      { k: "Reply templates", v: "3" },
    ],
  },
};

interface ScanQuote {
  who: string;
  sub: string;
  when: string;
  score: number;
  sentiment: number;
  text: string;
}

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

interface ScanData {
  competitor: ScanCompetitor;
  quotes: ScanQuote[];
}

const SCAN_DATA: ScanData = {
  competitor: {
    name: "Linear",
    domain: "linear.app",
    scannedAt: "2026-05-12 14:22 UTC",
    sources: 1247,
    platforms: [
      { id: "reddit",      name: "Reddit" },
      { id: "g2",          name: "G2 reviews" },
      { id: "linkedin",    name: "LinkedIn" },
      { id: "producthunt", name: "Product Hunt" },
      { id: "twitter",     name: "X / Twitter" },
      { id: "youtube",     name: "YouTube" },
      { id: "hn",          name: "Hacker News" },
    ],
    sentiment: {
      overall: -0.34,
      positive: 0.28,
      neutral: 0.31,
      negative: 0.41,
      trend: "+0.08 vs prev 90d",
    },
  },
  quotes: [
    { who: "u/devops_dan",      sub: "r/sysadmin",          when: "3d", score: 412, sentiment: -0.71,
      text: "If Linear shipped a real audit log I'd renew tomorrow. Without it our security review is a nightmare." },
    { who: "u/pm_mariana",      sub: "r/ProductManagement", when: "5d", score: 287, sentiment: -0.55,
      text: "Cycles are great. Why is there no concept of 'this depends on that' in 2026? I'm building dependency maps in FigJam." },
    { who: "u/startup_charlie", sub: "r/startups",          when: "1w", score: 198, sentiment: -0.34,
      text: "Bought Linear for the speed. Stayed for the speed. Annoyed by the price every time we grow." },
    { who: "u/contractor_v",    sub: "r/ExperiencedDevs",   when: "1w", score: 174, sentiment: -0.62,
      text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak." },
    { who: "u/founder_h",       sub: "r/SaaS",              when: "2w", score: 138, sentiment: -0.39,
      text: "Customers ask for our public roadmap. We post one on Notion and try to keep it in sync. We always fail." },
  ],
};

// ----------------------------------------------------------------------------

export function ScanReportPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [lens, setLens] = useState<LensId>("summary");
  const [range, setRange] = useState("90d");
  const meta = LENS_META[lens];

  // When no :id, redirect to the most recent report.
  const { data: allReports } = useReportsQuery();
  useEffect(() => {
    const first = allReports?.[0];
    if (!id && first) {
      navigate(`/scan-report/${first.id}`, { replace: true });
    }
  }, [id, allReports, navigate]);

  // Live data fetch — only when :id is present in the route.
  const { data: sections, isLoading, error } = useReportSectionsQuery(id);
  const { data: reportRow } = useReportQuery(id);

  useEffect(() => {
    const m = document.querySelector(".main");
    if (m) m.scrollTo({ top: 0, behavior: "smooth" });
  }, [lens]);

  const onNav = (to: string) => navigate(to.startsWith("/") ? to : `/${to}`);

  // When :id is present and we are still loading or errored, show a simple state.
  if (id && isLoading) {
    return (
      <div style={{ padding: "48px 28px", textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>LOADING REPORT</div>
        <div style={{ fontSize: 16 }}>Fetching report sections…</div>
      </div>
    );
  }

  if (id && error) {
    return (
      <div style={{ padding: "48px 28px", textAlign: "center", color: "var(--neg)" }}>
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

  const competitorData = liveCompetitor ?? SCAN_DATA.competitor;

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
          background: lens === "summary"
            ? "transparent"
            : `radial-gradient(ellipse 1200px 600px at 50% -10%, ${meta.bg} 0%, transparent 60%)`,
          transition: "background 600ms cubic-bezier(.2,.7,.2,1)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <UnifiedHeader
          competitor={competitorData}
          meta={meta}
          range={range}
          setRange={setRange}
          onNav={onNav}
        />

        <div key={lens} className="fade-up">
          {lens === "summary"   && (
            <ExecutiveSummary
              data={sections?.summary ? (sections.summary as ScanData) : SCAN_DATA}
              onPickLens={setLens}
            />
          )}
          {lens === "founder"   && (
            <FounderPage embedded data={founderProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />
          )}
          {lens === "product"   && (
            <ProductPage embedded data={productProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />
          )}
          {lens === "marketing" && (
            <MarketingPage embedded data={marketingProps} evidenceSection={evidenceSection} range={range} competitorName={competitorData.name} />
          )}
          {lens === "growth"    && (
            <GrowthPage embedded data={growthProps} evidenceSection={evidenceSection} range={range} />
          )}
        </div>

        <div style={{ height: 110 }} />
      </div>

      <LensDock active={lens} onPick={setLens} />
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
}

function UnifiedHeader({ competitor: c, meta, range, setRange, onNav }: UnifiedHeaderProps) {
  return (
    <div
      style={{
        padding: "18px 28px 14px",
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
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 52, height: 52, borderRadius: 12,
                background: "#5e6ad2", color: "#fff",
                display: "grid", placeItems: "center",
                fontSize: 22, fontWeight: 600,
                fontFamily: "var(--font-mono)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {c.name[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              <h1 className="re-h1" style={{ fontSize: 24, marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
                {c.name}
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12, fontWeight: 400 }}>{c.domain}</span>
                <span className="re-chip re-chip-pos" style={{ fontSize: 9 }}>FRESH</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>SCANNED {c.scannedAt}</span>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>·</span>
                <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
                  {c.sources.toLocaleString()} mentions · {c.platforms.length} platforms
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
            <button className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="download" size={14} /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// EXECUTIVE SUMMARY

function ExecutiveSummary({ data, onPickLens }: { data: ScanData; onPickLens: (id: LensId) => void }) {
  const c = data.competitor;
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 0" }}>
      <PerceptionHero data={data} />

      <div style={{ marginTop: 28 }}>
        <div className="re-eyebrow" style={{ fontSize: 10 }}>EXECUTIVE MEMO</div>
        <h2 className="re-h2" style={{ fontSize: 28, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1.2, maxWidth: 920 }}>
          {c.name}'s pain is structural, not stylistic — and pricing is the wedge users are already naming for you.
        </h2>
        <p style={{ marginTop: 14, fontSize: 16, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: 920 }}>
          Across {c.sources.toLocaleString()} mentions in the last 90 days, three themes own 60% of negative sentiment:
          per-seat <b style={{ color: "var(--fg)" }}>pricing past 15 seats</b> (187 mentions, +34%),
          the absence of <b style={{ color: "var(--fg)" }}>native time tracking</b> (152, +18%),
          and a <b style={{ color: "var(--fg)" }}>mobile app described as "read-mostly"</b> (134, +9%).
          Net switching is strongly inbound (+325 from Jira, Asana, ClickUp), but outbound mentions cite the same
          pricing argument and a growing demand for executive roadmap views.
        </p>
        <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.65, color: "var(--fg-muted)", maxWidth: 920 }}>
          Switch a lens below to read the same evidence through a specific role — founder strategy, product
          roadmap, marketing copy, or growth conversations.
        </p>
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 14 }}>PICK A LENS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {(["founder", "product", "marketing", "growth"] as const).map((id) => (
            <LensPreviewCard key={id} id={id} onPick={onPickLens} />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div className="re-eyebrow" style={{ fontSize: 10 }}>THE THREE QUOTES THAT SAY IT ALL</div>
            <h3 className="re-h2" style={{ fontSize: 18, marginTop: 6 }}>Top of mind, top of thread</h3>
          </div>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>cross-cutting · all lenses anchor here</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <AnchorQuote q={data.quotes[2]} theme="Pricing" color="#ff5c1a" />
          <AnchorQuote q={data.quotes[3]} theme="Time tracking" color="#6366f1" />
          <AnchorQuote q={data.quotes[1]} theme="Roadmap" color="#8b5cf6" />
        </div>
      </div>

      <div
        style={{
          marginTop: 32, padding: "22px 24px",
          background: "var(--surface)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-soft)",
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 24,
        }}
      >
        <SummaryStat label="Sentiment index" value={c.sentiment.overall.toFixed(2)} tone="neg" sub={c.sentiment.trend} />
        <SummaryStat label="Mentions" value={c.sources.toLocaleString()} sub="+18% vs prev" />
        <SummaryStat label="Platforms" value={String(c.platforms.length)} sub="all active" />
        <SummaryStat label="Switching net" value="+325" tone="pos" sub="inbound · 90d" />
        <SummaryStat label="Top theme" value="Pricing" tone="warn" sub="187 · +34%" />
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

function PerceptionHero({ data }: { data: ScanData }) {
  const s = data.competitor.sentiment;
  return (
    <div className="re-card re-card-elev" style={{ overflow: "hidden", position: "relative" }}>
      <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.4 }} />
      <div
        style={{
          position: "relative", padding: 24,
          display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center",
        }}
      >
        <PerceptionRing positive={s.positive} neutral={s.neutral} negative={s.negative} index={s.overall} />

        <div style={{ minWidth: 0 }}>
          <div className="re-eyebrow" style={{ fontSize: 10 }}>
            WHAT USERS THINK OF {data.competitor.name.toUpperCase()}
          </div>
          <h2 className="re-h2" style={{ fontSize: 26, marginTop: 6, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Negative-leaning, with the loudest theme being <span style={{ color: "var(--accent)" }}>pricing</span>.
          </h2>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {(["founder", "product", "marketing", "growth"] as const).map((id) => {
              const m = LENS_META[id];
              const h = LENS_HIGHLIGHTS[id];
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
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
                    <span
                      className="font-mono-feat tnum"
                      style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", color: m.color }}
                    >
                      {h.score}
                    </span>
                    <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>/100</span>
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
    <div style={{ position: "relative", width: 200, height: 200 }}>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ display: "block", transform: "rotate(-90deg)" }}>
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
  const h = LENS_HIGHLIGHTS[id];
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

      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "flex-start" }}>
        <div>
          <div
            className="font-mono-feat"
            style={{ fontSize: 10, color: m.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}
          >
            {m.glyph} {m.name.toUpperCase()} LENS
          </div>
          <h3 className="re-h2" style={{ fontSize: 19, marginTop: 6, letterSpacing: "-0.015em", lineHeight: 1.3 }}>
            {h.insight}
          </h3>
          <div className="text-fg-muted" style={{ marginTop: 4, fontSize: 12.5 }}>{m.role}</div>

          <div style={{ marginTop: 16, display: "flex", gap: 14, flexWrap: "wrap" }}>
            {h.stats.map((s) => (
              <div key={s.k}>
                <div
                  className="font-mono-feat"
                  style={{ fontSize: 16, fontWeight: 600, color: m.color, fontVariantNumeric: "tabular-nums" }}
                >
                  {s.v}
                </div>
                <div
                  className="font-mono-feat text-fg-faint"
                  style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}
                >
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)", fontSize: 44, fontWeight: 500,
                letterSpacing: "-0.04em", color: m.color, lineHeight: 0.95,
              }}
            >
              {h.score}
            </div>
            <div className="font-mono-feat text-fg-faint" style={{ fontSize: 10, marginTop: 2 }}>/100</div>
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
            }}
          >
            Enter {m.name} <Icon name="arrow-right" size={11} />
          </span>
        </div>
      </div>
    </button>
  );
}

// ----------------------------------------------------------------------------
// ANCHOR QUOTE

function AnchorQuote({ q, theme, color }: { q: ScanQuote | undefined; theme: string; color: string }) {
  if (!q) return null;
  return (
    <div className="re-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, borderTop: `2px solid ${color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          className="font-mono-feat"
          style={{ fontSize: 10, color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
        >
          THEME · {theme.toUpperCase()}
        </span>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>{q.score}↑</span>
      </div>
      <p style={{ margin: 0, fontSize: 15, fontStyle: "italic", lineHeight: 1.55, color: "var(--fg)" }}>
        "{q.text}"
      </p>
      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
        {q.who} · {q.sub} · {q.when}
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
      style={{
        position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
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
            style={{
              border: 0,
              padding: "8px 14px",
              borderRadius: 99,
              cursor: "pointer",
              background: isActive ? m.color : isHov ? "rgba(255,255,255,0.08)" : "transparent",
              color: isActive ? "#fff" : "rgba(255,255,255,0.78)",
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
              letterSpacing: "0.02em",
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
