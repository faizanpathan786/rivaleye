import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import { Icon } from "@/components/icons";
import { ConfidenceIndicator } from "@/components/dashboard/confidence-indicator";
import { ScoreFactors } from "@/components/dashboard/score-factors";
import { EvidenceDrawer } from "@/components/dashboard/evidence-drawer";
import {
  bucketFloat,
  confidencePercent,
  filterByDateRange,
  type Confidence,
  type EvidenceRef,
  type EvidenceSection,
} from "@/lib/dashboard-helpers";
import type {
  FounderViewProps,
  FounderScoreFactor,
} from "@/lib/dashboard-adapters/founder";

// Founder View — strategic decision dashboard.
// Answers: "Where is the opportunity, and what wedge should we attack?"
// Accepts an optional `data: FounderViewProps` prop (from the adapter).
// When `data` is undefined, falls back to the FOUNDER_DATA mock so that the
// standalone /founder design-demo route keeps working.

// ─────────────────────────────────────────────────────────────────────────
// Mock-fallback helpers

const EMPTY_REFS: EvidenceRef = {
  signal_ids: [],
  quote_ids: [],
  source_urls: [],
};

function mockConfidence(score: number): Confidence {
  return { score, label: bucketFloat(score), basis: null };
}

// ─────────────────────────────────────────────────────────────────────────
// Mock data (FOUNDER_DATA) — typed to match FounderViewProps
// Used only when no `data` prop is supplied (standalone /founder route).

const FOUNDER_DATA: FounderViewProps = {
  opportunity: {
    score: 82,
    label: "Strong opportunity",
    headline: "High pain frequency · clear feature gaps · moderate loyalty",
    factors: [
      { key: "pain_frequency", value: 0.86 },
      { key: "gap_severity", value: 0.79 },
      { key: "switch_intent", value: 0.64 },
      { key: "competitor_love_strength", value: 0.58 },
      { key: "source_confidence", value: 0.91 },
    ],
  },

  market_opening_summary: {
    summary:
      "Users love Linear for speed, opinion, and shipping velocity — but repeatedly complain that pricing punishes growth, the mobile app is read-mostly, and executive roadmap views are absent. " +
      "The clearest wedge is a project tool that doesn't punish 15–80 person teams for growing, with native time tracking as a paid bolt-on for the agency segment.",
    target: "15–80 person B2B SaaS teams · Series A–B",
    main_opportunity: "Flat-tier or role-tiered pricing for growing teams",
    why_now: "Pricing is the #1 reason 'leaving Linear' threads start",
    confidence: mockConfidence(0.88),
    evidence_refs: EMPTY_REFS,
  },

  loves: [
    {
      title: "Speed and keyboard-first feel",
      explanation:
        "Users describe Linear as 'fast,' 'opinionated,' 'beautiful' — the keyboard-first UX is consistently named in praise threads.",
      why_users_love_it: "Immediate responsiveness and muscle-memory shortcuts reduce friction.",
      implication: "Don't compete on speed. You will lose. Match the floor; differentiate elsewhere.",
      confidence: mockConfidence(0.91),
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Integration ecosystem with eng tooling",
      explanation:
        "GitHub, GitLab, Slack, Figma — users repeatedly cite that Linear 'plugs into where work already happens.'",
      why_users_love_it: "Code and project management converge in one workflow.",
      implication: "Match GitHub/Slack on day one or you're not in the conversation. Treat as table stakes.",
      confidence: mockConfidence(0.87),
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Strong opinions, trusted by technical teams",
      explanation:
        "The product's refusal to be everything-for-everyone is praised by senior engineers, who say it 'has taste.'",
      why_users_love_it: "Opinionated defaults eliminate decision fatigue for eng-led teams.",
      implication: "Opinionated design wins technical buyers. Your wedge needs a sharp point of view too.",
      confidence: mockConfidence(0.82),
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Cycles model fits weekly shipping rhythm",
      explanation:
        "The two-week cycle model is described as the right primitive for product-led teams; users say it 'matches how they actually work.'",
      why_users_love_it: "Cycles are simple, predictable, and free from Jira ceremony.",
      implication: "Cycles are sticky. Don't try to displace them — extend or integrate alongside.",
      confidence: mockConfidence(0.78),
      evidence_refs: EMPTY_REFS,
    },
  ],

  frustrations: [
    {
      title: "Pricing becomes painful past 15 seats",
      summary: "Per-seat math compounds. Founders explicitly model 'pain inflection' at 15–25 seats.",
      severity: 0.9,
      frequency: 187,
      opportunity_implication: "Flat-tier or read-only-seats-free pricing. Strongest wedge in the report.",
      confidence: mockConfidence(0.92),
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Mobile app feels read-only",
      summary: "Triage on phone is the #1 mobile use case, and Linear's app doesn't enable it.",
      severity: 0.8,
      frequency: 134,
      opportunity_implication: "Triage-first mobile (skim, assign, comment) — not parity. Wedge for managers on the go.",
      confidence: mockConfidence(0.84),
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Executive roadmap view is missing",
      summary: "Cycles model fits engineering; leadership wants quarterly dependencies and board-ready visuals.",
      severity: 0.65,
      frequency: 119,
      opportunity_implication: "Purpose-built executive view, generated from issues. Less Notion-drift, more 'open and present.'",
      confidence: mockConfidence(0.79),
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "No native time tracking forces workarounds",
      summary: "Agencies and consultancies need to bill clients per ticket. The workaround tax is real.",
      severity: 0.65,
      frequency: 152,
      opportunity_implication: "Native start/stop + Toggl import. Wins the agency segment outright.",
      confidence: mockConfidence(0.76),
      evidence_refs: EMPTY_REFS,
    },
  ],

  unmet: [
    { need: "Native time tracking", segment: "Agencies, consultancies", frequency: 412, source_spread: 4, opportunity_level: "high", evidence_refs: EMPTY_REFS },
    { need: "Gantt / dependency view", segment: "PM-leadership, exec teams", frequency: 298, source_spread: 3, opportunity_level: "high", evidence_refs: EMPTY_REFS },
    { need: "Public roadmap / changelog", segment: "B2B SaaS with customers", frequency: 241, source_spread: 2, opportunity_level: "high", evidence_refs: EMPTY_REFS },
    { need: "Granular per-project roles", segment: "Customer-facing teams", frequency: 187, source_spread: 2, opportunity_level: "medium", evidence_refs: EMPTY_REFS },
    { need: "Recurring issues / templates", segment: "Ops & infra teams", frequency: 156, source_spread: 2, opportunity_level: "medium", evidence_refs: EMPTY_REFS },
    { need: "Offline-first mobile", segment: "Field & travelling teams", frequency: 77, source_spread: 2, opportunity_level: "low", evidence_refs: EMPTY_REFS },
  ],

  wedge: {
    title: "The project tool that doesn't punish you for growing",
    target: "15–80 person B2B teams · Series A–B",
    pain: "Per-seat math becomes painful between seat 15 and seat 30. Contractors and PMs pay full price for partial usage.",
    promise: "Predictable pricing that flattens as you grow — and pays for itself the day you hire a contractor.",
    why: "Pricing is the #1 reason 'leaving Linear' threads start, and the #1 quoted in r/SaaS. The math is the message.",
    evidence_strength: "high",
    risk_level: "medium",
    evidence_refs: EMPTY_REFS,
  },

  pricing: {
    score: 0.74,
    main: "Per-seat math inflects between 15 and 30 paid seats",
    who: "Founders of 20–80 person teams, contractor-heavy orgs, finance leads",
    opportunity:
      "Transparent, predictable startup-friendly pricing. Inactive-seat discounts. SSO included in entry tier. Frame the comparison page around 30-seat math.",
    risk: "Users complain about price, but stay because GitHub/Slack integrations are deep. Pair pricing wedge with one-click migration tooling — don't compete only on price.",
    evidence_refs: EMPTY_REFS,
  },

  risks: [
    {
      title: "Integration lock-in",
      severity: 0.9,
      explanation:
        "Users complain about pricing, but stay because Linear connects deeply with GitHub, Slack, and Figma. Migration cost is real and named.",
      why_it_matters: "Even motivated switchers face real migration pain.",
      recommendation:
        "Do not compete only on price. Pair pricing with migration simplicity — auto-import GitHub issues, Slack channel mappings, Figma links.",
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Brand trust with technical buyers",
      severity: 0.85,
      explanation:
        "Linear has earned credibility with senior engineers. 'It has taste' shows up in praise threads from CTOs and staff engineers.",
      why_it_matters: "Brand trust is slow to build and hard to displace.",
      recommendation:
        "Win on a niche they don't serve (agencies, ops). Don't try to displace Linear in eng-first orgs in year one.",
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Velocity moat",
      severity: 0.6,
      explanation:
        "Linear ships fast. Time-tracking, customer portal, and exec roadmap views are all rumored or shipping in beta — your wedges may narrow.",
      why_it_matters: "A feature gap today may not exist in six months.",
      recommendation:
        "Validate the timeline before betting the roadmap. Pick wedges Linear is least likely to ship (pricing model, agency-native).",
      evidence_refs: EMPTY_REFS,
    },
    {
      title: "Cycles muscle memory",
      severity: 0.5,
      explanation:
        "The two-week cycle model is praised and sticky. Teams that have internalized it will resist switching to a different primitive.",
      why_it_matters: "Workflow primitives are deeply sticky once adopted.",
      recommendation:
        "Don't reinvent the cycle. Match it as table stakes or extend it; differentiate elsewhere.",
      evidence_refs: EMPTY_REFS,
    },
  ],

  actions: [
    {
      kind: "product",
      title: "Build pricing the day you build the product",
      why: "Pricing is the #1 outbound switching reason, named across 5 sources. The math is the wedge.",
      confidence: mockConfidence(0.92),
      evidence_refs: EMPTY_REFS,
    },
    {
      kind: "positioning",
      title: "Position against complexity-of-cost, not against features",
      why: "Linear's features are strong and praised. Attacking the feature set is a losing fight — attack the price-as-you-grow story instead.",
      confidence: mockConfidence(0.88),
      evidence_refs: EMPTY_REFS,
    },
    {
      kind: "growth",
      title: "Engage the 14 'leaving Linear' threads with founder voice",
      why: "High-intent prospects are publicly signaling switch. Most threads are still hot on the front page.",
      confidence: mockConfidence(0.84),
      evidence_refs: EMPTY_REFS,
    },
  ],
};

const COMPETITOR = { name: "Linear", domain: "linear.app" };

// ─────────────────────────────────────────────────────────────────────────
// Helpers

/** Convert FounderScoreFactor[] → Record<string, number> for <ScoreFactors>. */
function factorsToRecord(factors: FounderScoreFactor[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of factors) {
    out[f.key] = f.value;
  }
  return out;
}

/** Severity float → CSS color token. */
function severityColor(severity: number): string {
  const bucket = bucketFloat(severity);
  if (bucket === "high") return "var(--neg)";
  if (bucket === "medium") return "var(--warn)";
  return "var(--fg-muted)";
}

/** Severity float → background rgba. */
function severityBg(severity: number): string {
  const bucket = bucketFloat(severity);
  if (bucket === "high") return "rgba(220,38,38,.08)";
  if (bucket === "medium") return "rgba(217,119,6,.08)";
  return "rgba(20,16,12,.04)";
}

/** Severity float → label string. */
function severityLabel(severity: number): string {
  return bucketFloat(severity);
}

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
  fontSize: 12,
  textTransform: "none",
  letterSpacing: "0.1em",
  color: "var(--fg-faint)",
};

const monoFaint: CSSProperties = {
  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
  color: "var(--fg-faint)",
};

// ─────────────────────────────────────────────────────────────────────────
// PAGE

export function FounderPage({
  embedded = false,
  data,
  evidenceSection,
  range: propRange,
  competitorName,
  reportId,
}: {
  embedded?: boolean;
  data?: FounderViewProps;
  evidenceSection?: EvidenceSection | null;
  range?: string;
  competitorName?: string;
  reportId?: string;
}) {
  const navigate = useNavigate();
  const reportsQuery = useReportsQuery();
  const [drawerRefs, setDrawerRefs] = useState<EvidenceRef | null>(null);
  const [localRange, setLocalRange] = useState("90d");

  if (!embedded) {
    if (reportsQuery.isLoading) {
      return (
        <div className="flex flex-col gap-4 px-4 py-8 md:px-7 md:py-12" style={{ maxWidth: 800, margin: "0 auto" }}>
          <Skeleton className="h-8 w-full max-w-[240px]" />
          <Skeleton className="h-5 w-full max-w-[400px]" />
          <Skeleton className="h-5 w-full max-w-[320px]" />
        </div>
      );
    }

    const reports = reportsQuery.data ?? [];
    const completed = reports
      .filter((r) => r.status === "completed")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (completed.length > 0) {
      navigate("/scan-report/" + completed[0]!.id, { replace: true });
      return null;
    }

    if (reports.length > 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: "var(--fg)" }}>Your report is still processing — check back soon.</p>
          <a href="/history" style={{ fontSize: 14, color: "var(--accent)", textDecoration: "underline" }}>View History</a>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 12, textAlign: "center" }}>
        <p style={{ fontSize: 16, color: "var(--fg)" }}>No reports yet — run your first scan.</p>
        <a href="/scan" style={{ fontSize: 14, color: "var(--accent)", textDecoration: "underline" }}>Start a Scan</a>
      </div>
    );
  }

  // Use prop range if provided (embedded), otherwise local state
  const range = propRange ?? localRange;
  const setRange = (r: string) => {
    if (embedded) {
      // When embedded, parent controls range — but still allow local handler
      setLocalRange(r);
    } else {
      setLocalRange(r);
    }
  };

  if (embedded && data === undefined) {
    return (
      <div className="px-4 py-8 md:px-7 md:py-12" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
          Founder analysis not available — pipeline did not produce this section for the current report.
        </p>
      </div>
    );
  }

  const F = data ?? FOUNDER_DATA;
  const cName = competitorName ?? COMPETITOR.name;
  const openEvidence = (refs: EvidenceRef) => setDrawerRefs(refs);
  const closeEvidence = () => setDrawerRefs(null);

  return (
    <div>
      {!embedded && (
        <FounderHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div className="px-4 py-5 md:px-7 md:pt-[22px] md:pb-[60px]" style={{ maxWidth: 1440, margin: "0 auto" }}>
        <OpportunitySnapshot
          opportunity={F.opportunity}
          marketSummary={F.market_opening_summary}
          wedge={F.wedge}
          openEvidence={openEvidence}
        />

        <SectionHead
          eyebrow="01 · Strengths"
          title={`What users love about ${cName}`}
          subtitle="Know what not to underestimate. Match these or compete elsewhere."
        />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          {F.loves.map((s, i) => (
            <StrengthCard key={i} s={s} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHead
          eyebrow="02 · Weakness clusters"
          title="Where users are repeatedly frustrated"
          subtitle="Severity × frequency. Each cluster is a candidate wedge."
        />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          {F.frustrations.map((f, i) => (
            <FrustrationCard key={i} f={f} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHead
          eyebrow="03 · Unmet needs"
          title="What users ask for but don't get"
          subtitle="Repeated 'wish it had' mentions, clustered by segment."
        />
        <UnmetNeedsTable rows={F.unmet} openEvidence={openEvidence} />

        <SectionHead
          eyebrow="04 · Pricing opportunity"
          title="Is pricing a wedge?"
          subtitle="Where the price-pain conversation is loudest — and where it stops."
        />
        <PricingOpportunity p={F.pricing} openEvidence={openEvidence} />

        <SectionHead
          eyebrow="05 · Strategic risks"
          title="Why the competitor is hard to beat"
          subtitle="Don't only see the opening. See the moat."
        />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          {F.risks.map((r, i) => (
            <RiskCard key={i} r={r} />
          ))}
        </div>

        <SectionHead
          eyebrow="06 · Founder action plan"
          title="What to do this quarter"
          subtitle="Three moves, ranked by evidence. Each is anchored to a cluster above."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
          {F.actions.map((a, i) => (
            <ActionCard key={i} a={a} index={i} openEvidence={openEvidence} />
          ))}
        </div>
      </div>

      <EvidenceDrawer
        open={drawerRefs !== null}
        onClose={closeEvidence}
        refs={drawerRefs ?? EMPTY_REFS}
        evidenceSection={evidenceSection ?? null}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HEADER

interface FounderHeaderProps {
  competitor: { name: string; domain: string };
  range: string;
  setRange: (r: string) => void;
}

function FounderHeader({ competitor, range, setRange }: FounderHeaderProps) {
  return (
    <div className="px-4 pt-5 pb-3 md:px-7 md:pt-5 md:pb-[14px]" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <div style={eyebrow}>Founder view · strategic decision dashboard</div>
            <h1 className="re-h1 flex flex-wrap items-center" style={{ marginTop: 6, gap: 12 }}>
              Founder View
              <span
                style={{
                  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "var(--fg-faint)",
                  letterSpacing: 0,
                }}
              >
                · {competitor.name} <span style={{ color: "var(--fg-faint)" }}>{competitor.domain}</span>
              </span>
            </h1>
            <p className="text-fg-muted w-full" style={{ marginTop: 6, fontSize: 14, maxWidth: 720 }}>
              Find the market opening hidden inside competitor user conversations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span style={{ ...monoFaint, fontSize: 12, marginRight: 4 }}>Range</span>
            {["30d", "90d", "1y", "all"].map((r) => (
              <button
                key={r}
                type="button"
                className={`re-chip ${range === r ? "re-chip-solid" : ""}`}
                style={{ cursor: "pointer", padding: "3px 10px" }}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
            <span style={{ width: 1, height: 18, background: "var(--border-soft)", margin: "0 6px" }} />
            <button type="button" className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="download" size={14} /> Export memo
            </button>
            <button type="button" className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="share" size={14} /> Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION HEAD

function SectionHead({ eyebrow: eb, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: 44, marginBottom: 14 }}>
      <div style={{ ...eyebrow, fontSize: 11 }}>{eb}</div>
      <h2 className="re-h2" style={{ marginTop: 6, fontSize: 22 }}>
        {title}
      </h2>
      <p className="text-fg-muted" style={{ margin: "4px 0 0", fontSize: 13, maxWidth: 680 }}>
        {subtitle}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HERO — OPPORTUNITY SNAPSHOT

interface OpportunitySnapshotProps {
  opportunity: FounderViewProps["opportunity"];
  marketSummary: FounderViewProps["market_opening_summary"];
  wedge: FounderViewProps["wedge"];
  openEvidence: (refs: EvidenceRef) => void;
}

function OpportunitySnapshot({ opportunity: o, marketSummary, wedge, openEvidence }: OpportunitySnapshotProps) {
  const factorsRecord = factorsToRecord(o.factors);

  return (
    <div
      className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,1.05fr)_minmax(0,1.4fr)_minmax(0,1.1fr)]"
      style={{ gap: 14 }}
    >
      {/* SCORE */}
      <div className="re-card re-card-elev" style={{ position: "relative" }}>
        <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.6, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }} />
        <div style={{ position: "relative", padding: 18 }}>
          <div style={{ ...eyebrow, fontSize: 11, letterSpacing: "0.02em" }}>Opportunity score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span
              className="font-mono-feat tnum"
              style={{ fontSize: "clamp(56px, 14vw, 76px)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 0.9, color: "var(--accent)" }}
            >
              {o.score}
            </span>
            <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span className="re-chip re-chip-accent" style={{ fontSize: 12 }}>
              {o.label}
            </span>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>{o.headline}</p>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "18px 0 12px" }} />

          <div style={{ ...eyebrow, fontSize: 11, letterSpacing: "0.02em", marginBottom: 8 }}>Score factors</div>
          <ScoreFactors factors={factorsRecord} />
        </div>
      </div>

      {/* MARKET OPENING SUMMARY */}
      <div className="re-card re-card-elev">
        <div className="re-card-hd">
          <h3>
            <Icon name="alert" size={14} /> Market opening summary
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>
            strategist's take · auto-synthesized
          </span>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", height: "calc(100% - 41px)" }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>{marketSummary.summary}</p>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "clamp(60px, 15vw, 100px) 1fr", gap: 8, rowGap: 8 }}>
            <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2 }}>Target</span>
            <span style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>{marketSummary.target}</span>
            <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2 }}>Opportunity</span>
            <span style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.6 }}>{marketSummary.main_opportunity}</span>
            <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2 }}>Why now</span>
            <span style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>{marketSummary.why_now}</span>
          </div>

          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em" }}>Confidence</span>
            <ConfidenceIndicator confidence={marketSummary.confidence} />
          </div>

          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 8 }}>
            <button
              type="button"
              className="re-btn re-btn-sm"
              onClick={() => openEvidence(marketSummary.evidence_refs)}
            >
              <Icon name="quote" size={12} /> View evidence
            </button>
          </div>
        </div>
      </div>

      {/* WEDGE */}
      <div
        className="re-card re-card-elev"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, transparent) 0%, var(--surface) 40%)",
          borderColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 className="re-h3" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                background: "var(--accent)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              }}
            >
              ★
            </span>
            Best wedge to attack
          </h3>
          <span className="re-chip re-chip-accent" style={{ fontSize: 11 }}>
            Recommended
          </span>
        </div>
        <div style={{ padding: 18 }}>
          <div className="break-words" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-0.01em", fontStyle: "italic" }}>
            "{wedge.title}"
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <WedgeRow label="Target" value={wedge.target} />
            <WedgeRow label="Core pain" value={wedge.pain} />
            <WedgeRow label="Promise" value={wedge.promise} />
            <WedgeRow label="Why now" value={wedge.why} />
          </div>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "16px 0 12px" }} />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em" }}>Evidence strength</span>
            <span
              className="re-chip"
              style={{
                fontSize: 11,
                textTransform: "capitalize",
                color:
                  wedge.evidence_strength === "high"
                    ? "var(--pos)"
                    : wedge.evidence_strength === "medium"
                      ? "var(--warn)"
                      : "var(--fg-muted)",
              }}
            >
              {wedge.evidence_strength}
            </span>
          </div>

          <button
            type="button"
            className="re-btn re-btn-accent re-btn-sm"
            style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
            onClick={() => openEvidence(wedge.evidence_refs)}
          >
            See the proof <Icon name="arrow-right" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function WedgeRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10 }}>
      <span
        style={{
          ...monoFaint,
          fontSize: 11,
          textTransform: "none",
          letterSpacing: "0.08em",
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, color: "var(--fg)", lineHeight: 1.6 }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — STRENGTHS

function StrengthCard({
  s,
  openEvidence,
}: {
  s: FounderViewProps["loves"][number];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="re-dot re-dot-pos" />
          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em" }}>Strength</span>
        </div>
        <ConfidenceIndicator confidence={s.confidence} />
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: "-0.005em" }}>{s.title}</h3>
        <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6 }}>
          {s.explanation}
        </p>
        <p className="text-fg-muted" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.6, fontStyle: "italic" }}>
          {s.why_users_love_it}
        </p>

        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(20,16,12,0.03)",
            border: "1px dashed var(--border-strong)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span
            className="font-mono-feat"
            style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600, marginTop: 1 }}
          >
            WHY THIS MATTERS
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.6 }}>{s.implication}</span>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => openEvidence(s.evidence_refs)}
          >
            Evidence <Icon name="arrow-right" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — FRUSTRATIONS

function FrustrationCard({
  f,
  openEvidence,
}: {
  f: FounderViewProps["frustrations"][number];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const sevColor = severityColor(f.severity);
  const sevBg = severityBg(f.severity);
  const sevLbl = severityLabel(f.severity);

  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 99,
            fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
            fontSize: 11,
            textTransform: "none",
            letterSpacing: "0.06em",
            background: sevBg,
            color: sevColor,
          }}
        >
          {sevLbl} severity
        </span>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 12 }}>
          {f.frequency} mentions
        </span>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: "-0.005em" }}>{f.title}</h3>

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 6 }}>
          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.08em", paddingTop: 2 }}>
            WHY
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>{f.summary}</span>
          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.08em", paddingTop: 2 }}>
            OPPORTUNITY
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--fg)", fontWeight: 500 }}>{f.opportunity_implication}</span>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em" }}>Confidence</span>
          <ConfidenceIndicator confidence={f.confidence} />
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-sm"
            onClick={() => openEvidence(f.evidence_refs)}
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 3 — UNMET NEEDS

const UNMET_COLS = "minmax(220px,1.6fr) 1fr 90px 90px 110px 90px";

function UnmetNeedsTable({
  rows,
  openEvidence,
}: {
  rows: FounderViewProps["unmet"];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card overflow-x-auto">
      <div style={{ minWidth: 690 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: UNMET_COLS,
          padding: "10px 18px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 11,
          textTransform: "none",
          letterSpacing: "0.08em",
          color: "var(--fg-faint)",
          gap: 12,
        }}
      >
        <span>Unmet need</span>
        <span>User segment</span>
        <span>Frequency</span>
        <span>Sources</span>
        <span>Opportunity</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const opColor =
          r.opportunity_level === "high"
            ? "var(--accent)"
            : r.opportunity_level === "medium"
              ? "var(--warn)"
              : "var(--fg-muted)";
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: UNMET_COLS,
              padding: "14px 18px",
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{r.need}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{r.segment}</div>
            <div className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 500 }}>
              {r.frequency}
            </div>
            <div className="font-mono-feat tnum" style={{ fontSize: 13, color: "var(--fg-muted)" }}>
              {r.source_spread}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 99,
                  background:
                    r.opportunity_level === "high"
                      ? "var(--accent-soft)"
                      : r.opportunity_level === "medium"
                        ? "rgba(217,119,6,.08)"
                        : "rgba(20,16,12,.04)",
                  color: opColor,
                  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
                  fontSize: 11,
                  textTransform: "none",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                {r.opportunity_level}
              </span>
            </div>
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-sm"
              style={{ justifySelf: "end" }}
              onClick={() => openEvidence(r.evidence_refs)}
            >
              <Icon name="quote" size={12} />
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4 — PRICING OPPORTUNITY

const PRICING_VOCAB: Array<[string, number]> = [
  ["expensive", 22],
  ["per-seat", 26],
  ["SSO tax", 20],
  ["Plus tier", 16],
  ["contractor", 18],
  ["scale", 18],
  ["startup", 14],
  ["procurement", 12],
  ["budget", 16],
  ["finance", 14],
  ["Jira cheaper", 22],
];

function PricingOpportunity({
  p,
  openEvidence,
}: {
  p: FounderViewProps["pricing"];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const displayScore = Math.round(confidencePercent({ score: p.score, label: bucketFloat(p.score), basis: null }));

  return (
    <div
      className="re-card re-card-elev grid grid-cols-1 md:[grid-template-columns:minmax(0,1.2fr)_minmax(0,1fr)]"
      style={{ overflow: "hidden" }}
    >
      <div className="border-b border-[var(--border-soft)] md:border-b-0 md:border-r" style={{ padding: 22, borderRightColor: "var(--border-soft)", position: "relative" }}>
        <div style={{ ...eyebrow, fontSize: 11, letterSpacing: "0.02em" }}>Pricing pain score</div>
        <div className="flex flex-wrap items-baseline" style={{ gap: 8, marginTop: 6 }}>
          <span
            className="font-mono-feat tnum"
            style={{ fontSize: "clamp(48px, 12vw, 64px)", fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 0.9, color: "var(--warn)" }}
          >
            {displayScore}
          </span>
          <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          <span className="re-chip re-chip-warn" style={{ marginLeft: 8, fontSize: 12 }}>
            Real wedge
          </span>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, rowGap: 12 }}>
          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2 }}>
            Main issue
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg)" }}>{p.main}</span>

          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2 }}>
            Who feels it
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)" }}>{p.who}</span>

          <span
            className="font-mono-feat"
            style={{ fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2, color: "var(--accent)" }}
          >
            Opportunity
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg)" }}>{p.opportunity}</span>

          {p.risk && (
            <>
              <span
                className="font-mono-feat"
                style={{ fontSize: 11, textTransform: "none", letterSpacing: "0.02em", paddingTop: 2, color: "var(--neg)" }}
              >
                Risk warning
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)" }}>{p.risk}</span>
            </>
          )}
        </div>

        <button
          type="button"
          className="re-btn re-btn-sm"
          style={{ marginTop: 18 }}
          onClick={() => openEvidence(p.evidence_refs)}
        >
          <Icon name="quote" size={12} /> View pricing evidence
        </button>
      </div>

      <div style={{ padding: 22, background: "var(--surface-2)" }}>
        <div style={{ ...eyebrow, fontSize: 11, letterSpacing: "0.02em" }}>Pricing vocabulary</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline", marginTop: 10 }}>
          {PRICING_VOCAB.map(([w, s]) => (
            <span
              key={w}
              className="font-mono-feat"
              style={{
                fontSize: s,
                color: s > 20 ? "var(--accent)" : s > 16 ? "var(--fg)" : "var(--fg-muted)",
                lineHeight: 1.4,
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — STRATEGIC RISKS

function RiskCard({ r }: { r: FounderViewProps["risks"][number] }) {
  const lvlColor = severityColor(r.severity);
  return (
    <div className="re-card">
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Icon name="alert" size={14} style={{ color: lvlColor, flexShrink: 0 }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{r.title}</h3>
          </div>
          <span
            className="shrink-0"
            style={{
              padding: "2px 9px",
              borderRadius: 99,
              fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              fontSize: 11,
              textTransform: "capitalize",
              letterSpacing: "0.02em",
              background: `color-mix(in srgb, ${lvlColor} 13%, transparent)`,
              color: lvlColor,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Risk · {severityLabel(r.severity)}
          </span>
        </div>
        <p className="text-fg-muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          {r.explanation}
        </p>
        <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.6 }}>
          {r.why_it_matters}
        </p>
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--surface-solid)",
            border: "1px solid var(--border-soft)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginTop: 1 }}>
            DO
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.6 }}>{r.recommendation}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 6 — ACTION PLAN

const ACTION_COLORS = ["#0061B1", "#6366f1", "#16a34a"];
const ACTION_KIND_LABEL: Record<FounderViewProps["actions"][number]["kind"], string> = {
  product: "Product move",
  positioning: "Positioning move",
  growth: "Growth move",
};

function ActionCard({
  a,
  index,
  openEvidence,
}: {
  a: FounderViewProps["actions"][number];
  index: number;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const c = ACTION_COLORS[index % ACTION_COLORS.length]!;
  return (
    <div className="re-card re-card-elev" style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-soft)",
          background: `linear-gradient(90deg, ${c}10, transparent 60%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: c,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {index + 1}
          </span>
          <span
            className="font-mono-feat"
            style={{ fontSize: 12, fontWeight: 600, color: c, textTransform: "none", letterSpacing: "0.06em" }}
          >
            {ACTION_KIND_LABEL[a.kind]}
          </span>
        </div>
        <ConfidenceIndicator confidence={a.confidence} />
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3 }}>{a.title}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 8 }}>
          <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.08em", paddingTop: 2 }}>
            WHY
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--fg-muted)" }}>{a.why}</span>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-soft)", display: "flex", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm re-btn-icon"
            onClick={() => openEvidence(a.evidence_refs)}
          >
            <Icon name="quote" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER STRIP

