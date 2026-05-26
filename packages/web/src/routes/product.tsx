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
  filterByDateRange,
  type Confidence,
  type EvidenceRef,
  type EvidenceSection,
} from "@/lib/dashboard-helpers";
import type {
  ProductViewProps,
  AdaptedFeatureGap,
  AdaptedLovedFeature,
  AdaptedWorkflowStep,
  AdaptedRoadmapItem,
  AdaptedBuildAvoidLearnItem,
  HeatmapRow,
} from "@/lib/dashboard-adapters/product";

// Product / PM View — evidence-backed roadmap intelligence workspace.
// Answers: "What should we build, prioritize, improve, or avoid?"
// Accepts optional `data: ProductViewProps` prop (from the adapter).
// Falls back to PRODUCT_DATA mock when no prop supplied.

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
// Mock data — typed as ProductViewProps
// Used only when no `data` prop is supplied (standalone /product route).

const PRODUCT_DATA: ProductViewProps = {
  score: {
    value: 78,
    label: "Strong roadmap opportunity",
    explanation:
      "Users repeatedly ask for native time tracking, executive Gantt views, and a triage-first mobile experience. " +
      "Permissions and a public-facing changelog round out the top 5. The strongest evidence sits behind time tracking — " +
      "it appears across Reddit, G2, HN, and Product Hunt with consistent agency framing.",
    factors: {
      feature_gap_frequency: 0.84,
      pain_severity: 0.79,
      source_spread: 0.92,
      user_urgency: 0.71,
      competitor_love_strength: 0.62,
    },
  },

  gaps: [
    {
      feature_gap: "Native time tracking",
      mentions: 412,
      sources: ["reddit", "g2", "hn", "producthunt"],
      severity: 0.9,
      confidence: mockConfidence(0.91),
      user_segment: "Agencies, consultancies",
      suggested_action: "Explore as P0 — agency wedge",
      summary:
        "Bill-by-hour teams resort to Toggl, Harvest, or custom scripts. Workaround tax is named in every agency thread.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Executive Gantt / dependency view",
      mentions: 298,
      sources: ["reddit", "linkedin", "g2"],
      severity: 0.85,
      confidence: mockConfidence(0.84),
      user_segment: "PM-leadership, exec teams",
      suggested_action: "Explore as P1 — leadership unlock",
      summary:
        "Cycles work for engineering, but board updates demand quarterly Gantt with dependencies. Teams maintain a parallel Notion or Miro.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Triage-first mobile",
      mentions: 134,
      sources: ["reddit", "g2", "twitter"],
      severity: 0.85,
      confidence: mockConfidence(0.78),
      user_segment: "Managers on the go",
      suggested_action: "Explore as P0 — narrow scope",
      summary:
        "Don't ship parity — ship three actions: skim, assign, comment. The keyboard equivalents are the heart of the gripe.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Granular per-project roles",
      mentions: 187,
      sources: ["g2", "linkedin", "reddit"],
      severity: 0.85,
      confidence: mockConfidence(0.86),
      user_segment: "Customer-facing teams (CS, sales)",
      suggested_action: "Explore as P1 — admin unlock",
      summary:
        "Stakeholders need scoped read or comment-only access. Today it's effectively all-or-nothing per workspace.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Customer-facing changelog & roadmap portal",
      mentions: 241,
      sources: ["reddit", "producthunt"],
      severity: 0.5,
      confidence: mockConfidence(0.81),
      user_segment: "B2B SaaS with customers",
      suggested_action: "Explore as P1 — outbound moment",
      summary:
        "Teams maintain Notion in parallel; it drifts. A portal generated from issue labels closes the loop.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Recurring issues & templates",
      mentions: 156,
      sources: ["reddit", "g2"],
      severity: 0.5,
      confidence: mockConfidence(0.69),
      user_segment: "Ops & infra teams",
      suggested_action: "Explore as P2",
      summary:
        "Repeating ops work (audits, on-call rotations, vendor reviews) currently requires manual duplication.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Custom workflow states per team",
      mentions: 92,
      sources: ["g2", "reddit"],
      severity: 0.5,
      confidence: mockConfidence(0.62),
      user_segment: "QA, infra, security",
      suggested_action: "Explore as P2",
      summary:
        "Teams with non-eng workflows (QA flaky-tests, security review) want their own status pipeline.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_gap: "Offline-first mobile",
      mentions: 77,
      sources: ["reddit", "twitter"],
      severity: 0.2,
      confidence: mockConfidence(0.51),
      user_segment: "Field teams, travelling",
      suggested_action: "Backlog",
      summary: "Smaller cluster. Field teams want issues queued on airplane mode and synced on reconnect.",
      evidence_refs: EMPTY_REFS,
    },
  ],

  productAreas: [
    { area: "Onboarding", volume: 0.32, severity: 0.42, source_spread: 0.55, cluster_count: 2 },
    { area: "Performance", volume: 0.48, severity: 0.52, source_spread: 0.62, cluster_count: 3 },
    { area: "UX / navigation", volume: 0.41, severity: 0.38, source_spread: 0.58, cluster_count: 2 },
    { area: "Collaboration", volume: 0.62, severity: 0.66, source_spread: 0.71, cluster_count: 4 },
    { area: "Permissions / Admin", volume: 0.71, severity: 0.78, source_spread: 0.74, cluster_count: 5 },
    { area: "Integrations", volume: 0.36, severity: 0.32, source_spread: 0.51, cluster_count: 2 },
    { area: "Reporting / analytics", volume: 0.78, severity: 0.74, source_spread: 0.79, cluster_count: 5 },
    { area: "Pricing / packaging", volume: 0.92, severity: 0.88, source_spread: 0.83, cluster_count: 6 },
    { area: "Support / reliability", volume: 0.28, severity: 0.34, source_spread: 0.42, cluster_count: 2 },
    { area: "Mobile", volume: 0.66, severity: 0.71, source_spread: 0.61, cluster_count: 4 },
  ],

  clusterCards: [
    {
      complaint_title: "Permissions are confusing for growing teams",
      product_area: "Permissions / Admin",
      frequency: 96,
      severity: 0.85,
      sources: ["reddit", "g2", "producthunt"],
      impact_on_workflow: 0.8,
      suggested_product_response: "Simplify role matrix, ship per-project view/comment/file roles",
      evidence_refs: EMPTY_REFS,
    },
    {
      complaint_title: "Reporting feels like a separate product",
      product_area: "Reporting / analytics",
      frequency: 119,
      severity: 0.85,
      sources: ["reddit", "linkedin", "g2"],
      impact_on_workflow: 0.75,
      suggested_product_response: "Lightweight quarterly view, generated from issues",
      evidence_refs: EMPTY_REFS,
    },
    {
      complaint_title: "Mobile triage is impossible",
      product_area: "Mobile",
      frequency: 134,
      severity: 0.85,
      sources: ["reddit", "g2", "twitter"],
      impact_on_workflow: 0.7,
      suggested_product_response: "Triage-first mobile: skim, assign, comment. Not parity.",
      evidence_refs: EMPTY_REFS,
    },
    {
      complaint_title: "Old issues are hard to find",
      product_area: "Performance",
      frequency: 74,
      severity: 0.5,
      sources: ["reddit", "g2"],
      impact_on_workflow: 0.5,
      suggested_product_response: "Improve search ranking on age × partial title; add per-team scoping",
      evidence_refs: EMPTY_REFS,
    },
  ],

  loves: [
    {
      feature_name: "Cmd-K command palette",
      why_users_love_it: "Users describe it as 'muscle memory after a week.' Speed and discoverability in one surface.",
      positive_mentions: 312,
      stickiness_level: 0.9,
      recommendation: "match",
      product_lesson: "Keyboard-first navigation is the table-stakes for technical buyers. Match this on day one.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_name: "GitHub / Slack integrations",
      why_users_love_it: "Users repeatedly say Linear 'lives where my code lives.' Integration depth is a real lock-in.",
      positive_mentions: 198,
      stickiness_level: 0.85,
      recommendation: "match",
      product_lesson: "Don't ship without these. They're not features, they're prerequisites for the buyer's shortlist.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_name: "Cycles (2-week shipping rhythm)",
      why_users_love_it: "Praised as the right primitive for product-led teams. 'Matches how we actually work.'",
      positive_mentions: 142,
      stickiness_level: 0.8,
      recommendation: "differentiate",
      product_lesson:
        "Cycles are sticky. Don't replicate — find a different primitive (e.g. outcomes, bets) that serves the same job differently.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_name: "Opinionated, minimal UI",
      why_users_love_it: "Senior engineers praise the refusal to be everything-for-everyone. 'It has taste.'",
      positive_mentions: 98,
      stickiness_level: 0.7,
      recommendation: "learn",
      product_lesson: "Take a sharp design POV. Resist enterprise checkbox-creep in v1.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_name: "Fast setup (under 10 minutes)",
      why_users_love_it: "New users land in a working project in minutes. Onboarding never feels heavy.",
      positive_mentions: 76,
      stickiness_level: 0.65,
      recommendation: "match",
      product_lesson: "Onboarding is judged on first 10 minutes. Don't gate features behind a setup wizard.",
      evidence_refs: EMPTY_REFS,
    },
    {
      feature_name: "Project status messaging",
      why_users_love_it: "Async status updates per project are praised as a Slack-thread replacement.",
      positive_mentions: 54,
      stickiness_level: 0.4,
      recommendation: "ignore",
      product_lesson: "Niche praise; not load-bearing. Don't spend cycles here in v1.",
      evidence_refs: EMPTY_REFS,
    },
  ],

  workflow: [
    {
      workflow_name: "Setup",
      friction_point: "Praised. Working project in <10m. Use as benchmark.",
      friction: "low",
      impact: 0.2,
      frequency: 0.8,
      affected_segment: null,
      suggested_improvement: null,
      evidence_refs: EMPTY_REFS,
    },
    {
      workflow_name: "Invite team",
      friction_point: "Per-seat math becomes visible during invite flow. Contractor tax mentioned.",
      friction: "medium",
      impact: 0.5,
      frequency: 0.6,
      affected_segment: "Founders with contractors",
      suggested_improvement: null,
      evidence_refs: EMPTY_REFS,
    },
    {
      workflow_name: "Configure permissions",
      friction_point: "All-or-nothing per workspace. CS / sales can't be scoped.",
      friction: "high",
      impact: 0.85,
      frequency: 0.7,
      affected_segment: "Customer-facing teams",
      suggested_improvement: "Per-project roles",
      evidence_refs: EMPTY_REFS,
    },
    {
      workflow_name: "Day-to-day triage",
      friction_point: "Web is fast. Mobile drops the experience to read-mostly.",
      friction: "medium",
      impact: 0.5,
      frequency: 0.9,
      affected_segment: "Managers on mobile",
      suggested_improvement: "Triage-first mobile",
      evidence_refs: EMPTY_REFS,
    },
    {
      workflow_name: "Report to leadership",
      friction_point: "Cycles don't map to quarterly. Teams export to slides or Miro.",
      friction: "high",
      impact: 0.85,
      frequency: 0.6,
      affected_segment: "PM leads, exec teams",
      suggested_improvement: "Executive quarterly view",
      evidence_refs: EMPTY_REFS,
    },
    {
      workflow_name: "Share with customers",
      friction_point: "No public portal. Notion drift is the standard workaround.",
      friction: "high",
      impact: 0.8,
      frequency: 0.5,
      affected_segment: "B2B SaaS PMs",
      suggested_improvement: "Public changelog portal",
      evidence_refs: EMPTY_REFS,
    },
    {
      workflow_name: "Scale past 30 seats",
      friction_point: "Pricing becomes the conversation. SSO tax mentioned at Plus tier.",
      friction: "high",
      impact: 0.9,
      frequency: 0.4,
      affected_segment: "Founders, finance leads",
      suggested_improvement: null,
      evidence_refs: EMPTY_REFS,
    },
  ],

  roadmap: [
    {
      opportunity_title: "Native time tracking with Toggl import",
      user_problem:
        "Bill-by-hour teams maintain a parallel timesheet tool. Workaround tax is named in every agency thread.",
      suggested_feature: "Native start/stop on any issue, Toggl/Harvest import, per-issue billable rate, CSV export.",
      expected_impact: 0.9,
      effort_estimate: "medium",
      confidence: mockConfidence(0.91),
      why_now: "Anchors the agency wedge. Linear has no roadmap signal here — open lane.",
      evidence_refs: EMPTY_REFS,
    },
    {
      opportunity_title: "Executive quarterly view",
      user_problem:
        "Cycles are loved by engineering but rejected by leadership. Boards demand Gantt + dependencies.",
      suggested_feature:
        "Quarterly Gantt with cross-project dependencies, milestone bands, and a single-keystroke present mode.",
      expected_impact: 0.85,
      effort_estimate: "high",
      confidence: mockConfidence(0.84),
      why_now: "Solves the highest-evidence executive pain. Differentiates against Linear's eng-only narrative.",
      evidence_refs: EMPTY_REFS,
    },
    {
      opportunity_title: "Triage-first mobile",
      user_problem: "Mobile is the 'read-only' bottleneck. Managers can't run standup on a phone.",
      suggested_feature: "Three-action mobile: skim, assign, comment. Offline queue. Single-tap status change.",
      expected_impact: 0.85,
      effort_estimate: "medium",
      confidence: mockConfidence(0.78),
      why_now: "Don't aim for parity. The three actions ARE the wedge.",
      evidence_refs: EMPTY_REFS,
    },
    {
      opportunity_title: "Per-project permission roles",
      user_problem:
        "Stakeholders (CS, sales, exec) need scoped read or comment-only access. Currently all-or-nothing.",
      suggested_feature: "Per-project role matrix (view, comment, file, edit). Workspace inheritance.",
      expected_impact: 0.5,
      effort_estimate: "medium",
      confidence: mockConfidence(0.86),
      why_now: "Unlocks customer-facing teams. Low-risk, high-leverage admin work.",
      evidence_refs: EMPTY_REFS,
    },
    {
      opportunity_title: "Public roadmap & changelog portal",
      user_problem: "B2B teams maintain Notion in parallel; it drifts. Customers notice.",
      suggested_feature: "Portal auto-generated from issue labels. Email digest. RSS + JSON feed.",
      expected_impact: 0.5,
      effort_estimate: "low",
      confidence: mockConfidence(0.81),
      why_now: "Cheapest of the top 5. High visibility win.",
      evidence_refs: EMPTY_REFS,
    },
  ],

  decisions: {
    build: [
      {
        title: "Native time tracking",
        reason: "412 mentions, agency wedge, no competitor signal yet.",
        confidence: mockConfidence(0.91),
        evidence_count: 412,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "Per-project permissions",
        reason: "Repeated CS/sales scaling pain. Admin unlocks customer-facing teams.",
        confidence: mockConfidence(0.86),
        evidence_count: 187,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "Triage-first mobile",
        reason: "Mobile is named #3 weakness. Three actions, not parity.",
        confidence: mockConfidence(0.78),
        evidence_count: 134,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "Public changelog portal",
        reason: "Cheap win. Closes the Notion-drift workflow.",
        confidence: mockConfidence(0.81),
        evidence_count: 241,
        evidence_refs: EMPTY_REFS,
      },
    ],
    avoid: [
      {
        title: "Generic AI summaries",
        reason: "Saturated. No signal in user conversations.",
        confidence: mockConfidence(0.62),
        evidence_count: 12,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "Enterprise governance UI",
        reason: "Users complain Linear is already 'too configurable.' Don't add knobs.",
        confidence: mockConfidence(0.74),
        evidence_count: 47,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "Whiteboarding canvas",
        reason: "Adjacent territory. Figma + Miro already own this surface.",
        confidence: mockConfidence(0.71),
        evidence_count: 22,
        evidence_refs: EMPTY_REFS,
      },
    ],
    learn: [
      {
        title: "Cmd-K everywhere",
        reason: "Praised by every technical reviewer. Speed is the floor.",
        confidence: mockConfidence(0.94),
        evidence_count: 312,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "GitHub-first integrations",
        reason: "Lives where code lives. Sets the buyer's shortlist.",
        confidence: mockConfidence(0.91),
        evidence_count: 198,
        evidence_refs: EMPTY_REFS,
      },
      {
        title: "Opinionated minimal UI",
        reason: "Refusing checkbox-creep earns trust from senior engineers.",
        confidence: mockConfidence(0.83),
        evidence_count: 98,
        evidence_refs: EMPTY_REFS,
      },
    ],
  },

  confidence_summary: mockConfidence(0.82),
  evidence_refs: EMPTY_REFS,
};

const COMPETITOR = { name: "Linear", domain: "linear.app" };

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

export function ProductPage({
  embedded = false,
  data,
  range: propRange,
  evidenceSection,
  competitorName,
}: {
  embedded?: boolean;
  data?: ProductViewProps;
  range?: string;
  evidenceSection?: EvidenceSection | null;
  competitorName?: string;
}) {
  const navigate = useNavigate();
  const reportsQuery = useReportsQuery();
  const [drawerRefs, setDrawerRefs] = useState<EvidenceRef | null>(null);
  const [range, setRange] = useState(propRange ?? "90d");
  const [filters, setFilters] = useState<Filters>({ source: "all", area: "all", severity: "all" });

  if (!embedded) {
    if (reportsQuery.isLoading) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "48px 28px", maxWidth: 800, margin: "0 auto" }}>
          <Skeleton style={{ height: 32, width: 240 }} />
          <Skeleton style={{ height: 20, width: 400 }} />
          <Skeleton style={{ height: 20, width: 320 }} />
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

  if (embedded && data === undefined) {
    return (
      <div style={{ padding: "48px 28px", textAlign: "center" }}>
        <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
          Product analysis not available — pipeline did not produce this section for the current report.
        </p>
      </div>
    );
  }

  const P = data ?? PRODUCT_DATA;
  const cName = competitorName ?? COMPETITOR.name;
  const openEvidence = (refs: EvidenceRef) => setDrawerRefs(refs);
  const closeEvidence = () => setDrawerRefs(null);

  return (
    <div>
      {!embedded && (
        <ProductHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div style={{ padding: "22px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        <OpportunitySummary score={P.score} openEvidence={openEvidence} />

        <SectionHeadPM
          eyebrow="01 · Feature gap map"
          title={`What users want that ${cName} doesn't solve`}
          subtitle="Ranked by evidence × severity. Click any row for quotes and context."
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
            <LoveCard key={i} l={l} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadPM
          eyebrow="04 · Workflow friction"
          title="Where users get stuck in the journey"
          subtitle="The user lifecycle, with friction badges at each step."
        />
        <WorkflowJourney steps={P.workflow} openEvidence={openEvidence} />

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
  score: ProductViewProps["score"];
  openEvidence: (refs: EvidenceRef) => void;
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
          <ScoreFactors factors={score.factors} />
        </div>
      </div>

      {/* Explanation */}
      <div className="re-card re-card-elev">
        <div className="re-card-hd">
          <h3>
            <Icon name="alert" size={14} /> Top product insight
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            synthesized from evidence signals
          </span>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, height: "calc(100% - 41px)" }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>{score.explanation}</p>

          <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
            <button
              type="button"
              className="re-btn re-btn-sm"
              onClick={() => openEvidence(EMPTY_REFS)}
            >
              <Icon name="quote" size={12} /> View signals
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

function FeatureGapTable({
  rows,
  openEvidence,
}: {
  rows: AdaptedFeatureGap[];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("mentions");

  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "mentions") return b.mentions - a.mentions;
    if (sortBy === "confidence") return b.confidence.score - a.confidence.score;
    return b.severity - a.severity;
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
        <FeatureGapRow key={g.feature_gap} g={g} i={i} openEvidence={openEvidence} />
      ))}
    </div>
  );
}

function FeatureGapRow({
  g,
  i,
  openEvidence,
}: {
  g: AdaptedFeatureGap;
  i: number;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const sevColor = severityColor(g.severity);
  const sevBg = severityBg(g.severity);
  const sevLbl = severityLabel(g.severity);

  return (
    <div
      onClick={() => openEvidence(g.evidence_refs)}
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
        <div style={{ fontSize: 14, fontWeight: 500 }}>{g.feature_gap}</div>
        <div style={{ ...monoFaint, fontSize: 10, marginTop: 2 }}>{g.summary}</div>
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
          {sevLbl}
        </span>
      </div>
      <div>
        <ConfidenceIndicator confidence={g.confidence} />
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>{g.user_segment}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <span
          className="font-mono-feat"
          style={{
            fontSize: 11,
            color: g.suggested_action?.includes("P0") ? "var(--accent)" : g.suggested_action?.includes("P1") ? INDIGO : "var(--fg-muted)",
            fontWeight: 500,
          }}
        >
          {g.suggested_action?.replace("Explore as ", "") ?? "—"}
        </span>
        <Icon name="chev-right" size={14} className="text-fg-faint" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — PRODUCT AREA HEATMAP

const HEAT_COLS = "minmax(180px, 1.4fr) repeat(3, 1fr)";

function ProductAreaHeatmap({ rows }: { rows: HeatmapRow[] }) {
  const cols: Array<{ key: keyof HeatmapRow; label: string }> = [
    { key: "volume", label: "Volume" },
    { key: "severity", label: "Severity" },
    { key: "source_spread", label: "Source spread" },
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
            <HeatCell key={c.key} value={r[c.key] as number} />
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
  c: ProductViewProps["clusterCards"][number];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const sevColor = severityColor(c.severity);
  const sevLbl = severityLabel(c.severity);
  const impactLbl = severityLabel(c.impact_on_workflow);

  return (
    <div className="re-card">
      <div style={{ padding: "14px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="re-chip" style={{ fontSize: 10 }}>
          {c.product_area}
        </span>
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
          {c.frequency} mentions
        </span>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{c.complaint_title}</h3>
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
            {sevLbl}
          </span>

          <span style={labelMono()}>IMPACT</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{impactLbl}</span>

          {c.suggested_product_response && (
            <>
              <span className="font-mono-feat" style={{ ...labelMono({ color: INDIGO }), fontWeight: 600 }}>
                RESPONSE
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>
                {c.suggested_product_response}
              </span>
            </>
          )}
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
            onClick={() => openEvidence(c.evidence_refs)}
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

type RecKey = "match" | "learn" | "differentiate" | "ignore";

const REC_STYLES: Record<RecKey, { color: string; bg: string }> = {
  match: { color: "var(--pos)", bg: "rgba(22,163,74,.08)" },
  learn: { color: INDIGO, bg: "rgba(99,102,241,.08)" },
  differentiate: { color: "var(--accent)", bg: "var(--accent-soft)" },
  ignore: { color: "var(--fg-faint)", bg: "rgba(20,16,12,.04)" },
};

function LoveCard({
  l,
  openEvidence,
}: {
  l: AdaptedLovedFeature;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const rec = REC_STYLES[l.recommendation] ?? REC_STYLES.learn;
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
            {l.recommendation}
          </span>
          <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
            {l.positive_mentions} praise mentions
          </span>
        </div>

        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{l.feature_name}</h3>
        <p className="text-fg-muted" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.55 }}>
          {l.why_users_love_it}
        </p>

        {l.product_lesson && (
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
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)" }}>{l.product_lesson}</span>
          </div>
        )}

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => openEvidence(l.evidence_refs)}
          >
            Evidence <Icon name="arrow-right" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4 — WORKFLOW JOURNEY

function WorkflowJourney({
  steps,
  openEvidence,
}: {
  steps: AdaptedWorkflowStep[];
  openEvidence: (refs: EvidenceRef) => void;
}) {
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
              gridTemplateColumns: "16px 130px 100px 1fr 80px",
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
            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.workflow_name}</span>
            <FrictionPill level={s.friction} />
            <span className="text-fg-muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
              {s.friction_point}
            </span>
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-sm"
              style={{ justifySelf: "end" }}
              onClick={() => openEvidence(s.evidence_refs)}
            >
              <Icon name="quote" size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function JourneyStep({ s, index }: { s: AdaptedWorkflowStep; index: number }) {
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
      <div style={{ fontSize: 12, fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>{s.workflow_name}</div>
      <FrictionPill level={s.friction} />
    </div>
  );
}

const FRICTION_STYLES: Record<"high" | "medium" | "low", { c: string; bg: string }> = {
  high: { c: "var(--neg)", bg: "rgba(220,38,38,.10)" },
  medium: { c: "var(--warn)", bg: "rgba(217,119,6,.10)" },
  low: { c: "var(--pos)", bg: "rgba(22,163,74,.10)" },
};

function FrictionPill({ level }: { level: "high" | "medium" | "low" }) {
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
  r: AdaptedRoadmapItem;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const impactBucket = bucketFloat(r.expected_impact);
  const impactColor =
    impactBucket === "high" ? "var(--accent)" : impactBucket === "medium" ? INDIGO : "var(--fg-muted)";

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
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.3 }}>{r.opportunity_title}</h3>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 8 }}>
          <span style={labelMono()}>PROBLEM</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-muted)" }}>{r.user_problem}</span>

          <span style={labelMono()}>FEATURE</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg)", fontWeight: 500 }}>{r.suggested_feature}</span>

          {r.why_now && (
            <>
              <span className="font-mono-feat" style={{ ...labelMono({ color: impactColor }), fontWeight: 600 }}>
                WHY NOW
              </span>
              <span style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg)" }}>{r.why_now}</span>
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <RoadmapStat label="Impact" value={impactBucket} color={impactColor} />
          <RoadmapStat label="Effort" value={r.effort_estimate} color="var(--fg)" />
          <div style={{ padding: 8, border: "1px solid var(--border-soft)", borderRadius: 8, background: "var(--surface-solid)" }}>
            <div style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence</div>
            <div style={{ marginTop: 3 }}>
              <ConfidenceIndicator confidence={r.confidence} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            type="button"
            className="re-btn re-btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => openEvidence(r.evidence_refs)}
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
  d: ProductViewProps["decisions"];
  openEvidence: (refs: EvidenceRef) => void;
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
  items: AdaptedBuildAvoidLearnItem[];
  color: string;
  bg: string;
  openEvidence: (refs: EvidenceRef) => void;
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
            onClick={() => openEvidence(it.evidence_refs)}
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
                {it.evidence_count}
              </span>
            </div>
            <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5 }}>
              {it.reason}
            </p>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ ...monoFaint, fontSize: 10 }}>confidence</span>
              <ConfidenceIndicator confidence={it.confidence} />
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
          to real evidence."
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
