import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";

// Founder View — strategic decision dashboard.
// Answers: "Where is the opportunity, and what wedge should we attack?"
// UI only — mock data hardcoded. TODO(backend): replace FOUNDER_DATA when the
// strategy-synthesis endpoint ships.

type Tone = "pos" | "neg" | "warn" | "neu";
type Level = "high" | "medium" | "low";

interface ScoreFactor {
  key: string;
  value: number;
  tone: Tone;
  note: string;
}
interface CoverageSlice {
  id: string;
  name: string;
  weight: number;
}
interface Quote {
  text: string;
  who: string;
  sub: string;
  when: string;
  sentiment: number;
}
interface Insight {
  kind: string;
  title: string;
  quotes: Quote[];
}

const COMPETITOR = { name: "Linear", domain: "linear.app" };

const FOUNDER_DATA = {
  opportunity: {
    score: 82,
    label: "Strong opportunity",
    headline: "High pain frequency · clear feature gaps · moderate loyalty",
    factors: [
      { key: "Pain frequency", value: 0.86, tone: "neg", note: "187 mentions · top theme" },
      { key: "Gap severity", value: 0.79, tone: "warn", note: "3 named gaps, all recurring" },
      { key: "Switch intent", value: 0.64, tone: "warn", note: "14 explicit 'leaving' posts" },
      { key: "Competitor loyalty", value: 0.58, tone: "neu", note: "Strong on speed; users still stay" },
      { key: "Source confidence", value: 0.91, tone: "pos", note: "7 platforms · 1,247 mentions" },
    ] as ScoreFactor[],
    summary:
      "Users love Linear for speed, opinion, and shipping velocity — but repeatedly complain that pricing punishes growth, the mobile app is read-mostly, and executive roadmap views are absent. " +
      "The clearest wedge is a project tool that doesn't punish 15–80 person teams for growing, with native time tracking as a paid bolt-on for the agency segment.",
    coverage: [
      { id: "reddit", name: "Reddit", weight: 0.33 },
      { id: "g2", name: "G2", weight: 0.23 },
      { id: "linkedin", name: "LinkedIn", weight: 0.15 },
      { id: "producthunt", name: "Product Hunt", weight: 0.11 },
      { id: "twitter", name: "X", weight: 0.1 },
      { id: "hn", name: "Hacker News", weight: 0.05 },
      { id: "youtube", name: "YouTube", weight: 0.03 },
    ] as CoverageSlice[],
  },

  wedge: {
    title: "The project tool that doesn't punish you for growing",
    target: "15–80 person B2B teams · Series A–B",
    pain: "Per-seat math becomes painful between seat 15 and seat 30. Contractors and PMs pay full price for partial usage.",
    promise: "Predictable pricing that flattens as you grow — and pays for itself the day you hire a contractor.",
    why: "Pricing is the #1 reason 'leaving Linear' threads start, and the #1 quoted in r/SaaS. The math is the message.",
    evidence: { mentions: 187, threads: 42, sources: 5, confidence: 0.92 },
  },

  loves: [
    {
      id: "speed",
      title: "Speed and keyboard-first feel",
      explanation:
        "Users describe Linear as 'fast,' 'opinionated,' 'beautiful' — the keyboard-first UX is consistently named in praise threads.",
      quote: "The fastest tool I've ever touched. Cmd-K is muscle memory after a week.",
      who: "u/eng_manager_p · r/ExperiencedDevs",
      mentions: 312,
      sources: ["reddit", "g2", "hn", "linkedin"],
      implication: "Don't compete on speed. You will lose. Match the floor; differentiate elsewhere.",
    },
    {
      id: "integrations",
      title: "Integration ecosystem with eng tooling",
      explanation:
        "GitHub, GitLab, Slack, Figma — users repeatedly cite that Linear 'plugs into where work already happens.'",
      quote: "GitHub sync alone justifies the cost. It's the only PM tool that lives where my code lives.",
      who: "u/devops_dan · r/sysadmin",
      mentions: 198,
      sources: ["reddit", "g2", "producthunt"],
      implication: "Match GitHub/Slack on day one or you're not in the conversation. Treat as table stakes.",
    },
    {
      id: "opinion",
      title: "Strong opinions, trusted by technical teams",
      explanation:
        "The product's refusal to be everything-for-everyone is praised by senior engineers, who say it 'has taste.'",
      quote: "It does five things and does them better than anything. Refreshing in 2026.",
      who: "u/founder_h · r/SaaS",
      mentions: 142,
      sources: ["reddit", "hn"],
      implication: "Opinionated design wins technical buyers. Your wedge needs a sharp point of view too.",
    },
    {
      id: "ship",
      title: "Cycles model fits weekly shipping rhythm",
      explanation:
        "The two-week cycle model is described as the right primitive for product-led teams; users say it 'matches how they actually work.'",
      quote: "We dropped sprints. Cycles is just better. Whoever designed this has shipped before.",
      who: "u/startup_charlie · r/startups",
      mentions: 98,
      sources: ["reddit", "linkedin"],
      implication: "Cycles are sticky. Don't try to displace them — extend or integrate alongside.",
    },
  ],

  frustrations: [
    {
      id: "fr-pricing",
      title: "Pricing becomes painful past 15 seats",
      severity: "high" as Level,
      mentions: 187,
      sources: 5,
      delta: "+34%",
      quote: "Once we hit 22 people I started begging finance for a flat tier.",
      who: "u/founder_42 · r/SaaS",
      why: "Per-seat math compounds. Founders explicitly model 'pain inflection' at 15–25 seats.",
      opportunity: "Flat-tier or read-only-seats-free pricing. Strongest wedge in the report.",
    },
    {
      id: "fr-mobile",
      title: "Mobile app feels read-only",
      severity: "high" as Level,
      mentions: 134,
      sources: 4,
      delta: "+9%",
      quote: "If I'm not at my desk I just can't run standup. The mobile app is read-mostly.",
      who: "u/pm_mariana · r/ProductManagement",
      why: "Triage on phone is the #1 mobile use case, and Linear's app doesn't enable it.",
      opportunity: "Triage-first mobile (skim, assign, comment) — not parity. Wedge for managers on the go.",
    },
    {
      id: "fr-exec",
      title: "Executive roadmap view is missing",
      severity: "medium" as Level,
      mentions: 119,
      sources: 4,
      delta: "+22%",
      quote: "Our CEO opens Linear, closes it, and asks for a slide instead.",
      who: "u/pm_throwaway · r/ProductManagement",
      why: "Cycles model fits engineering; leadership wants quarterly dependencies and board-ready visuals.",
      opportunity: "Purpose-built executive view, generated from issues. Less Notion-drift, more 'open and present.'",
    },
    {
      id: "fr-time",
      title: "No native time tracking forces workarounds",
      severity: "medium" as Level,
      mentions: 152,
      sources: 4,
      delta: "+18%",
      quote: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak.",
      who: "u/contractor_v · r/ExperiencedDevs",
      why: "Agencies and consultancies need to bill clients per ticket. The workaround tax is real.",
      opportunity: "Native start/stop + Toggl import. Wins the agency segment outright.",
    },
  ],

  unmet: [
    { need: "Native time tracking", segment: "Agencies, consultancies", mentions: 412, sources: ["reddit", "g2", "hn", "producthunt"], level: "high" as Level, evidence: 0.91 },
    { need: "Gantt / dependency view", segment: "PM-leadership, exec teams", mentions: 298, sources: ["reddit", "linkedin", "g2"], level: "high" as Level, evidence: 0.84 },
    { need: "Public roadmap / changelog", segment: "B2B SaaS with customers", mentions: 241, sources: ["reddit", "producthunt"], level: "high" as Level, evidence: 0.78 },
    { need: "Granular per-project roles", segment: "Customer-facing teams", mentions: 187, sources: ["g2", "linkedin"], level: "medium" as Level, evidence: 0.72 },
    { need: "Recurring issues / templates", segment: "Ops & infra teams", mentions: 156, sources: ["reddit", "g2"], level: "medium" as Level, evidence: 0.69 },
    { need: "Offline-first mobile", segment: "Field & travelling teams", mentions: 77, sources: ["reddit", "twitter"], level: "low" as Level, evidence: 0.44 },
  ],

  pricing: {
    score: 74,
    main: "Per-seat math inflects between 15 and 30 paid seats",
    who: "Founders of 20–80 person teams, contractor-heavy orgs, finance leads",
    opportunity:
      "Transparent, predictable startup-friendly pricing. Inactive-seat discounts. SSO included in entry tier. Frame the comparison page around 30-seat math.",
    risk:
      "Users complain about price, but stay because GitHub/Slack integrations are deep. Pair pricing wedge with one-click migration tooling — don't compete only on price.",
    quotes: [
      { text: "Plus tier just to get SSO. Felt like a tax.", who: "u/pm_throwaway · r/ProductManagement" },
      { text: "Quoted $42k/yr for 180 seats. Same headcount in Jira would be a third.", who: "u/founder_42 · r/SaaS" },
    ],
  },

  risks: [
    {
      title: "Integration lock-in",
      level: "high" as Level,
      explanation:
        "Users complain about pricing, but stay because Linear connects deeply with GitHub, Slack, and Figma. Migration cost is real and named.",
      recommendation:
        "Do not compete only on price. Pair pricing with migration simplicity — auto-import GitHub issues, Slack channel mappings, Figma links.",
    },
    {
      title: "Brand trust with technical buyers",
      level: "high" as Level,
      explanation:
        "Linear has earned credibility with senior engineers. 'It has taste' shows up in praise threads from CTOs and staff engineers.",
      recommendation:
        "Win on a niche they don't serve (agencies, ops). Don't try to displace Linear in eng-first orgs in year one.",
    },
    {
      title: "Velocity moat",
      level: "medium" as Level,
      explanation:
        "Linear ships fast. Time-tracking, customer portal, and exec roadmap views are all rumored or shipping in beta — your wedges may narrow.",
      recommendation:
        "Validate the timeline before betting the roadmap. Pick wedges Linear is least likely to ship (pricing model, agency-native).",
    },
    {
      title: "Cycles muscle memory",
      level: "medium" as Level,
      explanation:
        "The two-week cycle model is praised and sticky. Teams that have internalized it will resist switching to a different primitive.",
      recommendation:
        "Don't reinvent the cycle. Match it as table stakes or extend it; differentiate elsewhere.",
    },
  ],

  actions: [
    {
      kind: "Product move",
      title: "Build pricing the day you build the product",
      why: "Pricing is the #1 outbound switching reason, named across 5 sources. The math is the wedge.",
      evidence: "187 mentions · +34% QoQ · 42 threads · 5 sources",
      confidence: 0.92,
      next: "Model 3 alternative pricing structures (flat-rate, active-seat, role-tiered) and write the comparison page first.",
    },
    {
      kind: "Positioning move",
      title: "Position against complexity-of-cost, not against features",
      why: "Linear's features are strong and praised. Attacking the feature set is a losing fight — attack the price-as-you-grow story instead.",
      evidence: "287 mentions of 'expensive,' 218 of 'per-seat,' 76 of 'SSO tax' · all trending up",
      confidence: 0.88,
      next: "Replace homepage hero with the seat-math comparison at 15 / 30 / 60 seats.",
    },
    {
      kind: "Growth move",
      title: "Engage the 14 'leaving Linear' threads with founder voice",
      why: "High-intent prospects are publicly signaling switch. Most threads are still hot on the front page.",
      evidence: "14 explicit-switch leads · 412 upvotes on the top thread · r/SaaS, r/ProductManagement",
      confidence: 0.84,
      next: "Reply in 3 threads this week (no pitch). Track the DM ratio. Open Outreach for the named users.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers

function coverageColor(id: string): string {
  return (
    (
      {
        reddit: "#ff5c1a",
        g2: "#dc2626",
        linkedin: "#0a66c2",
        producthunt: "#da552f",
        twitter: "#161412",
        hn: "#f59e0b",
        youtube: "#cc0000",
        "app store": "#0ea5e9",
      } as Record<string, string>
    )[id] ?? "var(--fg-muted)"
  );
}

function sourceName(id: string): string {
  return (
    (
      {
        reddit: "Reddit",
        g2: "G2",
        linkedin: "LinkedIn",
        producthunt: "Product Hunt",
        twitter: "X",
        hn: "Hacker News",
        youtube: "YouTube",
      } as Record<string, string>
    )[id] ?? id
  );
}

const eyebrow: CSSProperties = {
  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--fg-faint)",
};

const monoFaint: CSSProperties = {
  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
  color: "var(--fg-faint)",
};

// ─────────────────────────────────────────────────────────────────────────
// PAGE

export function FounderPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<Insight | null>(null);
  const [range, setRange] = useState("90d");

  const F = FOUNDER_DATA;
  const openEvidence = (insight: Insight) => setDrawer(insight);

  return (
    <div>
      {!embedded && (
        <FounderHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div style={{ padding: "22px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        <OpportunitySnapshot opportunity={F.opportunity} wedge={F.wedge} openEvidence={openEvidence} />

        <SectionHead
          eyebrow="01 · Strengths"
          title="What users love about Linear"
          subtitle="Know what not to underestimate. Match these or compete elsewhere."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {F.loves.map((s) => (
            <StrengthCard key={s.id} s={s} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHead
          eyebrow="02 · Weakness clusters"
          title="Where users are repeatedly frustrated"
          subtitle="Severity × frequency. Each cluster is a candidate wedge."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {F.frustrations.map((f) => (
            <FrustrationCard key={f.id} f={f} openEvidence={openEvidence} />
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {F.risks.map((r, i) => (
            <RiskCard key={i} r={r} />
          ))}
        </div>

        <SectionHead
          eyebrow="06 · Founder action plan"
          title="What to do this quarter"
          subtitle="Three moves, ranked by evidence. Each is anchored to a cluster above."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {F.actions.map((a, i) => (
            <ActionCard key={i} a={a} index={i} />
          ))}
        </div>

        <FounderFooter onNav={(to) => navigate(to)} />
      </div>

      <EvidenceDrawer insight={drawer} onClose={() => setDrawer(null)} />
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
    <div style={{ padding: "20px 28px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={eyebrow}>FOUNDER VIEW · STRATEGIC DECISION DASHBOARD</div>
            <h1 className="re-h1" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
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
            <p className="text-fg-muted" style={{ marginTop: 6, fontSize: 14, maxWidth: 720 }}>
              Find the market opening hidden inside competitor user conversations.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...monoFaint, fontSize: 11, marginRight: 4 }}>RANGE</span>
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
      <div style={{ ...eyebrow, fontSize: 10 }}>{eb}</div>
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
  opportunity: typeof FOUNDER_DATA.opportunity;
  wedge: typeof FOUNDER_DATA.wedge;
  openEvidence: (i: Insight) => void;
}

function OpportunitySnapshot({ opportunity: o, wedge, openEvidence }: OpportunitySnapshotProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,1.4fr) minmax(0,1.1fr)", gap: 14 }}>
      {/* SCORE */}
      <div className="re-card re-card-elev" style={{ overflow: "hidden", position: "relative" }}>
        <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.6, pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: 18 }}>
          <div style={{ ...eyebrow, fontSize: 10 }}>OPPORTUNITY SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span
              className="font-mono-feat tnum"
              style={{ fontSize: 76, fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 0.9, color: "var(--accent)" }}
            >
              {o.score}
            </span>
            <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span className="re-chip re-chip-accent" style={{ fontSize: 11 }}>
              {o.label}
            </span>
            <span style={{ ...monoFaint, fontSize: 11 }}>vs +12 last 90d</span>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.55 }}>{o.headline}</p>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "18px 0 12px" }} />

          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>SCORE FACTORS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {o.factors.map((f) => (
              <div key={f.key} style={{ display: "grid", gridTemplateColumns: "1fr 80px 40px", gap: 10, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{f.key}</div>
                  <div
                    style={{
                      ...monoFaint,
                      fontSize: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.note}
                  </div>
                </div>
                <div className={`re-meter ${f.tone === "neu" ? "" : f.tone}`}>
                  <i style={{ width: `${f.value * 100}%` }} />
                </div>
                <span className="font-mono-feat tnum" style={{ fontSize: 11, color: "var(--fg-muted)", textAlign: "right" }}>
                  {Math.round(f.value * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="re-card re-card-elev">
        <div className="re-card-hd">
          <h3>
            <Icon name="alert" size={14} /> Market opening summary
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            strategist's take · auto-synthesized
          </span>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", height: "calc(100% - 41px)" }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>{o.summary}</p>
          <div style={{ marginTop: 16 }}>
            <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>SOURCE COVERAGE</div>
            <CoverageBar coverage={o.coverage} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {o.coverage.map((c) => (
                <span key={c.id} className="re-chip" style={{ fontSize: 10 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: coverageColor(c.id),
                      marginRight: 4,
                    }}
                  />
                  {c.name} <span className="text-fg-faint">· {Math.round(c.weight * 100)}%</span>
                </span>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "auto", paddingTop: 16, display: "flex", gap: 8 }}>
            <button
              type="button"
              className="re-btn re-btn-sm"
              onClick={() =>
                openEvidence({
                  kind: "summary",
                  title: "Market opening summary",
                  quotes: [
                    {
                      text: "Once we hit 22 people I started begging finance for a flat tier.",
                      who: "u/founder_42",
                      sub: "r/SaaS",
                      when: "3d",
                      sentiment: -0.6,
                    },
                    {
                      text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear.",
                      who: "u/contractor_v",
                      sub: "r/ExperiencedDevs",
                      when: "1w",
                      sentiment: -0.5,
                    },
                    {
                      text: "Our CEO opens Linear, closes it, and asks for a slide instead.",
                      who: "u/pm_throwaway",
                      sub: "r/ProductManagement",
                      when: "2w",
                      sentiment: -0.45,
                    },
                  ],
                })
              }
            >
              <Icon name="quote" size={12} /> View evidence (1,247)
            </button>
            <button type="button" className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="external" size={12} /> Open in report
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
          background: "linear-gradient(180deg, rgba(255,92,26,0.06) 0%, var(--surface) 38%)",
          borderColor: "rgba(255,92,26,0.18)",
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
                fontSize: 10,
                fontWeight: 700,
                fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              }}
            >
              ★
            </span>
            Best wedge to attack
          </h3>
          <span className="re-chip re-chip-accent" style={{ fontSize: 10 }}>
            RECOMMENDED
          </span>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.3, letterSpacing: "-0.01em", fontStyle: "italic" }}>
            "{wedge.title}"
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <WedgeRow label="Target" value={wedge.target} />
            <WedgeRow label="Core pain" value={wedge.pain} />
            <WedgeRow label="Promise" value={wedge.promise} />
            <WedgeRow label="Why now" value={wedge.why} />
          </div>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "16px 0 12px" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <Tiny label="Mentions" value={wedge.evidence.mentions} />
            <Tiny label="Threads" value={wedge.evidence.threads} />
            <Tiny label="Sources" value={wedge.evidence.sources} />
            <Tiny label="Confidence" value={`${Math.round(wedge.evidence.confidence * 100)}%`} accent />
          </div>

          <button
            type="button"
            className="re-btn re-btn-accent re-btn-sm"
            style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
            onClick={() =>
              openEvidence({
                kind: "wedge",
                title: wedge.title,
                quotes: [
                  {
                    text: "Quoted $42k/yr for 180 seats. Same headcount in Jira would be a third.",
                    who: "u/founder_42",
                    sub: "r/SaaS",
                    when: "3d",
                    sentiment: -0.7,
                  },
                  {
                    text: "Plus tier just to get SSO. Felt like a tax.",
                    who: "u/pm_throwaway",
                    sub: "r/ProductManagement",
                    when: "5d",
                    sentiment: -0.55,
                  },
                  {
                    text: "Bought Linear for the speed. Annoyed by the price every time we grow.",
                    who: "u/startup_charlie",
                    sub: "r/startups",
                    when: "1w",
                    sentiment: -0.4,
                  },
                ],
              })
            }
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
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

function Tiny({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ padding: 8, border: "1px solid var(--border-soft)", borderRadius: 8, background: "var(--surface-solid)" }}>
      <div style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div
        className="font-mono-feat tnum"
        style={{ fontSize: 16, fontWeight: 500, marginTop: 2, color: accent ? "var(--accent)" : "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}

function CoverageBar({ coverage }: { coverage: CoverageSlice[] }) {
  return (
    <div style={{ height: 8, borderRadius: 99, overflow: "hidden", display: "flex", border: "1px solid var(--border-soft)" }}>
      {coverage.map((c, i) => (
        <div
          key={c.id}
          style={{
            width: `${c.weight * 100}%`,
            background: coverageColor(c.id),
            borderRight: i === coverage.length - 1 ? 0 : "1px solid rgba(255,255,255,0.4)",
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — STRENGTHS

interface StrengthCardProps {
  s: (typeof FOUNDER_DATA.loves)[number];
  openEvidence: (i: Insight) => void;
}

function StrengthCard({ s, openEvidence }: StrengthCardProps) {
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="re-dot re-dot-pos" />
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>STRENGTH</span>
        </div>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
          {s.mentions} mentions
        </span>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: "-0.005em" }}>{s.title}</h3>
        <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55 }}>
          {s.explanation}
        </p>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--surface-2)",
            borderRadius: 8,
            borderLeft: "2px solid var(--pos)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{s.quote}"</p>
          <div style={{ ...monoFaint, fontSize: 10, marginTop: 6 }}>{s.who}</div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>SOURCES</span>
          {s.sources.map((src) => (
            <span key={src} className="re-chip" style={{ fontSize: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: coverageColor(src),
                  marginRight: 4,
                }}
              />
              {sourceName(src)}
            </span>
          ))}
        </div>

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
            style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginTop: 1 }}
          >
            WHY THIS MATTERS
          </span>
          <span style={{ fontSize: 12, lineHeight: 1.5 }}>{s.implication}</span>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() =>
              openEvidence({
                kind: "strength",
                title: s.title,
                quotes: [
                  {
                    text: s.quote,
                    who: s.who.split(" · ")[0] ?? s.who,
                    sub: s.who.split(" · ")[1] ?? "",
                    when: "1w",
                    sentiment: 0.6,
                  },
                ],
              })
            }
          >
            View evidence <Icon name="arrow-right" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — FRUSTRATIONS

interface FrustrationCardProps {
  f: (typeof FOUNDER_DATA.frustrations)[number];
  openEvidence: (i: Insight) => void;
}

function FrustrationCard({ f, openEvidence }: FrustrationCardProps) {
  const sevColor = f.severity === "high" ? "var(--neg)" : f.severity === "medium" ? "var(--warn)" : "var(--fg-muted)";
  const sevBg =
    f.severity === "high"
      ? "rgba(220,38,38,.08)"
      : f.severity === "medium"
        ? "rgba(217,119,6,.08)"
        : "rgba(20,16,12,.04)";
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 99,
            fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            background: sevBg,
            color: sevColor,
          }}
        >
          {f.severity} severity
        </span>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
          {f.mentions} mentions · {f.sources} sources <span style={{ color: "var(--neg)" }}>{f.delta}</span>
        </span>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: "-0.005em" }}>{f.title}</h3>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--surface-2)",
            borderRadius: 8,
            borderLeft: `2px solid ${sevColor}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{f.quote}"</p>
          <div style={{ ...monoFaint, fontSize: 10, marginTop: 6 }}>{f.who}</div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 6 }}>
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2 }}>
            WHY
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{f.why}</span>
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2 }}>
            OPPORTUNITY
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>{f.opportunity}</span>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm">
            Compare to ours
          </button>
          <button
            type="button"
            className="re-btn re-btn-sm"
            onClick={() =>
              openEvidence({
                kind: "frustration",
                title: f.title,
                quotes: [
                  {
                    text: f.quote,
                    who: f.who.split(" · ")[0] ?? f.who,
                    sub: f.who.split(" · ")[1] ?? "",
                    when: "5d",
                    sentiment: -0.6,
                  },
                ],
              })
            }
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

interface UnmetNeedsTableProps {
  rows: typeof FOUNDER_DATA.unmet;
  openEvidence: (i: Insight) => void;
}

const UNMET_COLS = "minmax(220px,1.6fr) 1fr 90px 1.1fr 110px 90px";

function UnmetNeedsTable({ rows, openEvidence }: UnmetNeedsTableProps) {
  return (
    <div className="re-card">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: UNMET_COLS,
          padding: "10px 18px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--fg-faint)",
          gap: 12,
        }}
      >
        <span>Unmet need</span>
        <span>User segment</span>
        <span>Mentions</span>
        <span>Sources</span>
        <span>Opportunity</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const opColor = r.level === "high" ? "var(--accent)" : r.level === "medium" ? "var(--warn)" : "var(--fg-muted)";
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
              <div style={{ ...monoFaint, fontSize: 10, marginTop: 2 }}>evidence {r.evidence.toFixed(2)}</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{r.segment}</div>
            <div className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 500 }}>
              {r.mentions}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {r.sources.map((src) => (
                <span key={src} className="re-chip" style={{ fontSize: 9, padding: "1px 7px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: coverageColor(src),
                      marginRight: 3,
                    }}
                  />
                  {sourceName(src)}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 99,
                  background:
                    r.level === "high"
                      ? "var(--accent-soft)"
                      : r.level === "medium"
                        ? "rgba(217,119,6,.08)"
                        : "rgba(20,16,12,.04)",
                  color: opColor,
                  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                }}
              >
                {r.level}
              </span>
            </div>
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-sm"
              style={{ justifySelf: "end" }}
              onClick={() =>
                openEvidence({
                  kind: "unmet",
                  title: r.need,
                  quotes: [
                    {
                      text: `Repeated request from ${r.segment.toLowerCase()}. ${r.mentions} mentions across ${r.sources.length} platforms.`,
                      who: "summary",
                      sub: "",
                      when: "90d",
                      sentiment: -0.3,
                    },
                  ],
                })
              }
            >
              <Icon name="quote" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4 — PRICING OPPORTUNITY

interface PricingOpportunityProps {
  p: typeof FOUNDER_DATA.pricing;
  openEvidence: (i: Insight) => void;
}

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

function PricingOpportunity({ p, openEvidence }: PricingOpportunityProps) {
  return (
    <div
      className="re-card re-card-elev"
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0,1fr)", overflow: "hidden" }}
    >
      <div style={{ padding: 22, borderRight: "1px solid var(--border-soft)", position: "relative" }}>
        <div style={{ ...eyebrow, fontSize: 10 }}>PRICING PAIN SCORE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
          <span
            className="font-mono-feat tnum"
            style={{ fontSize: 64, fontWeight: 500, letterSpacing: "-0.03em", lineHeight: 0.9, color: "var(--warn)" }}
          >
            {p.score}
          </span>
          <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          <span className="re-chip re-chip-warn" style={{ marginLeft: 8, fontSize: 11 }}>
            Real wedge
          </span>
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, rowGap: 12 }}>
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2 }}>
            MAIN ISSUE
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg)" }}>{p.main}</span>

          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2 }}>
            WHO FEELS IT
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-muted)" }}>{p.who}</span>

          <span
            className="font-mono-feat"
            style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2, color: "var(--accent)" }}
          >
            OPPORTUNITY
          </span>
          <span style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg)" }}>{p.opportunity}</span>

          <span
            className="font-mono-feat"
            style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2, color: "var(--neg)" }}
          >
            RISK WARNING
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg-muted)" }}>{p.risk}</span>
        </div>

        <button
          type="button"
          className="re-btn re-btn-sm"
          style={{ marginTop: 18 }}
          onClick={() =>
            openEvidence({
              kind: "pricing",
              title: "Pricing pain — evidence",
              quotes: p.quotes.map((q) => ({
                text: q.text,
                who: q.who.split(" · ")[0] ?? q.who,
                sub: q.who.split(" · ")[1] ?? "",
                when: "1w",
                sentiment: -0.6,
              })),
            })
          }
        >
          <Icon name="quote" size={12} /> View {p.quotes.length} cost-related quotes
        </button>
      </div>

      <div style={{ padding: 22, background: "var(--surface-2)" }}>
        <div style={{ ...eyebrow, fontSize: 10 }}>PRICING VOCABULARY</div>
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

        <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "18px 0 14px" }} />

        <div style={{ ...eyebrow, fontSize: 10, marginBottom: 10 }}>QUOTE PREVIEW</div>
        {p.quotes.slice(0, 2).map((q, i) => (
          <div
            key={i}
            style={{
              padding: "10px 0",
              borderBottom: i === p.quotes.length - 1 ? 0 : "1px solid var(--border-soft)",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{q.text}"</p>
            <div style={{ ...monoFaint, fontSize: 10, marginTop: 4 }}>{q.who}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — STRATEGIC RISKS

function RiskCard({ r }: { r: (typeof FOUNDER_DATA.risks)[number] }) {
  const lvlColor = r.level === "high" ? "var(--neg)" : r.level === "medium" ? "var(--warn)" : "var(--fg-muted)";
  const lvlBg =
    r.level === "high"
      ? "rgba(220,38,38,.06)"
      : r.level === "medium"
        ? "rgba(217,119,6,.06)"
        : "rgba(20,16,12,.03)";
  return (
    <div className="re-card" style={{ borderLeft: `3px solid ${lvlColor}`, background: lvlBg }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="alert" size={14} style={{ color: lvlColor }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{r.title}</h3>
          </div>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 99,
              fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: "rgba(255,255,255,0.7)",
              color: lvlColor,
              border: `1px solid ${lvlColor}33`,
              fontWeight: 600,
            }}
          >
            RISK · {r.level}
          </span>
        </div>
        <p className="text-fg-muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
          {r.explanation}
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
          <span className="font-mono-feat" style={{ fontSize: 10, color: "var(--fg)", fontWeight: 600, marginTop: 1 }}>
            DO
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.recommendation}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 6 — ACTION PLAN

const ACTION_COLORS = ["#ff5c1a", "#6366f1", "#16a34a"];

function ActionCard({ a, index }: { a: (typeof FOUNDER_DATA.actions)[number]; index: number }) {
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
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {index + 1}
          </span>
          <span
            className="font-mono-feat"
            style={{ fontSize: 11, fontWeight: 600, color: c, textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            {a.kind}
          </span>
        </div>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 10 }}>
          {Math.round(a.confidence * 100)}% confidence
        </span>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, letterSpacing: "-0.005em", lineHeight: 1.3 }}>{a.title}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 8 }}>
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2 }}>
            WHY
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-muted)" }}>{a.why}</span>

          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2 }}>
            EVIDENCE
          </span>
          <span className="font-mono-feat" style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--fg)" }}>
            {a.evidence}
          </span>

          <span
            className="font-mono-feat"
            style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", paddingTop: 2, color: c, fontWeight: 600 }}
          >
            NEXT
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg)", fontWeight: 500 }}>{a.next}</span>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-soft)", display: "flex", gap: 6 }}>
          <button type="button" className="re-btn re-btn-sm" style={{ flex: 1, justifyContent: "center" }}>
            <Icon name="check" size={12} /> Add to plan
          </button>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm re-btn-icon">
            <Icon name="external" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER STRIP

function FounderFooter({ onNav }: { onNav: (to: string) => void }) {
  return (
    <div
      style={{
        marginTop: 50,
        padding: "22px 24px",
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
        background: "linear-gradient(135deg, rgba(255,92,26,0.06), rgba(99,102,241,0.04))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={eyebrow}>NORTH STAR</div>
        <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.5, maxWidth: 720, fontWeight: 500 }}>
          "Now I understand where Linear is strong, where users are frustrated, what the market wants, and what
          opportunity we can attack."
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="re-btn" onClick={() => onNav("/history")}>
          <Icon name="list" size={14} /> Open full report
        </button>
        <button type="button" className="re-btn re-btn-accent" onClick={() => onNav("/compare")}>
          <Icon name="compare" size={14} /> Compare to us
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EVIDENCE DRAWER (slide-in from right)

function EvidenceDrawer({ insight, onClose }: { insight: Insight | null; onClose: () => void }) {
  const open = !!insight;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!insight) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(20,16,12,0.18)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: 50,
          animation: "fadeUp 200ms ease",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(520px, 90vw)",
          background: "var(--surface-solid)",
          borderLeft: "1px solid var(--border-soft)",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
          animation: "founderDrawerIn 280ms cubic-bezier(.2,.7,.2,1)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ ...eyebrow, fontSize: 10 }}>EVIDENCE · {insight.kind.toUpperCase()}</div>
            <h3 className="re-h3" style={{ marginTop: 4, fontSize: 16 }}>
              {insight.title}
            </h3>
          </div>
          <button type="button" className="re-btn re-btn-ghost re-btn-icon re-btn-sm" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ overflow: "auto", padding: "16px 20px", flex: 1 }}>
          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 10 }}>VERBATIM QUOTES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {insight.quotes.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 8,
                  borderLeft: `3px solid ${q.sentiment > 0 ? "var(--pos)" : "var(--neg)"}`,
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontStyle: "italic", lineHeight: 1.55 }}>"{q.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 500 }}>
                    {q.who}
                  </span>
                  {q.sub && (
                    <>
                      <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
                      <span style={{ ...monoFaint, fontSize: 11 }}>{q.sub}</span>
                    </>
                  )}
                  <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
                  <span style={{ ...monoFaint, fontSize: 11 }}>{q.when}</span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="re-chip" style={{ fontSize: 9 }}>
                      sentiment {q.sentiment >= 0 ? "+" : ""}
                      {q.sentiment.toFixed(2)}
                    </span>
                    <span className="re-chip" style={{ fontSize: 9 }}>
                      conf {Math.round(Math.min(1, 0.7 + Math.abs(q.sentiment) * 0.3) * 100)}%
                    </span>
                  </span>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                  <button type="button" className="re-btn re-btn-ghost re-btn-sm">
                    <Icon name="external" size={12} /> Open source
                  </button>
                  <button type="button" className="re-btn re-btn-ghost re-btn-sm">
                    <Icon name="quote" size={12} /> Copy
                  </button>
                </div>
              </div>
            ))}
          </div>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "20px 0" }} />

          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 10 }}>SIGNAL METADATA</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Meta label="Signal type" value={insight.kind} />
            <Meta label="Related insight" value={insight.title} />
            <Meta label="First seen" value="2026-02-22" />
            <Meta label="Last seen" value="2026-05-12" />
            <Meta label="Velocity" value="+34% QoQ" tone="neg" />
            <Meta label="Source spread" value="5 platforms" />
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 8 }}>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm" onClick={onClose}>
            Close
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="re-btn re-btn-sm">
            <Icon name="download" size={12} /> Export quotes
          </button>
          <button type="button" className="re-btn re-btn-accent re-btn-sm">
            <Icon name="check" size={12} /> Pin to memo
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes founderDrawerIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: "neg" }) {
  return (
    <div style={{ padding: 10, border: "1px solid var(--border-soft)", borderRadius: 8, background: "var(--surface-2)" }}>
      <div style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div
        className="font-mono-feat"
        style={{ fontSize: 12, fontWeight: 500, marginTop: 3, color: tone === "neg" ? "var(--neg)" : "var(--fg)" }}
      >
        {value}
      </div>
    </div>
  );
}
