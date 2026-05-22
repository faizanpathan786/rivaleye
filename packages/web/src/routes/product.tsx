import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";

// Product / PM View — evidence-backed roadmap intelligence workspace.
// Answers: "What should we build, prioritize, improve, or avoid?"
// UI only — mock data hardcoded. TODO(backend): replace PRODUCT_DATA when the
// roadmap-synthesis endpoint ships.

type Tone = "pos" | "neg" | "warn" | "neu";
type Sev = "high" | "medium" | "low";
type Friction = "high" | "medium" | "low";
type Effort = "high" | "med" | "low";
type Rec = "Match" | "Learn" | "Differentiate" | "Ignore";

interface Quote {
  text: string;
  who: string;
  sub: string;
  when: string;
  sentiment: number;
  score?: number;
}
interface Gap {
  id: string;
  feature: string;
  mentions: number;
  sources: string[];
  severity: Sev;
  confidence: number;
  segment: string;
  action: string;
  summary: string;
  quotes: Quote[];
  relatedComplaint: string;
  requirement: string;
  effort: Effort;
  risk: Effort;
}
interface Insight {
  kind: string;
  title: string;
  quotes: Quote[];
  body?: Gap;
}

const COMPETITOR = { name: "Linear", domain: "linear.app" };

const PRODUCT_DATA = {
  score: {
    value: 78,
    label: "Strong roadmap opportunity",
    factors: [
      { key: "Feature gap frequency", value: 0.84, tone: "neg", note: "8 named gaps, 5 high-severity" },
      { key: "Pain severity", value: 0.79, tone: "neg", note: "3 themes account for 60% pain" },
      { key: "Source spread", value: 0.92, tone: "pos", note: "7 platforms · cross-validated" },
      { key: "User urgency", value: 0.71, tone: "warn", note: "14 explicit-switch posts" },
      { key: "Competitor love strength", value: 0.62, tone: "neu", note: "Speed & integrations are sticky" },
    ] as Array<{ key: string; value: number; tone: Tone; note: string }>,
    insight:
      "Users repeatedly ask for native time tracking, executive Gantt views, and a triage-first mobile experience. " +
      "Permissions and a public-facing changelog round out the top 5. The strongest evidence sits behind time tracking — it appears across Reddit, G2, HN, and Product Hunt with consistent agency framing.",
    focus:
      "Prioritize native time tracking and the executive roadmap view this half. Both anchor real complaint clusters and unlock distinct user segments (agencies, exec stakeholders).",
    coverage: ["reddit", "g2", "producthunt", "hn", "linkedin", "twitter", "youtube"],
  },

  gaps: [
    {
      id: "g-time",
      feature: "Native time tracking",
      mentions: 412,
      sources: ["reddit", "g2", "hn", "producthunt"],
      severity: "high",
      confidence: 0.91,
      segment: "Agencies, consultancies",
      action: "Explore as P0 — agency wedge",
      summary:
        "Bill-by-hour teams resort to Toggl, Harvest, or custom scripts. Workaround tax is named in every agency thread.",
      quotes: [
        {
          text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak.",
          who: "u/contractor_v",
          sub: "r/ExperiencedDevs",
          when: "1w",
          sentiment: -0.62,
          score: 174,
        },
        {
          text: "We literally use Linear for everything except logging hours. For that we open another tab. It's 2026.",
          who: "u/agency_lead",
          sub: "r/SaaS",
          when: "2w",
          sentiment: -0.55,
          score: 142,
        },
      ],
      relatedComplaint: "No native time tracking forces third-party hacks",
      requirement:
        "Native start/stop on any issue. Toggl + Harvest import. Per-issue billable rate. CSV export to invoicing tools.",
      effort: "med",
      risk: "low",
    },
    {
      id: "g-exec",
      feature: "Executive Gantt / dependency view",
      mentions: 298,
      sources: ["reddit", "linkedin", "g2"],
      severity: "high",
      confidence: 0.84,
      segment: "PM-leadership, exec teams",
      action: "Explore as P1 — leadership unlock",
      summary:
        "Cycles work for engineering, but board updates demand quarterly Gantt with dependencies. Teams maintain a parallel Notion or Miro.",
      quotes: [
        {
          text: "Our CEO opens Linear, closes it, and asks for a slide instead.",
          who: "u/pm_throwaway",
          sub: "r/ProductManagement",
          when: "2w",
          sentiment: -0.55,
          score: 287,
        },
        {
          text: "Cycles are great. Why is there no concept of 'this depends on that' in 2026?",
          who: "u/pm_mariana",
          sub: "r/ProductManagement",
          when: "5d",
          sentiment: -0.5,
          score: 287,
        },
      ],
      relatedComplaint: "Roadmap views are too rigid for execs",
      requirement: "Quarterly view with dependencies, milestone bands, and a 'present' mode.",
      effort: "high",
      risk: "med",
    },
    {
      id: "g-mobile",
      feature: "Triage-first mobile",
      mentions: 134,
      sources: ["reddit", "g2", "twitter"],
      severity: "high",
      confidence: 0.78,
      segment: "Managers on the go",
      action: "Explore as P0 — narrow scope",
      summary:
        "Don't ship parity — ship three actions: skim, assign, comment. The keyboard equivalents are the heart of the gripe.",
      quotes: [
        {
          text: "If I'm not at my desk I just can't run standup. The mobile app is read-mostly.",
          who: "u/pm_mariana",
          sub: "r/ProductManagement",
          when: "5d",
          sentiment: -0.55,
          score: 287,
        },
      ],
      relatedComplaint: "Mobile app feels like a viewer, not an editor",
      requirement: "Bulk assign on mobile, swipe-to-comment, offline queue, single-tap status change.",
      effort: "med",
      risk: "low",
    },
    {
      id: "g-perm",
      feature: "Granular per-project roles",
      mentions: 187,
      sources: ["g2", "linkedin", "reddit"],
      severity: "high",
      confidence: 0.86,
      segment: "Customer-facing teams (CS, sales)",
      action: "Explore as P1 — admin unlock",
      summary:
        "Stakeholders need scoped read or comment-only access. Today it's effectively all-or-nothing per workspace.",
      quotes: [
        {
          text: "I want my CSMs to file bugs without seeing the roadmap. Can't do that without giving them everything.",
          who: "u/founder_h",
          sub: "r/SaaS",
          when: "2w",
          sentiment: -0.5,
          score: 138,
        },
      ],
      relatedComplaint: "Limited granular permissions for stakeholders",
      requirement: "Per-project role matrix: view, comment, file, edit. Workspace inheritance with project overrides.",
      effort: "med",
      risk: "low",
    },
    {
      id: "g-portal",
      feature: "Customer-facing changelog & roadmap portal",
      mentions: 241,
      sources: ["reddit", "producthunt"],
      severity: "medium",
      confidence: 0.81,
      segment: "B2B SaaS with customers",
      action: "Explore as P1 — outbound moment",
      summary:
        "Teams maintain Notion in parallel; it drifts. A portal generated from issue labels closes the loop.",
      quotes: [
        {
          text: "We ship in Linear and announce in Notion. The two are always out of sync, customers notice.",
          who: "u/founder_h",
          sub: "r/SaaS",
          when: "2w",
          sentiment: -0.4,
          score: 138,
        },
      ],
      relatedComplaint: "No customer-facing changelog or portal",
      requirement: "Public roadmap auto-generated from labels. Customer email digest. RSS + JSON.",
      effort: "low",
      risk: "low",
    },
    {
      id: "g-tmpl",
      feature: "Recurring issues & templates",
      mentions: 156,
      sources: ["reddit", "g2"],
      severity: "medium",
      confidence: 0.69,
      segment: "Ops & infra teams",
      action: "Explore as P2",
      summary:
        "Repeating ops work (audits, on-call rotations, vendor reviews) currently requires manual duplication.",
      quotes: [
        {
          text: "Cron + Zapier to create our weekly on-call review. Should be a template.",
          who: "u/it_admin_t",
          sub: "r/sysadmin",
          when: "3w",
          sentiment: -0.4,
          score: 76,
        },
      ],
      relatedComplaint: "Repeating work needs manual duplication",
      requirement: "Issue templates with schedule (daily/weekly/monthly). Parameterized fields.",
      effort: "low",
      risk: "low",
    },
    {
      id: "g-flow",
      feature: "Custom workflow states per team",
      mentions: 92,
      sources: ["g2", "reddit"],
      severity: "medium",
      confidence: 0.62,
      segment: "QA, infra, security",
      action: "Explore as P2",
      summary:
        "Teams with non-eng workflows (QA flaky-tests, security review) want their own status pipeline.",
      quotes: [
        {
          text: "Test runs, regression cycles, flaky-test triage — none of this fits the cycle model.",
          who: "u/qa_engineer",
          sub: "r/cscareerquestions",
          when: "2w",
          sentiment: -0.5,
          score: 142,
        },
      ],
      relatedComplaint: "Custom views can't cross teams cleanly",
      requirement: "Per-team state machines. Cross-team views that bridge state taxonomies.",
      effort: "high",
      risk: "med",
    },
    {
      id: "g-offline",
      feature: "Offline-first mobile",
      mentions: 77,
      sources: ["reddit", "twitter"],
      severity: "low",
      confidence: 0.51,
      segment: "Field teams, travelling",
      action: "Backlog",
      summary: "Smaller cluster. Field teams want issues queued on airplane mode and synced on reconnect.",
      quotes: [
        {
          text: "I flew, came back, had to redo everything. There's no offline queue.",
          who: "u/field_pm",
          sub: "r/ProductManagement",
          when: "4w",
          sentiment: -0.35,
          score: 54,
        },
      ],
      relatedComplaint: "Mobile sync fails after airplane mode",
      requirement: "Local-first SQLite cache with CRDT sync.",
      effort: "high",
      risk: "high",
    },
  ] as Gap[],

  productAreas: [
    { area: "Onboarding", volume: 0.32, severity: 0.42, confidence: 0.71, spread: 0.55 },
    { area: "Performance", volume: 0.48, severity: 0.52, confidence: 0.78, spread: 0.62 },
    { area: "UX / navigation", volume: 0.41, severity: 0.38, confidence: 0.74, spread: 0.58 },
    { area: "Collaboration", volume: 0.62, severity: 0.66, confidence: 0.85, spread: 0.71 },
    { area: "Permissions / Admin", volume: 0.71, severity: 0.78, confidence: 0.88, spread: 0.74 },
    { area: "Integrations", volume: 0.36, severity: 0.32, confidence: 0.69, spread: 0.51 },
    { area: "Reporting / analytics", volume: 0.78, severity: 0.74, confidence: 0.86, spread: 0.79 },
    { area: "Pricing / packaging", volume: 0.92, severity: 0.88, confidence: 0.94, spread: 0.83 },
    { area: "Support / reliability", volume: 0.28, severity: 0.34, confidence: 0.65, spread: 0.42 },
    { area: "Mobile", volume: 0.66, severity: 0.71, confidence: 0.82, spread: 0.61 },
  ],

  clusterCards: [
    {
      title: "Permissions are confusing for growing teams",
      area: "Permissions / Admin",
      mentions: 96,
      severity: "high" as Sev,
      sources: ["reddit", "g2", "producthunt"],
      impact: "Blocks team adoption — CS and sales-side users can't get scoped access",
      response: "Simplify role matrix, ship per-project view/comment/file roles",
      trend: "+11%",
    },
    {
      title: "Reporting feels like a separate product",
      area: "Reporting / analytics",
      mentions: 119,
      severity: "high" as Sev,
      sources: ["reddit", "linkedin", "g2"],
      impact: "Leadership leaves Linear to assemble slides elsewhere",
      response: "Lightweight quarterly view, generated from issues",
      trend: "+22%",
    },
    {
      title: "Mobile triage is impossible",
      area: "Mobile",
      mentions: 134,
      severity: "high" as Sev,
      sources: ["reddit", "g2", "twitter"],
      impact: "Managers can't run standups or assign on the go",
      response: "Triage-first mobile: skim, assign, comment. Not parity.",
      trend: "+9%",
    },
    {
      title: "Old issues are hard to find",
      area: "Performance",
      mentions: 74,
      severity: "medium" as Sev,
      sources: ["reddit", "g2"],
      impact: "Engineers reopen duplicates because search misses old tickets",
      response: "Improve search ranking on age × partial title; add per-team scoping",
      trend: "+4%",
    },
  ],

  loves: [
    {
      feature: "Cmd-K command palette",
      why: "Users describe it as 'muscle memory after a week.' Speed and discoverability in one surface.",
      mentions: 312,
      rec: "Match" as Rec,
      lesson: "Keyboard-first navigation is the table-stakes for technical buyers. Match this on day one.",
    },
    {
      feature: "GitHub / Slack integrations",
      why: "Users repeatedly say Linear 'lives where my code lives.' Integration depth is a real lock-in.",
      mentions: 198,
      rec: "Match" as Rec,
      lesson: "Don't ship without these. They're not features, they're prerequisites for the buyer's shortlist.",
    },
    {
      feature: "Cycles (2-week shipping rhythm)",
      why: "Praised as the right primitive for product-led teams. 'Matches how we actually work.'",
      mentions: 142,
      rec: "Differentiate" as Rec,
      lesson:
        "Cycles are sticky. Don't replicate — find a different primitive (e.g. outcomes, bets) that serves the same job differently.",
    },
    {
      feature: "Opinionated, minimal UI",
      why: "Senior engineers praise the refusal to be everything-for-everyone. 'It has taste.'",
      mentions: 98,
      rec: "Learn" as Rec,
      lesson: "Take a sharp design POV. Resist enterprise checkbox-creep in v1.",
    },
    {
      feature: "Fast setup (under 10 minutes)",
      why: "New users land in a working project in minutes. Onboarding never feels heavy.",
      mentions: 76,
      rec: "Match" as Rec,
      lesson: "Onboarding is judged on first 10 minutes. Don't gate features behind a setup wizard.",
    },
    {
      feature: "Project status messaging",
      why: "Async status updates per project are praised as a Slack-thread replacement.",
      mentions: 54,
      rec: "Ignore" as Rec,
      lesson: "Niche praise; not load-bearing. Don't spend cycles here in v1.",
    },
  ],

  workflow: [
    {
      step: "Setup",
      friction: "low" as Friction,
      note: "Praised. Working project in <10m. Use as benchmark.",
      sample: "Onboarding took us seven minutes. I almost felt cheated by how easy it was.",
    },
    {
      step: "Invite team",
      friction: "medium" as Friction,
      note: "Per-seat math becomes visible during invite flow. Contractor tax mentioned.",
      sample: "Inviting a contractor for one ticket cost me a full seat for the month.",
    },
    {
      step: "Configure permissions",
      friction: "high" as Friction,
      note: "All-or-nothing per workspace. CS / sales can't be scoped.",
      sample: "I want my CSMs to file bugs without seeing the roadmap. Can't do that.",
    },
    {
      step: "Day-to-day triage",
      friction: "medium" as Friction,
      note: "Web is fast. Mobile drops the experience to read-mostly.",
      sample: "Web is a dream. Phone is a billboard.",
    },
    {
      step: "Report to leadership",
      friction: "high" as Friction,
      note: "Cycles don't map to quarterly. Teams export to slides or Miro.",
      sample: "Our CEO opens Linear, closes it, and asks for a slide instead.",
    },
    {
      step: "Share with customers",
      friction: "high" as Friction,
      note: "No public portal. Notion drift is the standard workaround.",
      sample: "We ship in Linear and announce in Notion. The two are always out of sync.",
    },
    {
      step: "Scale past 30 seats",
      friction: "high" as Friction,
      note: "Pricing becomes the conversation. SSO tax mentioned at Plus tier.",
      sample: "Once we hit 22 people I started begging finance for a flat tier.",
    },
  ],

  roadmap: [
    {
      title: "Native time tracking with Toggl import",
      problem:
        "Bill-by-hour teams maintain a parallel timesheet tool. Workaround tax is named in every agency thread.",
      feature: "Native start/stop on any issue, Toggl/Harvest import, per-issue billable rate, CSV export.",
      impact: "high" as Effort,
      effort: "med" as Effort,
      confidence: 0.91,
      why: "Anchors the agency wedge. Linear has no roadmap signal here — open lane.",
      anchor: "g-time",
    },
    {
      title: "Executive quarterly view",
      problem:
        "Cycles are loved by engineering but rejected by leadership. Boards demand Gantt + dependencies.",
      feature: "Quarterly Gantt with cross-project dependencies, milestone bands, and a single-keystroke present mode.",
      impact: "high" as Effort,
      effort: "high" as Effort,
      confidence: 0.84,
      why: "Solves the highest-evidence executive pain. Differentiates against Linear's eng-only narrative.",
      anchor: "g-exec",
    },
    {
      title: "Triage-first mobile",
      problem: "Mobile is the 'read-only' bottleneck. Managers can't run standup on a phone.",
      feature: "Three-action mobile: skim, assign, comment. Offline queue. Single-tap status change.",
      impact: "high" as Effort,
      effort: "med" as Effort,
      confidence: 0.78,
      why: "Don't aim for parity. The three actions ARE the wedge.",
      anchor: "g-mobile",
    },
    {
      title: "Per-project permission roles",
      problem:
        "Stakeholders (CS, sales, exec) need scoped read or comment-only access. Currently all-or-nothing.",
      feature: "Per-project role matrix (view, comment, file, edit). Workspace inheritance.",
      impact: "med" as Effort,
      effort: "med" as Effort,
      confidence: 0.86,
      why: "Unlocks customer-facing teams. Low-risk, high-leverage admin work.",
      anchor: "g-perm",
    },
    {
      title: "Public roadmap & changelog portal",
      problem: "B2B teams maintain Notion in parallel; it drifts. Customers notice.",
      feature: "Portal auto-generated from issue labels. Email digest. RSS + JSON feed.",
      impact: "med" as Effort,
      effort: "low" as Effort,
      confidence: 0.81,
      why: "Cheapest of the top 5. High visibility win.",
      anchor: "g-portal",
    },
  ],

  decisions: {
    build: [
      {
        title: "Native time tracking",
        reason: "412 mentions, agency wedge, no competitor signal yet.",
        confidence: 0.91,
        evidence: 412,
        quote: "Bill by the hour. Time tracking in Toggl. Work in Linear. They will never speak.",
      },
      {
        title: "Per-project permissions",
        reason: "Repeated CS/sales scaling pain. Admin unlocks customer-facing teams.",
        confidence: 0.86,
        evidence: 187,
        quote: "I want my CSMs to file bugs without seeing the roadmap. Can't do that.",
      },
      {
        title: "Triage-first mobile",
        reason: "Mobile is named #3 weakness. Three actions, not parity.",
        confidence: 0.78,
        evidence: 134,
        quote: "If I'm not at my desk I just can't run standup.",
      },
      {
        title: "Public changelog portal",
        reason: "Cheap win. Closes the Notion-drift workflow.",
        confidence: 0.81,
        evidence: 241,
        quote: "We ship in Linear and announce in Notion. Always out of sync.",
      },
    ],
    avoid: [
      {
        title: "Generic AI summaries",
        reason: "Saturated. No signal in user conversations.",
        confidence: 0.62,
        evidence: 12,
        quote: "Another tool with a 'summarize' button. I closed it.",
      },
      {
        title: "Enterprise governance UI",
        reason: "Users complain Linear is already 'too configurable.' Don't add knobs.",
        confidence: 0.74,
        evidence: 47,
        quote: "Linear has gotten more complex this year, not less.",
      },
      {
        title: "Whiteboarding canvas",
        reason: "Adjacent territory. Figma + Miro already own this surface.",
        confidence: 0.71,
        evidence: 22,
        quote: "We have FigJam. We don't need it inside our PM tool.",
      },
    ],
    learn: [
      {
        title: "Cmd-K everywhere",
        reason: "Praised by every technical reviewer. Speed is the floor.",
        confidence: 0.94,
        evidence: 312,
        quote: "Cmd-K is muscle memory after a week.",
      },
      {
        title: "GitHub-first integrations",
        reason: "Lives where code lives. Sets the buyer's shortlist.",
        confidence: 0.91,
        evidence: 198,
        quote: "GitHub sync alone justifies the cost.",
      },
      {
        title: "Opinionated minimal UI",
        reason: "Refusing checkbox-creep earns trust from senior engineers.",
        confidence: 0.83,
        evidence: 98,
        quote: "It does five things and does them better than anything.",
      },
    ],
  },
};

type DecisionItem = (typeof PRODUCT_DATA.decisions.build)[number];

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

const INDIGO = "#6366f1";

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

const labelMono = (overrides: CSSProperties = {}): CSSProperties => ({
  ...monoFaint,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  paddingTop: 2,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────
// PAGE

interface Filters {
  source: string;
  area: string;
  severity: string;
}

export function ProductPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<Insight | null>(null);
  const [range, setRange] = useState("90d");
  const [filters, setFilters] = useState<Filters>({ source: "all", area: "all", severity: "all" });

  const P = PRODUCT_DATA;
  const openEvidence = (insight: Insight) => setDrawer(insight);

  return (
    <div>
      {!embedded && (
        <ProductHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div style={{ padding: "22px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        <OpportunitySummary score={P.score} openEvidence={openEvidence} />

        <SectionHeadPM
          eyebrow="01 · Feature gap map"
          title="What users want that Linear doesn't solve"
          subtitle="Ranked by evidence × severity. Click any row for requirements, quotes, and risk."
          right={<FiltersStrip filters={filters} setFilters={setFilters} />}
        />
        <FeatureGapTable rows={P.gaps} openEvidence={openEvidence} />

        <SectionHeadPM
          eyebrow="02 · Complaint clusters by product area"
          title="Where the pain lives in the product"
          subtitle="Heatmap of pain density across PM-meaningful surfaces — followed by the loudest clusters."
        />
        <ProductAreaHeatmap rows={P.productAreas} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          {P.clusterCards.map((c, i) => (
            <ClusterCard key={i} c={c} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadPM
          eyebrow="03 · Loved competitor features"
          title="Learn from this"
          subtitle="What users praise. Tagged Match / Learn / Differentiate / Ignore to make the decision direct."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {P.loves.map((l, i) => (
            <LoveCard key={i} l={l} />
          ))}
        </div>

        <SectionHeadPM
          eyebrow="04 · Workflow friction"
          title="Where users get stuck in the journey"
          subtitle="The user lifecycle, with friction badges at each step and a representative quote."
        />
        <WorkflowJourney steps={P.workflow} />

        <SectionHeadPM
          eyebrow="05 · Roadmap opportunities"
          title="Convert signals into options"
          subtitle="Each opportunity ties to a feature gap above. Impact / effort / confidence on every card."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {P.roadmap.map((r, i) => (
            <RoadmapCard key={i} r={r} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadPM
          eyebrow="06 · Build / Avoid / Learn"
          title="The PM decision board"
          subtitle="Three columns. Direct, evidence-tied. Use this in your next roadmap review."
        />
        <BuildAvoidLearn d={P.decisions} openEvidence={openEvidence} />

        <ProductFooter onNav={(to) => navigate(to)} />
      </div>

      <EvidenceDrawer insight={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HEADER

interface ProductHeaderProps {
  competitor: { name: string; domain: string };
  range: string;
  setRange: (r: string) => void;
}

function ProductHeader({ competitor, range, setRange }: ProductHeaderProps) {
  return (
    <div style={{ padding: "20px 28px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={eyebrow}>PRODUCT VIEW · ROADMAP INTELLIGENCE</div>
            <h1 className="re-h1" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
              Product View
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
              Find what users want, what competitors miss, and what your roadmap can learn.
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
              <Icon name="download" size={14} /> Export to roadmap
            </button>
            <button type="button" className="re-btn re-btn-sm">
              <Icon name="share" size={14} /> Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeadPM({
  eyebrow: eb,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginTop: 44,
        marginBottom: 14,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ ...eyebrow, fontSize: 10 }}>{eb}</div>
        <h2 className="re-h2" style={{ marginTop: 6, fontSize: 22 }}>
          {title}
        </h2>
        <p className="text-fg-muted" style={{ margin: "4px 0 0", fontSize: 13, maxWidth: 680 }}>
          {subtitle}
        </p>
      </div>
      {right}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HERO

interface OpportunitySummaryProps {
  score: typeof PRODUCT_DATA.score;
  openEvidence: (i: Insight) => void;
}

function OpportunitySummary({ score, openEvidence }: OpportunitySummaryProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr)", gap: 14 }}>
      {/* Score */}
      <div className="re-card re-card-elev" style={{ position: "relative", overflow: "hidden" }}>
        <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: 18 }}>
          <div style={{ ...eyebrow, fontSize: 10 }}>PRODUCT OPPORTUNITY SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span
              className="font-mono-feat tnum"
              style={{ fontSize: 72, fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 0.9, color: INDIGO }}
            >
              {score.value}
            </span>
            <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <span
              className="re-chip"
              style={{
                fontSize: 11,
                color: INDIGO,
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.2)",
              }}
            >
              {score.label}
            </span>
          </div>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "18px 0 12px" }} />

          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>SCORE FACTORS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {score.factors.map((f) => (
              <div key={f.key} style={{ display: "grid", gridTemplateColumns: "1fr 70px 36px", gap: 10, alignItems: "center" }}>
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

      {/* Insight + Focus */}
      <div className="re-card re-card-elev">
        <div className="re-card-hd">
          <h3>
            <Icon name="alert" size={14} /> Top product insight
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            synthesized from 1,247 mentions
          </span>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, height: "calc(100% - 41px)" }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>{score.insight}</p>

          <div
            style={{
              padding: 14,
              background: "rgba(99,102,241,0.06)",
              border: "1px solid rgba(99,102,241,0.18)",
              borderRadius: 8,
            }}
          >
            <div style={{ ...eyebrow, fontSize: 10, color: INDIGO, marginBottom: 6 }}>RECOMMENDED FOCUS</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--fg)", fontWeight: 500 }}>{score.focus}</p>
          </div>

          <div>
            <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>SOURCE COVERAGE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {score.coverage.map((id) => (
                <span key={id} className="re-chip" style={{ fontSize: 10 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: coverageColor(id),
                      marginRight: 4,
                    }}
                  />
                  {sourceName(id)}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
            <button
              type="button"
              className="re-btn re-btn-sm"
              onClick={() =>
                openEvidence({
                  kind: "summary",
                  title: "Roadmap signals — top insight",
                  quotes: [
                    {
                      text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear.",
                      who: "u/contractor_v",
                      sub: "r/ExperiencedDevs",
                      when: "1w",
                      sentiment: -0.6,
                    },
                    {
                      text: "Our CEO opens Linear, closes it, and asks for a slide instead.",
                      who: "u/pm_throwaway",
                      sub: "r/ProductManagement",
                      when: "2w",
                      sentiment: -0.55,
                    },
                    {
                      text: "If I'm not at my desk I just can't run standup.",
                      who: "u/pm_mariana",
                      sub: "r/ProductManagement",
                      when: "5d",
                      sentiment: -0.5,
                    },
                  ],
                })
              }
            >
              <Icon name="quote" size={12} /> View 1,247 signals
            </button>
            <button type="button" className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="external" size={12} /> Open in full report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FILTERS STRIP

function FiltersStrip({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>
        FILTERS
      </span>
      <FilterChip
        label="Source"
        value={filters.source}
        opts={["all", "reddit", "g2", "hn", "producthunt", "linkedin"]}
        onChange={(v) => setFilters({ ...filters, source: v })}
      />
      <FilterChip
        label="Area"
        value={filters.area}
        opts={["all", "collab", "admin", "mobile", "reporting", "pricing"]}
        onChange={(v) => setFilters({ ...filters, area: v })}
      />
      <FilterChip
        label="Severity"
        value={filters.severity}
        opts={["all", "high", "medium", "low"]}
        onChange={(v) => setFilters({ ...filters, severity: v })}
      />
    </div>
  );
}

function FilterChip({
  label,
  value,
  opts,
  onChange,
}: {
  label: string;
  value: string;
  opts: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="re-chip" style={{ padding: "1px 4px 1px 9px", gap: 0 }}>
      <span className="text-fg-faint" style={{ fontSize: 10 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 0,
          background: "transparent",
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 11,
          color: "var(--fg)",
          padding: "2px 4px",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — FEATURE GAP TABLE

type SortKey = "mentions" | "confidence" | "severity";

const GAP_COLS = "minmax(220px,1.8fr) 90px 1.2fr 110px 110px 1.1fr 130px";

const sortBtn = (active: boolean): CSSProperties => ({
  border: 0,
  background: "transparent",
  color: active ? "var(--accent)" : "var(--fg-faint)",
  textAlign: "left",
  padding: 0,
  cursor: "pointer",
  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontWeight: 500,
});

function FeatureGapTable({ rows, openEvidence }: { rows: Gap[]; openEvidence: (i: Insight) => void }) {
  const [sortBy, setSortBy] = useState<SortKey>("mentions");

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "mentions") return b.mentions - a.mentions;
    if (sortBy === "confidence") return b.confidence - a.confidence;
    const order: Record<Sev, number> = { high: 3, medium: 2, low: 1 };
    return order[b.severity] - order[a.severity];
  });

  return (
    <div className="re-card">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: GAP_COLS,
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
        <button type="button" onClick={() => setSortBy("mentions")} style={sortBtn(sortBy === "mentions")}>
          Feature gap ↕
        </button>
        <button type="button" onClick={() => setSortBy("mentions")} style={sortBtn(sortBy === "mentions")}>
          Mentions ↕
        </button>
        <span>Sources</span>
        <button type="button" onClick={() => setSortBy("severity")} style={sortBtn(sortBy === "severity")}>
          Severity ↕
        </button>
        <button type="button" onClick={() => setSortBy("confidence")} style={sortBtn(sortBy === "confidence")}>
          Confidence ↕
        </button>
        <span>User segment</span>
        <span>Suggested action</span>
      </div>
      {sorted.map((g, i) => (
        <FeatureGapRow key={g.id} g={g} i={i} openEvidence={openEvidence} />
      ))}
    </div>
  );
}

function FeatureGapRow({ g, i, openEvidence }: { g: Gap; i: number; openEvidence: (i: Insight) => void }) {
  const sevColor = g.severity === "high" ? "var(--neg)" : g.severity === "medium" ? "var(--warn)" : "var(--fg-muted)";
  const sevBg =
    g.severity === "high"
      ? "rgba(220,38,38,.08)"
      : g.severity === "medium"
        ? "rgba(217,119,6,.08)"
        : "rgba(20,16,12,.04)";
  return (
    <div
      onClick={() => openEvidence({ kind: "feature-gap", title: g.feature, body: g, quotes: g.quotes })}
      style={{
        display: "grid",
        gridTemplateColumns: GAP_COLS,
        padding: "16px 18px",
        borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{g.feature}</div>
        <div style={{ ...monoFaint, fontSize: 10, marginTop: 2 }}>related: {g.relatedComplaint}</div>
      </div>
      <div className="font-mono-feat tnum" style={{ fontSize: 14, fontWeight: 500 }}>
        {g.mentions}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {g.sources.map((src) => (
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
      <div>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 99,
            background: sevBg,
            color: sevColor,
            fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}
        >
          {g.severity}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div className="re-meter" style={{ flex: 1 }}>
          <i
            style={{
              width: `${g.confidence * 100}%`,
              background: g.confidence > 0.8 ? "var(--pos)" : g.confidence > 0.6 ? "var(--warn)" : "var(--fg-muted)",
            }}
          />
        </div>
        <span className="font-mono-feat tnum" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          {Math.round(g.confidence * 100)}%
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{g.segment}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <span
          className="font-mono-feat"
          style={{
            fontSize: 11,
            color: g.action.includes("P0") ? "var(--accent)" : g.action.includes("P1") ? INDIGO : "var(--fg-muted)",
            fontWeight: 500,
          }}
        >
          {g.action.replace("Explore as ", "")}
        </span>
        <Icon name="chev-right" size={14} className="text-fg-faint" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — PRODUCT AREA HEATMAP

const HEAT_COLS = "minmax(180px, 1.4fr) repeat(4, 1fr)";

function ProductAreaHeatmap({ rows }: { rows: typeof PRODUCT_DATA.productAreas }) {
  const cols: Array<{ key: "volume" | "severity" | "confidence" | "spread"; label: string }> = [
    { key: "volume", label: "Volume" },
    { key: "severity", label: "Severity" },
    { key: "confidence", label: "Confidence" },
    { key: "spread", label: "Source spread" },
  ];
  const sorted = [...rows].sort((a, b) => b.volume + b.severity - (a.volume + a.severity));

  return (
    <div className="re-card" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: HEAT_COLS,
          padding: "10px 18px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--fg-faint)",
          gap: 14,
        }}
      >
        <span>Product area</span>
        {cols.map((c) => (
          <span key={c.key}>{c.label}</span>
        ))}
      </div>
      {sorted.map((r, i) => (
        <div
          key={r.area}
          style={{
            display: "grid",
            gridTemplateColumns: HEAT_COLS,
            padding: "10px 18px",
            borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>{r.area}</span>
          {cols.map((c) => (
            <HeatCell key={c.key} value={r[c.key]} />
          ))}
        </div>
      ))}
    </div>
  );
}

function HeatCell({ value }: { value: number }) {
  const op = 0.05 + value * 0.85;
  const bg = `rgba(255, 92, 26, ${op * 0.55})`;
  const labelColor = value > 0.7 ? "#fff" : "var(--fg)";
  return (
    <div
      style={{
        height: 28,
        borderRadius: 6,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px",
        border: `1px solid ${value > 0.7 ? "transparent" : "var(--border-soft)"}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        className="font-mono-feat tnum"
        style={{ fontSize: 12, fontWeight: 500, color: labelColor, position: "relative" }}
      >
        {Math.round(value * 100)}
      </span>
      <span
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: `${(1 - value) * 100}%`,
          background: "var(--surface-solid)",
          borderLeft: "1px solid var(--border-soft)",
        }}
      />
    </div>
  );
}

function ClusterCard({
  c,
  openEvidence,
}: {
  c: (typeof PRODUCT_DATA.clusterCards)[number];
  openEvidence: (i: Insight) => void;
}) {
  const sevColor = c.severity === "high" ? "var(--neg)" : c.severity === "medium" ? "var(--warn)" : "var(--fg-muted)";
  return (
    <div className="re-card">
      <div style={{ padding: "14px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="re-chip" style={{ fontSize: 10 }}>
          {c.area}
        </span>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
          {c.mentions} mentions · <span style={{ color: "var(--neg)" }}>{c.trend}</span>
        </span>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{c.title}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 8, rowGap: 8, marginTop: 12 }}>
          <span style={labelMono()}>SEVERITY</span>
          <span
            style={{
              fontSize: 12.5,
              color: sevColor,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
            }}
          >
            {c.severity}
          </span>

          <span style={labelMono()}>IMPACT</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{c.impact}</span>

          <span className="font-mono-feat" style={{ ...labelMono({ color: INDIGO }), fontWeight: 600 }}>
            RESPONSE
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>{c.response}</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {c.sources.map((src) => (
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
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() =>
              openEvidence({
                kind: "cluster",
                title: c.title,
                quotes: [
                  {
                    text: "Representative cluster quote — open the report for full thread context.",
                    who: "summary",
                    sub: c.area,
                    when: "90d",
                    sentiment: -0.5,
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
// SECTION 3 — LOVED FEATURES

const REC_STYLES: Record<Rec, { color: string; bg: string }> = {
  Match: { color: "var(--pos)", bg: "rgba(22,163,74,.08)" },
  Learn: { color: INDIGO, bg: "rgba(99,102,241,.08)" },
  Differentiate: { color: "var(--accent)", bg: "var(--accent-soft)" },
  Ignore: { color: "var(--fg-faint)", bg: "rgba(20,16,12,.04)" },
};

function LoveCard({ l }: { l: (typeof PRODUCT_DATA.loves)[number] }) {
  const rec = REC_STYLES[l.rec];
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column", borderTop: `3px solid ${rec.color}` }}>
      <div style={{ padding: "14px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 99,
              background: rec.bg,
              color: rec.color,
              fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            {l.rec}
          </span>
          <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
            {l.mentions} praise mentions
          </span>
        </div>

        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{l.feature}</h3>
        <p className="text-fg-muted" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55 }}>
          {l.why}
        </p>

        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: rec.bg,
            border: `1px dashed ${rec.color}55`,
          }}
        >
          <div
            className="font-mono-feat"
            style={{
              fontSize: 9,
              color: rec.color,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            PRODUCT LESSON
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)" }}>{l.lesson}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4 — WORKFLOW JOURNEY

function WorkflowJourney({ steps }: { steps: typeof PRODUCT_DATA.workflow }) {
  return (
    <div className="re-card" style={{ padding: 22 }}>
      <div style={{ position: "relative", paddingTop: 6, paddingBottom: 6 }}>
        <div
          style={{ position: "absolute", left: 22, right: 22, top: 32, height: 1, background: "var(--border-strong)", zIndex: 0 }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
            gap: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          {steps.map((s, i) => (
            <JourneyStep key={i} s={s} index={i} />
          ))}
        </div>
      </div>

      <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "22px 0 16px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "16px 130px 100px 1fr",
              gap: 14,
              alignItems: "center",
              padding: "8px 10px",
              background:
                s.friction === "high"
                  ? "rgba(220,38,38,0.03)"
                  : s.friction === "medium"
                    ? "rgba(217,119,6,0.03)"
                    : "transparent",
              borderRadius: 8,
            }}
          >
            <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 10 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.step}</span>
            <FrictionPill level={s.friction} />
            <span className="text-fg-muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              {s.note}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyStep({ s, index }: { s: (typeof PRODUCT_DATA.workflow)[number]; index: number }) {
  const color = s.friction === "high" ? "var(--neg)" : s.friction === "medium" ? "var(--warn)" : "var(--pos)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "0 4px" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 99,
          background: "var(--surface-solid)",
          border: `2px solid ${color}`,
          display: "grid",
          placeItems: "center",
          color,
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {index + 1}
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>{s.step}</div>
      <FrictionPill level={s.friction} />
    </div>
  );
}

const FRICTION_STYLES: Record<Friction, { c: string; bg: string }> = {
  high: { c: "var(--neg)", bg: "rgba(220,38,38,.10)" },
  medium: { c: "var(--warn)", bg: "rgba(217,119,6,.10)" },
  low: { c: "var(--pos)", bg: "rgba(22,163,74,.10)" },
};

function FrictionPill({ level }: { level: Friction }) {
  const map = FRICTION_STYLES[level];
  return (
    <span
      style={{
        padding: "1px 7px",
        borderRadius: 99,
        background: map.bg,
        color: map.c,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 700,
        width: "fit-content",
      }}
    >
      {level} friction
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — ROADMAP OPPORTUNITIES

function RoadmapCard({
  r,
  openEvidence,
}: {
  r: (typeof PRODUCT_DATA.roadmap)[number];
  openEvidence: (i: Insight) => void;
}) {
  const impactColor = r.impact === "high" ? "var(--accent)" : r.impact === "med" ? INDIGO : "var(--fg-muted)";
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.3 }}>{r.title}</h3>
        <span className="re-chip" style={{ fontSize: 10 }}>
          linked to gap
        </span>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 8 }}>
          <span style={labelMono()}>PROBLEM</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-muted)" }}>{r.problem}</span>

          <span style={labelMono()}>FEATURE</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg)", fontWeight: 500 }}>{r.feature}</span>

          <span className="font-mono-feat" style={{ ...labelMono({ color: impactColor }), fontWeight: 600 }}>
            WHY NOW
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg)" }}>{r.why}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <RoadmapStat label="Impact" value={r.impact} color={impactColor} />
          <RoadmapStat label="Effort" value={r.effort} color="var(--fg)" />
          <RoadmapStat label="Confidence" value={`${Math.round(r.confidence * 100)}%`} color="var(--pos)" />
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            type="button"
            className="re-btn re-btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() =>
              openEvidence({
                kind: "roadmap",
                title: r.title,
                quotes: [{ text: r.problem, who: "synthesis", sub: "", when: "90d", sentiment: -0.5 }],
              })
            }
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="check" size={12} /> Add to roadmap
          </button>
        </div>
      </div>
    </div>
  );
}

function RoadmapStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 8, border: "1px solid var(--border-soft)", borderRadius: 8, background: "var(--surface-solid)" }}>
      <div style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div className="font-mono-feat" style={{ fontSize: 13, fontWeight: 500, marginTop: 3, color, textTransform: "capitalize" }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 6 — BUILD / AVOID / LEARN

function BuildAvoidLearn({
  d,
  openEvidence,
}: {
  d: typeof PRODUCT_DATA.decisions;
  openEvidence: (i: Insight) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
      <DecisionColumn
        title="Build"
        items={d.build}
        color="var(--accent)"
        bg="rgba(255,92,26,0.05)"
        openEvidence={openEvidence}
      />
      <DecisionColumn
        title="Avoid"
        items={d.avoid}
        color="var(--neg)"
        bg="rgba(220,38,38,0.04)"
        openEvidence={openEvidence}
      />
      <DecisionColumn title="Learn" items={d.learn} color={INDIGO} bg="rgba(99,102,241,0.05)" openEvidence={openEvidence} />
    </div>
  );
}

function DecisionColumn({
  title,
  items,
  color,
  bg,
  openEvidence,
}: {
  title: string;
  items: DecisionItem[];
  color: string;
  bg: string;
  openEvidence: (i: Insight) => void;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
        background: bg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color }}>{title}</h3>
        </div>
        <span style={{ ...monoFaint, fontSize: 10 }}>{items.length} items</span>
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {items.map((it, i) => (
          <div
            key={i}
            onClick={() =>
              openEvidence({
                kind: title.toLowerCase(),
                title: it.title,
                quotes: [
                  {
                    text: it.quote,
                    who: "evidence",
                    sub: "",
                    when: "90d",
                    sentiment: title === "Avoid" ? -0.3 : title === "Learn" ? 0.5 : -0.5,
                  },
                ],
              })
            }
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--surface-solid)",
              border: "1px solid var(--border-soft)",
              cursor: "pointer",
              transition: "border-color 80ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${color}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-soft)";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{it.title}</h4>
              <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 10 }}>
                {it.evidence}
              </span>
            </div>
            <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5 }}>
              {it.reason}
            </p>
            <div
              style={{
                marginTop: 8,
                padding: "6px 8px",
                borderLeft: `2px solid ${color}`,
                fontSize: 11.5,
                fontStyle: "italic",
                lineHeight: 1.45,
                color: "var(--fg-muted)",
              }}
            >
              "{it.quote}"
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...monoFaint, fontSize: 10 }}>confidence</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, marginLeft: 8 }}>
                <div className="re-meter" style={{ flex: 1, height: 3 }}>
                  <i style={{ width: `${it.confidence * 100}%`, background: color }} />
                </div>
                <span className="font-mono-feat tnum" style={{ fontSize: 10, color }}>
                  {Math.round(it.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--border-soft)",
          textAlign: "center",
          background: "rgba(255,255,255,0.5)",
        }}
      >
        <button type="button" className="re-btn re-btn-ghost re-btn-sm">
          <Icon name="plus" size={12} /> Add {title.toLowerCase()} item
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER

function ProductFooter({ onNav }: { onNav: (to: string) => void }) {
  return (
    <div
      style={{
        marginTop: 50,
        padding: "22px 24px",
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
        background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(255,92,26,0.04))",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={eyebrow}>PM CHECKLIST</div>
        <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.5, maxWidth: 720, fontWeight: 500 }}>
          "I know what to build, what to skip, and which competitor strengths to respect — and every decision is anchored
          to a real quote."
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="re-btn" onClick={() => onNav("/history")}>
          <Icon name="list" size={14} /> Open full report
        </button>
        <button type="button" className="re-btn re-btn-accent">
          <Icon name="download" size={14} /> Export roadmap brief
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EVIDENCE DRAWER

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

  const gap = insight.body;

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
          animation: "productDrawerIn 280ms cubic-bezier(.2,.7,.2,1)",
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
          {gap && (
            <>
              <div style={{ ...eyebrow, fontSize: 10, marginBottom: 10 }}>WHAT TO BUILD</div>
              <div
                style={{
                  padding: 14,
                  background: "rgba(99,102,241,0.06)",
                  border: "1px solid rgba(99,102,241,0.18)",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--fg-muted)" }}>{gap.summary}</p>
                <div className="font-mono-feat" style={{ ...labelMono({ color: INDIGO, paddingTop: 0 }), marginTop: 12, fontWeight: 600 }}>
                  REQUIREMENT
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--fg)", fontWeight: 500 }}>
                  {gap.requirement}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <span className="re-chip" style={{ fontSize: 10 }}>
                    effort · {gap.effort}
                  </span>
                  <span className="re-chip" style={{ fontSize: 10 }}>
                    risk · {gap.risk}
                  </span>
                  <span className="re-chip" style={{ fontSize: 10 }}>
                    {gap.action.replace("Explore as ", "")}
                  </span>
                </div>
              </div>
            </>
          )}

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
                    {typeof q.score === "number" && (
                      <span className="re-chip" style={{ fontSize: 9 }}>
                        ▲ {q.score}
                      </span>
                    )}
                    <span className="re-chip" style={{ fontSize: 9 }}>
                      sentiment {q.sentiment >= 0 ? "+" : ""}
                      {q.sentiment.toFixed(2)}
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
            <Meta label="Source spread" value={gap ? `${gap.sources.length} platforms` : "5 platforms"} />
            <Meta label="Confidence" value={gap ? `${Math.round(gap.confidence * 100)}%` : "—"} />
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
            <Icon name="check" size={12} /> Add to roadmap
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes productDrawerIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, border: "1px solid var(--border-soft)", borderRadius: 8, background: "var(--surface-2)" }}>
      <div style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div className="font-mono-feat" style={{ fontSize: 12, fontWeight: 500, marginTop: 3, color: "var(--fg)" }}>
        {value}
      </div>
    </div>
  );
}
