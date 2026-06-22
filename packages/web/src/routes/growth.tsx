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
  GrowthViewProps,
  FeedItemProps,
  PriorityConversationProps,
  PricingLeadProps,
  CommunityProps,
  ReplyAngleProps,
  SegmentHintProps,
  UiUrgency,
  SwitchIntentType,
} from "@/lib/dashboard-adapters/growth";

// Growth / Sales View — switch-intent intelligence workspace.
// Answers: "Where are people showing intent, and how should we engage thoughtfully?"
// Accepts an optional `data: GrowthViewProps` prop (from the adapter).
// When `data` is undefined, falls back to the GROWTH_DATA mock so that the
// standalone /growth design-demo route keeps working.

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
// Mock data — typed to match GrowthViewProps
// Used only when no `data` prop is supplied.

const GROWTH_DATA: GrowthViewProps = {
  highestOpportunitySummary:
    "Users are actively asking for alternatives to Linear, especially in Reddit threads around 15–80 person team workflows and per-seat pricing. " +
    "The clearest opportunities are pricing-pain threads on r/SaaS and r/ProductManagement — high engagement, recent, and explicitly seeking recommendations.",

  switchIntentScore: {
    score: 79,
    label: "Strong intent signal",
    explanation:
      "High volume of alternative-seeking posts, pricing complaints, and explicit competitor frustration. Hot threads from the last 72h.",
    factors: {
      alternative_seeking_posts: 0.88,
      pricing_complaints: 0.82,
      explicit_competitor_frustration: 0.74,
      recency: 0.91,
      engagement_level: 0.68,
      source_quality: 0.86,
    },
  },

  topOpportunity: {
    id: "f-1",
    source: "reddit",
    title: "Looking for a cheaper alternative to Linear — small agency",
    userOrContext: "u/agency_owner_marc",
    sourceDate: "3h ago",
    intentType: "looking_for_alternative",
    competitorMentioned: "Linear",
    painMentioned: "pricing",
    urgency: "hot",
    engagementLevel: "high",
    intentScore: 94,
    suggestedAngle:
      "Respond as founder. Mention contractor-friendly tools (yours and 1 other). Ask what features matter most before pitching anything.",
    sourceUrl: "https://reddit.com/r/SaaS/comments/...",
    evidenceRefs: EMPTY_REFS,
  },

  feed: [
    {
      id: "f-1",
      source: "reddit",
      title: "Looking for a cheaper alternative to Linear — small agency",
      userOrContext: "u/agency_owner_marc",
      sourceDate: "3h ago",
      intentType: "looking_for_alternative",
      competitorMentioned: "Linear",
      painMentioned: "pricing",
      urgency: "hot",
      engagementLevel: "high",
      intentScore: 94,
      suggestedAngle:
        "Respond as founder. Mention contractor-friendly tools (yours and 1 other). Ask what features matter most before pitching anything.",
      sourceUrl: "https://reddit.com/r/SaaS/comments/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-2",
      source: "hn",
      title: "Linear vs Plane vs Height — what are you using in 2026?",
      userOrContext: "moonshot_pm",
      sourceDate: "8h ago",
      intentType: "tool_recommendation_request",
      competitorMentioned: "Linear",
      painMentioned: "general",
      urgency: "hot",
      engagementLevel: "high",
      intentScore: 88,
      suggestedAngle:
        "Long-form, thoughtful comment. Compare 3-4 tools honestly. Mention yours among them with one line on the wedge.",
      sourceUrl: "https://news.ycombinator.com/item?id=...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-3",
      source: "reddit",
      title: "Plus tier just for SSO — anyone else fed up?",
      userOrContext: "u/pm_throwaway",
      sourceDate: "5h ago",
      intentType: "competitor_frustration",
      competitorMentioned: "Linear",
      painMentioned: "pricing",
      urgency: "hot",
      engagementLevel: "high",
      intentScore: 86,
      suggestedAngle:
        "Acknowledge the SSO-tax framing (it's becoming a meme). Quietly mention tools that include SSO in base tiers.",
      sourceUrl: "https://reddit.com/r/ProductManagement/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-4",
      source: "reddit",
      title: "Time tracking inside a PM tool — does anyone do this well?",
      userOrContext: "u/contractor_v",
      sourceDate: "1d ago",
      intentType: "missing_feature_request",
      competitorMentioned: "Linear",
      painMentioned: "feature-gap",
      urgency: "warm",
      engagementLevel: "medium",
      intentScore: 82,
      suggestedAngle:
        "Direct fit if your tool has native time tracking. Reply with screenshots of the flow, not a pitch.",
      sourceUrl: "https://reddit.com/r/ExperiencedDevs/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-5",
      source: "reddit",
      title: "Migrating off Linear — how painful was it for you?",
      userOrContext: "u/founder_h",
      sourceDate: "1d ago",
      intentType: "migration_question",
      competitorMentioned: "Linear",
      painMentioned: "switching",
      urgency: "warm",
      engagementLevel: "medium",
      intentScore: 79,
      suggestedAngle:
        "Honest comment about migration. If your tool has Linear import, mention it once, factually, with what carries over.",
      sourceUrl: "https://reddit.com/r/startups/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-6",
      source: "linkedin",
      title: "Our CEO wants a Gantt view — what do people use alongside Linear?",
      userOrContext: "Jordan Reyes",
      sourceDate: "2d ago",
      intentType: "missing_feature_request",
      competitorMentioned: "Linear",
      painMentioned: "exec-view",
      urgency: "warm",
      engagementLevel: "medium",
      intentScore: 74,
      suggestedAngle:
        "LinkedIn comment with one screenshot. Don't link to your site. Wait for DM if they want more.",
      sourceUrl: "https://linkedin.com/posts/jordan-reyes-...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-7",
      source: "reddit",
      title: "Anyone moved off Linear for mobile reasons?",
      userOrContext: "u/pm_mariana",
      sourceDate: "2d ago",
      intentType: "competitor_frustration",
      competitorMentioned: "Linear",
      painMentioned: "mobile",
      urgency: "warm",
      engagementLevel: "medium",
      intentScore: 71,
      suggestedAngle:
        "If your mobile is truly triage-first, share a 10-second screen recording. Show, don't claim.",
      sourceUrl: "https://reddit.com/r/ProductManagement/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-8",
      source: "reddit",
      title: "What's the cheapest Linear-style tool that still has GitHub sync?",
      userOrContext: "u/devops_dan",
      sourceDate: "3d ago",
      intentType: "looking_for_alternative",
      competitorMentioned: "Linear",
      painMentioned: "pricing",
      urgency: "warm",
      engagementLevel: "medium",
      intentScore: 68,
      suggestedAngle:
        "Tactical comment. Compare 2-3 tools on price + GitHub sync depth. Link to your sync docs, not your homepage.",
      sourceUrl: "https://reddit.com/r/webdev/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      id: "f-9",
      source: "twitter",
      title: "Considering churning — what's worked for your team post-Linear?",
      userOrContext: "@founder_charlie",
      sourceDate: "3d ago",
      intentType: "churn_signal",
      competitorMentioned: "Linear",
      painMentioned: "general",
      urgency: "research",
      engagementLevel: "low",
      intentScore: 64,
      suggestedAngle:
        "Wait for DM signal. If you reply, ask what part is the breaking point first.",
      sourceUrl: "https://x.com/founder_charlie/status/...",
      evidenceRefs: EMPTY_REFS,
    },
  ],

  priority: [
    {
      priority: "hot",
      conversationTitle: "Looking for a cheaper alternative to Linear — small agency",
      intentType: "looking_for_alternative",
      pain: "pricing",
      source: "reddit",
      sourceDate: "3h ago",
      suggestedAction: "Reply within 4h. Founder voice.",
      sourceUrl: "https://reddit.com/r/SaaS/comments/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "hot",
      conversationTitle: "Linear vs Plane vs Height — what are you using in 2026?",
      intentType: "tool_recommendation_request",
      pain: "general",
      source: "hn",
      sourceDate: "8h ago",
      suggestedAction: "Long-form HN reply. 24h window.",
      sourceUrl: "https://news.ycombinator.com/item?id=...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "hot",
      conversationTitle: "Plus tier just for SSO — anyone else fed up?",
      intentType: "competitor_frustration",
      pain: "pricing",
      source: "reddit",
      sourceDate: "5h ago",
      suggestedAction: "Acknowledge SSO-tax framing.",
      sourceUrl: "https://reddit.com/r/ProductManagement/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "warm",
      conversationTitle: "Time tracking inside a PM tool — does anyone do this well?",
      intentType: "missing_feature_request",
      pain: "feature-gap",
      source: "reddit",
      sourceDate: "1d ago",
      suggestedAction: "Show screenshots if you have it.",
      sourceUrl: "https://reddit.com/r/ExperiencedDevs/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "warm",
      conversationTitle: "Migrating off Linear — how painful was it for you?",
      intentType: "migration_question",
      pain: "switching",
      source: "reddit",
      sourceDate: "1d ago",
      suggestedAction: "Honest migration comment.",
      sourceUrl: "https://reddit.com/r/startups/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "warm",
      conversationTitle: "Our CEO wants a Gantt view — what do people use alongside Linear?",
      intentType: "missing_feature_request",
      pain: "exec-view",
      source: "linkedin",
      sourceDate: "2d ago",
      suggestedAction: "LinkedIn comment, not brand.",
      sourceUrl: "https://linkedin.com/posts/jordan-reyes-...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "warm",
      conversationTitle: "Anyone moved off Linear for mobile reasons?",
      intentType: "competitor_frustration",
      pain: "mobile",
      source: "reddit",
      sourceDate: "2d ago",
      suggestedAction: "Share mobile screen recording.",
      sourceUrl: "https://reddit.com/r/ProductManagement/...",
      evidenceRefs: EMPTY_REFS,
    },
    {
      priority: "research",
      conversationTitle: "Considering churning — what's worked for your team post-Linear?",
      intentType: "churn_signal",
      pain: "general",
      source: "twitter",
      sourceDate: "3d ago",
      suggestedAction: "Watch, don't reply yet.",
      sourceUrl: "https://x.com/founder_charlie/status/...",
      evidenceRefs: EMPTY_REFS,
    },
  ],

  pricingLeads: [
    {
      title: "Per-seat scaling past 20",
      pricingIssue: "Per-seat math compounds at growth stage",
      planLimitation: null,
      teamSizeHint: "5–25 people",
      budgetSensitivity: "Low",
      alternativeInterest: "explicit",
      suggestedPricingAngle:
        "Lead with predictable pricing for growth. Show the 30-seat math comparison without naming a competitor.",
      sourceUrl: null,
      evidenceRefs: EMPTY_REFS,
    },
    {
      title: "Plus tier required for SSO",
      pricingIssue: "SSO gated behind Plus plan",
      planLimitation: "Plus tier required for SSO",
      teamSizeHint: "20–60 people, IT-mature",
      budgetSensitivity: "Medium",
      alternativeInterest: "researching",
      suggestedPricingAngle:
        "Show SSO in your base tier. Use 'no SSO tax' framing in your subject line.",
      sourceUrl: null,
      evidenceRefs: EMPTY_REFS,
    },
    {
      title: "Contractor seat math",
      pricingIssue: "Full seat cost for short-term contractors",
      planLimitation: null,
      teamSizeHint: "Agency / 5–10 FTEs + contractors",
      budgetSensitivity: "Low",
      alternativeInterest: "explicit",
      suggestedPricingAngle:
        "Lead with read-only or seat-free contractor roles. Demo the invite flow.",
      sourceUrl: null,
      evidenceRefs: EMPTY_REFS,
    },
    {
      title: "Enterprise quote shock",
      pricingIssue: "High enterprise quote at scale",
      planLimitation: null,
      teamSizeHint: "120+ people, post-Series B",
      budgetSensitivity: "High",
      alternativeInterest: "researching",
      suggestedPricingAngle:
        "Side-by-side total cost comparison at 180 seats. Email subject: 'The $30k question.'",
      sourceUrl: null,
      evidenceRefs: EMPTY_REFS,
    },
  ],

  communities: [
    {
      name: "r/SaaS",
      source: "reddit",
      posts: 14,
      dominantPain: "Pricing & alternatives",
      engagementLevel: "high",
      fit: 0.94,
      recommendedApproach: "Founder-voice comments. Share comparisons, not pitches.",
      spamRisk: "low",
      evidenceRefs: EMPTY_REFS,
    },
    {
      name: "r/ProductManagement",
      source: "reddit",
      posts: 11,
      dominantPain: "Workflows & exec views",
      engagementLevel: "high",
      fit: 0.88,
      recommendedApproach: "Long-form replies with screenshots. PMs sniff astroturfing.",
      spamRisk: "low",
      evidenceRefs: EMPTY_REFS,
    },
    {
      name: "Hacker News",
      source: "hn",
      posts: 6,
      dominantPain: "Pricing & integrations",
      engagementLevel: "medium",
      fit: 0.82,
      recommendedApproach: "One thoughtful comment per thread, never pitch in title.",
      spamRisk: "medium",
      evidenceRefs: EMPTY_REFS,
    },
    {
      name: "r/ExperiencedDevs",
      source: "reddit",
      posts: 9,
      dominantPain: "Tooling depth",
      engagementLevel: "medium",
      fit: 0.76,
      recommendedApproach: "Technical depth wins here. Show, don't tell.",
      spamRisk: "low",
      evidenceRefs: EMPTY_REFS,
    },
    {
      name: "PMM Network (LinkedIn)",
      source: "linkedin",
      posts: 7,
      dominantPain: "Exec-view & roadmaps",
      engagementLevel: "medium",
      fit: 0.74,
      recommendedApproach: "Person-to-person comments. Never comment as brand.",
      spamRisk: "low",
      evidenceRefs: EMPTY_REFS,
    },
    {
      name: "Product Hunt threads",
      source: "producthunt",
      posts: 4,
      dominantPain: "New-tool discovery",
      engagementLevel: "low",
      fit: 0.68,
      recommendedApproach: "Participate only on adjacent launches, not your own.",
      spamRisk: "medium",
      evidenceRefs: EMPTY_REFS,
    },
    {
      name: "r/startups",
      source: "reddit",
      posts: 5,
      dominantPain: "Tool choices at <30 ppl",
      engagementLevel: "medium",
      fit: 0.71,
      recommendedApproach: "Share early-stage frame: 'we did this when we were 10.'",
      spamRisk: "low",
      evidenceRefs: EMPTY_REFS,
    },
  ],

  replyAngles: [
    {
      relatedConversationId: "f-1",
      contextSummary: "User publicly frustrated with Linear's pricing at scale, asking for alternatives.",
      whatToAcknowledge: "Recognize the seat-math pain is common past 15 people, and that contractors compound it.",
      whatNotToSay: "Don't pitch in line 1. Don't list 5 tools. Don't link.",
      helpfulReplyAngle:
        "Yeah, seat math is rough between 15 and 30. We hit the same wall — ended up writing a contractor read-only role. What's your contractor situation? That changes the recommendation a lot.",
      softCtaSuggestion: "Happy to share what worked once I know your shape.",
      spamRisk: "low",
      confidence: mockConfidence(0.91),
      evidenceRefs: EMPTY_REFS,
    },
    {
      relatedConversationId: "f-8",
      contextSummary: "Engineer asks about cheap Linear alternative with deep GitHub sync.",
      whatToAcknowledge: "Note that the GitHub depth is the real bar — pricing is secondary.",
      whatNotToSay: "Don't claim sync depth without showing what actually syncs.",
      helpfulReplyAngle:
        "GitHub sync is the bar. A few that go deeper than just 'PR link': X, Y, Z. We made Z. Happy to point you at the sync docs if useful.",
      softCtaSuggestion: "Sync docs link only if asked.",
      spamRisk: "low",
      confidence: mockConfidence(0.86),
      evidenceRefs: EMPTY_REFS,
    },
    {
      relatedConversationId: "f-5",
      contextSummary: "Long migration-pain thread. User wants to leave but afraid of the move.",
      whatToAcknowledge: "Migration is always harder than promised. Be honest about what's lossy.",
      whatNotToSay: "Don't promise '100% lossless.' Don't oversell the importer.",
      helpfulReplyAngle:
        "We built a Linear importer last year. It handles issues, cycles, statuses, comments. It does NOT handle custom fields cleanly — that's still a real cost. If that matters for your 4,000 issues, I'd budget two days.",
      softCtaSuggestion: "Drop the import docs if they ask.",
      spamRisk: "medium",
      confidence: mockConfidence(0.82),
      evidenceRefs: EMPTY_REFS,
    },
  ],

  segmentHints: [
    {
      roleHint: "Agency founder",
      companyOrTeamSizeHint: "5–10 FTE + 3 contractors",
      useCase: "Project management + client billing",
      industry: "Digital agency",
      urgency: "hot",
      budgetSensitivity: "Low",
      technicalMaturity: "Medium",
      confidence: mockConfidence(0.81),
      evidenceRefs: EMPTY_REFS,
    },
    {
      roleHint: "Product manager",
      companyOrTeamSizeHint: "20–60 people",
      useCase: "Roadmap + cross-team coordination",
      industry: "B2B SaaS",
      urgency: "warm",
      budgetSensitivity: "Medium",
      technicalMaturity: "High",
      confidence: mockConfidence(0.74),
      evidenceRefs: EMPTY_REFS,
    },
    {
      roleHint: "Independent developer",
      companyOrTeamSizeHint: "Solo + 2 clients",
      useCase: "Billable issue tracking",
      industry: "Freelance dev",
      urgency: "hot",
      budgetSensitivity: "Low",
      technicalMaturity: "High",
      confidence: mockConfidence(0.86),
      evidenceRefs: EMPTY_REFS,
    },
  ],

  spamRiskNotes: null,
  sourceLinks: [],
  evidenceRefs: EMPTY_REFS,
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers

function coverageColor(id: string): string {
  return (
    (
      {
        reddit: "#0061B1",
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

/** Urgency float or UiUrgency → CSS color token. */
function urgencyColor(u: UiUrgency): string {
  if (u === "hot") return "var(--neg)";
  if (u === "warm") return "var(--warn)";
  return "var(--fg-muted)";
}

const GRN = "#16a34a";
const GRN_BG = "rgba(22,163,74,0.08)";

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

const labelMono = (overrides: CSSProperties = {}): CSSProperties => ({
  ...monoFaint,
  fontSize: 11,
  textTransform: "none",
  letterSpacing: "0.08em",
  paddingTop: 2,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────
// PAGE

interface Filter {
  intent: string;
  source: string;
  urgency: string;
}

export function GrowthPage({
  embedded = false,
  data,
  evidenceSection,
  range: propRange,
  reportId,
}: {
  embedded?: boolean;
  data?: GrowthViewProps;
  evidenceSection?: EvidenceSection | null;
  range?: string;
  reportId?: string;
}) {
  const navigate = useNavigate();
  const reportsQuery = useReportsQuery();
  const [drawerRefs, setDrawerRefs] = useState<EvidenceRef | null>(null);
  const [localRange, setLocalRange] = useState("90d");
  const [filter, setFilter] = useState<Filter>({ intent: "all", source: "all", urgency: "all" });

  if (!embedded) {
    if (reportsQuery.isLoading) {
      return (
        <div className="px-4 py-12 md:px-7" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
          <Skeleton className="w-[240px] max-w-full" style={{ height: 32 }} />
          <Skeleton className="w-[400px] max-w-full" style={{ height: 20 }} />
          <Skeleton className="w-[320px] max-w-full" style={{ height: 20 }} />
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
  const setRange = (r: string) => setLocalRange(r);

  if (embedded && data === undefined) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center" }}>
        <p style={{ color: "var(--fg-muted)", fontSize: 14 }}>
          Growth analysis not available — pipeline did not produce this section for the current report.
        </p>
      </div>
    );
  }

  const G = data ?? GROWTH_DATA;
  const openEvidence = (refs: EvidenceRef) => setDrawerRefs(refs);
  const closeEvidence = () => setDrawerRefs(null);

  const filteredFeed = G.feed.filter((f) => {
    if (filter.intent !== "all" && f.intentType !== filter.intent) return false;
    if (filter.source !== "all" && f.source !== filter.source) return false;
    if (filter.urgency !== "all" && f.urgency !== filter.urgency) return false;
    return true;
  });

  return (
    <div>
      {!embedded && (
        <GrowthHeader range={range} setRange={setRange} />
      )}

      <div className="px-4 py-5 pb-12 md:px-7 md:py-[22px] md:pb-[60px]" style={{ maxWidth: 1440, margin: "0 auto" }}>
        <IntentSnapshot
          score={G.switchIntentScore}
          summary={G.highestOpportunitySummary}
          topOpportunity={G.topOpportunity}
          openEvidence={openEvidence}
        />

        <SectionHeadGR
          eyebrow="01 · Switch-intent feed"
          title="Live conversations where users are showing intent"
          subtitle="Prioritized by usefulness, not volume. Reply thoughtfully — RivalEye won't help you spam."
          right={<IntentFilters filter={filter} setFilter={setFilter} count={filteredFeed.length} total={G.feed.length} />}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredFeed.map((f) => (
            <FeedCard key={f.id} f={f} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadGR
          eyebrow="02 · Highest priority conversations"
          title="Today's shortlist"
          subtitle="The conversations worth opening, ranked. Hot first, research-only at the bottom."
        />
        <PriorityTable rows={G.priority} openEvidence={openEvidence} />

        <SectionHeadGR
          eyebrow="03 · Pricing pain leads"
          title="Users complaining about pricing — by lead quality"
          subtitle="Each card shows the team shape, budget hint, and the suggested pricing angle to lead with."
        />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14 }}>
          {G.pricingLeads.map((l, i) => (
            <PricingLeadCard key={i} l={l} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadGR
          eyebrow="04 · Communities to engage"
          title="Where the conversation is happening"
          subtitle="Fit-scored. Each row includes a recommended approach — and a spam-risk flag for the cautious."
        />
        <CommunitiesTable rows={G.communities} openEvidence={openEvidence} />

        <SectionHeadGR
          eyebrow="05 · Suggested reply angles"
          title="How to engage without sounding spammy"
          subtitle="Templates anchored to live conversations. Each one tells you what to NOT say first."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
          {G.replyAngles.map((r, i) => (
            <ReplyAngleCard key={i} r={r} index={i} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadGR
          eyebrow="06 · Segment & account hints"
          title="Who's behind these posts (inferred)"
          subtitle="Soft inferences from post content. Confidence-scored. Use as background, not as fact."
        />
        <SegmentHints rows={G.segmentHints} openEvidence={openEvidence} />
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

function GrowthHeader({ range, setRange }: { range: string; setRange: (r: string) => void }) {
  return (
    <div className="px-4 pt-5 pb-3.5 md:px-7" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <div style={{ ...eyebrow, letterSpacing: "0.02em" }}>Growth view · Switch-intent intelligence</div>
            <h1 className="re-h1" style={{ marginTop: 6 }}>
              Growth View
            </h1>
            <p className="text-fg-muted w-full max-w-[720px]" style={{ marginTop: 6, fontSize: 14 }}>
              Find switch-intent conversations and the right angle to engage. Built for thoughtful participation, not
              lead-scraping.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...monoFaint, fontSize: 12, marginRight: 4, letterSpacing: "0.02em" }}>Range</span>
            {["24h", "7d", "30d", "90d"].map((r) => (
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
              <Icon name="download" size={14} /> Export shortlist
            </button>
            <button type="button" className="re-btn re-btn-sm">
              <Icon name="alert" size={14} /> Set alerts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeadGR({
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
      <div className="min-w-0">
        <div style={{ ...eyebrow, fontSize: 11 }}>{eb}</div>
        <h2 className="re-h2" style={{ marginTop: 6, fontSize: 22 }}>
          {title}
        </h2>
        <p className="text-fg-muted w-full max-w-[680px]" style={{ margin: "4px 0 0", fontSize: 13 }}>
          {subtitle}
        </p>
      </div>
      {right}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HERO — INTENT SNAPSHOT

function IntentSnapshot({
  score,
  summary,
  topOpportunity,
  openEvidence,
}: {
  score: GrowthViewProps["switchIntentScore"];
  summary: string | null;
  topOpportunity: FeedItemProps | null;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:[grid-template-columns:minmax(0,0.95fr)_minmax(0,1.4fr)]" style={{ gap: 14 }}>
      {/* Score */}
      <div className="re-card re-card-elev" style={{ position: "relative", overflow: "hidden" }}>
        <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: 18 }}>
          <div style={{ ...eyebrow, fontSize: 11, letterSpacing: "0.02em" }}>Switch intent score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span
              className="font-mono-feat tnum"
              style={{ fontSize: "clamp(54px, 12vw, 72px)", fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 0.9, color: GRN }}
            >
              {score.score}
            </span>
            <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="re-chip" style={{ fontSize: 12, color: GRN, background: GRN_BG, border: `1px solid ${GRN}33` }}>
              {score.label}
            </span>
          </div>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "18px 0 12px" }} />

          <div style={{ ...eyebrow, fontSize: 11, marginBottom: 8, letterSpacing: "0.02em" }}>Score factors</div>
          <ScoreFactors factors={score.factors} />

          {score.explanation && (
            <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.6 }}>
              {score.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Top opportunity */}
      <div className="re-card re-card-elev" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="re-card-hd">
          <h3>
            <Icon name="alert" size={14} /> Highest opportunity right now
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 12 }}>
            live · auto-ranked
          </span>
        </div>
        {summary && (
          <div style={{ padding: 18 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)" }}>{summary}</p>
          </div>
        )}

        {topOpportunity && (
          <div
            style={{
              margin: "0 18px 18px",
              padding: 18,
              border: `1px solid ${GRN}33`,
              background: `linear-gradient(135deg, ${GRN_BG}, transparent 70%)`,
              borderRadius: 10,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UrgencyPill level={topOpportunity.urgency} />
                <span className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 600, color: GRN }}>
                  {topOpportunity.intentScore}
                  <span className="text-fg-faint" style={{ fontSize: 11 }}>
                    /100
                  </span>
                </span>
                <span style={{ width: 1, height: 14, background: "var(--border-soft)" }} />
                <span className="re-chip" style={{ fontSize: 11 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: coverageColor(topOpportunity.source),
                      marginRight: 4,
                    }}
                  />
                  {sourceName(topOpportunity.source)}
                </span>
                <span style={{ ...monoFaint, fontSize: 11 }}>{topOpportunity.sourceDate}</span>
              </div>
              <EngagementBadge level={topOpportunity.engagementLevel} />
            </div>

            <h3 className="break-words" style={{ margin: 0, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
              {topOpportunity.title}
            </h3>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, rowGap: 6 }}>
              <span style={labelMono({ letterSpacing: "0.02em" })}>Intent</span>
              <span style={{ fontSize: 12.5 }}>
                <IntentTag intent={topOpportunity.intentType} />
              </span>

              {topOpportunity.painMentioned && (
                <>
                  <span style={labelMono({ letterSpacing: "0.02em" })}>Pain</span>
                  <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{topOpportunity.painMentioned}</span>
                </>
              )}

              {topOpportunity.suggestedAngle && (
                <>
                  <span className="font-mono-feat" style={{ ...labelMono({ color: GRN, letterSpacing: "0.02em" }), fontWeight: 600 }}>
                    Angle
                  </span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--fg)", fontWeight: 500 }}>
                    {topOpportunity.suggestedAngle}
                  </span>
                </>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="re-btn re-btn-ghost re-btn-sm"
                onClick={() => openEvidence(topOpportunity.evidenceRefs)}
              >
                <Icon name="quote" size={12} /> Evidence
              </button>
              {topOpportunity.sourceUrl && (
                <a
                  href={topOpportunity.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="re-btn re-btn-sm"
                  style={{ background: GRN, color: "#fff", borderColor: GRN, textDecoration: "none" }}
                >
                  <Icon name="external" size={12} /> Open thread
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — FEED

function IntentFilters({
  filter,
  setFilter,
  count,
  total,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  count: number;
  total: number;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.08em", marginRight: 4 }}>
        {count}/{total} shown
      </span>
      <SelectChip
        label="Intent"
        value={filter.intent}
        onChange={(v) => setFilter({ ...filter, intent: v })}
        opts={[
          "all",
          "looking_for_alternative",
          "tool_recommendation_request",
          "competitor_frustration",
          "missing_feature_request",
          "migration_question",
          "churn_signal",
          "pricing_complaint",
          "what_do_you_use_instead",
        ]}
      />
      <SelectChip
        label="Source"
        value={filter.source}
        onChange={(v) => setFilter({ ...filter, source: v })}
        opts={["all", "reddit", "hn", "linkedin", "twitter"]}
      />
      <SelectChip
        label="Urgency"
        value={filter.urgency}
        onChange={(v) => setFilter({ ...filter, urgency: v })}
        opts={["all", "hot", "warm", "research"]}
      />
    </div>
  );
}

function SelectChip({
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
      <span className="text-fg-faint" style={{ fontSize: 11 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: 0,
          background: "transparent",
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 12,
          color: "var(--fg)",
          padding: "2px 4px",
          outline: "none",
          cursor: "pointer",
          maxWidth: 180,
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

function FeedCard({ f, openEvidence }: { f: FeedItemProps; openEvidence: (refs: EvidenceRef) => void }) {
  const uColor = urgencyColor(f.urgency);
  return (
    <div className="re-card" style={{ display: "grid", gridTemplateColumns: "70px 1fr", overflow: "hidden" }}>
      {/* Score gutter */}
      <div
        style={{
          background: `linear-gradient(180deg, ${uColor}15, transparent 100%)`,
          borderRight: "1px solid var(--border-soft)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "14px 6px",
        }}
      >
        <span
          className="font-mono-feat tnum"
          style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: uColor, lineHeight: 1 }}
        >
          {f.intentScore}
        </span>
        <span style={{ ...monoFaint, fontSize: 11, marginTop: 2, letterSpacing: "0.02em" }}>Intent</span>
        <div style={{ marginTop: 8 }}>
          <UrgencyPill level={f.urgency} />
        </div>
      </div>

      {/* Main content */}
      <div className="min-w-0" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="re-chip" style={{ fontSize: 11 }}>
            <span
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: 99,
                background: coverageColor(f.source),
                marginRight: 4,
              }}
            />
            {sourceName(f.source)}
          </span>
          {f.userOrContext && (
            <span className="font-mono-feat" style={{ fontSize: 12, color: "var(--fg)", fontWeight: 500 }}>
              {f.userOrContext}
            </span>
          )}
          <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
          <span style={{ ...monoFaint, fontSize: 11 }}>{f.sourceDate}</span>
          <span style={{ marginLeft: "auto" }}>
            <EngagementBadge level={f.engagementLevel} />
          </span>
        </div>

        <h3 className="break-words" style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{f.title}</h3>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <IntentTag intent={f.intentType} />
          {f.painMentioned && <PainTag pain={f.painMentioned} />}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => openEvidence(f.evidenceRefs)}
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
          {f.sourceUrl && (
            <a
              href={f.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="re-btn re-btn-sm"
              style={{ background: GRN, color: "#fff", borderColor: GRN, textDecoration: "none" }}
            >
              <Icon name="external" size={12} /> Open
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

const URGENCY_STYLES: Record<UiUrgency, { c: string; bg: string; lbl: string }> = {
  hot: { c: "var(--neg)", bg: "color-mix(in srgb, var(--neg) 10%, transparent)", lbl: "Hot" },
  warm: { c: "var(--warn)", bg: "color-mix(in srgb, var(--warn) 10%, transparent)", lbl: "Warm" },
  research: { c: "var(--fg-muted)", bg: "var(--surface-2)", lbl: "Research" },
};

function UrgencyPill({ level }: { level: UiUrgency }) {
  const map = URGENCY_STYLES[level];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        background: map.bg,
        color: map.c,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 11,
        textTransform: "none",
        letterSpacing: "0.06em",
        fontWeight: 700,
      }}
    >
      {map.lbl}
    </span>
  );
}

type LowMedHigh = "low" | "medium" | "high";

const ENGAGEMENT_STYLES: Record<LowMedHigh, { c: string; bg: string; lbl: string }> = {
  high: { c: GRN, bg: GRN_BG, lbl: "High engagement" },
  medium: { c: "var(--warn)", bg: "color-mix(in srgb, var(--warn) 8%, transparent)", lbl: "Med engagement" },
  low: { c: "var(--fg-muted)", bg: "var(--surface-2)", lbl: "Low engagement" },
};

function EngagementBadge({ level }: { level: LowMedHigh }) {
  const map = ENGAGEMENT_STYLES[level];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        background: map.bg,
        color: map.c,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 11,
        textTransform: "none",
        letterSpacing: "0.06em",
        fontWeight: 600,
        border: `1px solid ${map.c}33`,
      }}
    >
      {map.lbl}
    </span>
  );
}

const INTENT_COLORS: Record<SwitchIntentType, string> = {
  looking_for_alternative: "#dc2626",
  tool_recommendation_request: "#0061B1",
  competitor_frustration: "#d97706",
  missing_feature_request: "#6366f1",
  migration_question: "#8b5cf6",
  churn_signal: "#0ea5e9",
  pricing_complaint: "#0061B1",
  what_do_you_use_instead: "#dc2626",
};

function IntentTag({ intent }: { intent: SwitchIntentType }) {
  const c = INTENT_COLORS[intent] ?? "var(--fg-muted)";
  const label = intent.replace(/_/g, "-");
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        background: `${c}14`,
        color: c,
        border: `1px solid ${c}33`,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 11,
        textTransform: "none",
        letterSpacing: "0.04em",
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

function PainTag({ pain }: { pain: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        background: "var(--surface-2)",
        color: "var(--fg-muted)",
        border: "1px solid var(--border-soft)",
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 11,
        textTransform: "none",
        letterSpacing: "0.04em",
      }}
    >
      pain · {pain}
    </span>
  );
}

type SpamRisk = LowMedHigh;

const SPAM_STYLES: Record<SpamRisk, { c: string; bg: string; lbl: string }> = {
  low: { c: "var(--pos)", bg: "color-mix(in srgb, var(--pos) 8%, transparent)", lbl: "Low spam risk" },
  medium: { c: "var(--warn)", bg: "color-mix(in srgb, var(--warn) 8%, transparent)", lbl: "Watch tone" },
  high: { c: "var(--neg)", bg: "color-mix(in srgb, var(--neg) 8%, transparent)", lbl: "High spam risk" },
};

function SpamRiskBadge({ level }: { level: SpamRisk }) {
  const map = SPAM_STYLES[level];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        background: map.bg,
        color: map.c,
        border: `1px solid ${map.c}33`,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 11,
        textTransform: "none",
        letterSpacing: "0.06em",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Icon name="alert" size={9} />
      {map.lbl}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — PRIORITY TABLE

const PRIO_COLS = "100px minmax(260px, 2fr) 1.1fr 130px 110px 1.3fr 100px";

function PriorityTable({
  rows,
  openEvidence,
}: {
  rows: PriorityConversationProps[];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card overflow-x-auto">
      <div style={{ minWidth: 920 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: PRIO_COLS,
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
        <span>Priority</span>
        <span>Conversation</span>
        <span>Intent</span>
        <span>Pain</span>
        <span>Source</span>
        <span>Suggested action</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: PRIO_COLS,
            padding: "14px 18px",
            borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            alignItems: "center",
            gap: 12,
          }}
        >
          <UrgencyPill level={r.priority} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>{r.conversationTitle}</div>
            <div style={{ ...monoFaint, fontSize: 11, marginTop: 2 }}>
              {sourceName(r.source)} · {r.sourceDate}
            </div>
          </div>
          <div>
            <IntentTag intent={r.intentType} />
          </div>
          <div>
            {r.pain && <PainTag pain={r.pain} />}
          </div>
          <div>
            <span className="re-chip" style={{ fontSize: 11 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: coverageColor(r.source),
                  marginRight: 4,
                }}
              />
              {sourceName(r.source)}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.4, color: "var(--fg-muted)" }}>{r.suggestedAction}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-sm"
              onClick={() => openEvidence(r.evidenceRefs)}
            >
              <Icon name="quote" size={12} /> Evidence
            </button>
            {r.sourceUrl && (
              <a
                href={r.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="re-btn re-btn-ghost re-btn-sm"
                style={{ textDecoration: "none" }}
              >
                <Icon name="external" size={12} /> Open
              </a>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 3 — PRICING PAIN LEADS

function PricingLeadCard({
  l,
  openEvidence,
}: {
  l: PricingLeadProps;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card">
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          className="re-chip"
          style={{ fontSize: 11, background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid transparent" }}
        >
          Pricing pain
        </span>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{l.title}</h3>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--fg-muted)" }}>{l.pricingIssue}</p>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, rowGap: 8 }}>
          {l.teamSizeHint && <Chiplet label="Team" value={l.teamSizeHint} />}
          <Chiplet label="Budget sensitivity" value={l.budgetSensitivity} tone={l.budgetSensitivity === "Low" ? "neg" : "neu"} />
          {l.alternativeInterest && (
            <Chiplet
              label="Alt interest"
              value={l.alternativeInterest}
              tone={l.alternativeInterest === "explicit" ? "neg" : "neu"}
            />
          )}
          {l.planLimitation && <Chiplet label="Plan limit" value={l.planLimitation} />}
        </div>

        {l.suggestedPricingAngle && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: GRN_BG,
              borderLeft: `2px solid ${GRN}`,
            }}
          >
            <div
              className="font-mono-feat"
              style={{
                fontSize: 11,
                color: GRN,
                textTransform: "none",
                letterSpacing: "0.02em",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Suggested angle
            </div>
            <span style={{ fontSize: 12.5, lineHeight: 1.6 }}>{l.suggestedPricingAngle}</span>
          </div>
        )}

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => openEvidence(l.evidenceRefs)}
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
        </div>
      </div>
    </div>
  );
}

function Chiplet({ label, value, tone }: { label: string; value: string; tone?: "neg" | "neu" }) {
  const color = tone === "neg" ? "var(--neg)" : "var(--fg)";
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 8,
        background: "var(--surface-solid)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <div style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.08em" }}>{label}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          marginTop: 3,
          color,
          textTransform: tone === "neg" ? "uppercase" : "none",
          letterSpacing: tone === "neg" ? "0.04em" : 0,
          fontFamily: tone === "neg" ? "var(--font-mono, 'Geist Mono', ui-monospace, monospace)" : "inherit",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4 — COMMUNITIES TABLE

const COMM_COLS = "minmax(200px,1.4fr) 90px 1.1fr 100px 100px 1.6fr 110px";

function CommunitiesTable({
  rows,
  openEvidence,
}: {
  rows: CommunityProps[];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card overflow-x-auto">
      <div style={{ minWidth: 920 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COMM_COLS,
          padding: "10px 18px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          fontSize: 11,
          textTransform: "none",
          letterSpacing: "0.08em",
          color: "var(--fg-faint)",
          gap: 14,
        }}
      >
        <span>Community</span>
        <span>Posts</span>
        <span>Dominant pain</span>
        <span>Engagement</span>
        <span>Fit</span>
        <span>Recommended approach</span>
        <span>Spam risk</span>
      </div>
      {rows.map((c, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: COMM_COLS,
            padding: "14px 18px",
            borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            alignItems: "center",
            gap: 14,
            cursor: "pointer",
          }}
          onClick={() => openEvidence(c.evidenceRefs)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: `${coverageColor(c.source)}20`,
                border: `1px solid ${coverageColor(c.source)}40`,
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: coverageColor(c.source),
                fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              }}
            >
              {c.name[0] === "r" ? "r/" : c.name[0]}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
              <div style={{ ...monoFaint, fontSize: 11, marginTop: 2 }}>{sourceName(c.source)}</div>
            </div>
          </div>
          <div className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 500 }}>
            {c.posts}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{c.dominantPain ?? "—"}</div>
          <div>
            <EngagementBadge level={c.engagementLevel} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="re-meter" style={{ flex: 1, height: 3 }}>
              <i style={{ width: `${c.fit * 100}%`, background: GRN }} />
            </div>
            <span className="font-mono-feat tnum" style={{ fontSize: 11, color: GRN }}>
              {Math.round(c.fit * 100)}
            </span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--fg-muted)" }}>
            {c.recommendedApproach ?? "—"}
          </div>
          <div>
            <SpamRiskBadge level={c.spamRisk} />
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — REPLY ANGLES

function ReplyAngleCard({
  r,
  index,
  openEvidence,
}: {
  r: ReplyAngleProps;
  index: number;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border-soft)",
          background: `linear-gradient(90deg, ${GRN_BG}, transparent 70%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="font-mono-feat"
          style={{ fontSize: 11, color: GRN, textTransform: "none", letterSpacing: "0.02em", fontWeight: 700 }}
        >
          Template {String(index + 1).padStart(2, "0")}
        </span>
        <SpamRiskBadge level={r.spamRisk} />
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <div style={{ ...eyebrow, fontSize: 11, marginBottom: 4, letterSpacing: "0.02em" }}>Context</div>
          <p className="text-fg-muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
            {r.contextSummary}
          </p>
        </div>

        <div style={{ padding: 10, background: GRN_BG, borderRadius: 8, borderLeft: `2px solid ${GRN}` }}>
          <div
            className="font-mono-feat"
            style={{
              fontSize: 11,
              color: GRN,
              textTransform: "none",
              letterSpacing: "0.02em",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Acknowledge
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.6 }}>{r.whatToAcknowledge}</span>
        </div>

        <div
          style={{ padding: 10, background: "color-mix(in srgb, var(--neg) 5%, transparent)", borderRadius: 8, borderLeft: "2px solid var(--neg)" }}
        >
          <div
            className="font-mono-feat"
            style={{
              fontSize: 11,
              color: "var(--neg)",
              textTransform: "none",
              letterSpacing: "0.02em",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Don't
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.6 }}>{r.whatNotToSay}</span>
        </div>

        <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
          <div
            className="font-mono-feat"
            style={{
              fontSize: 11,
              color: "var(--fg)",
              textTransform: "none",
              letterSpacing: "0.02em",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Helpful reply
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, fontStyle: "italic" }}>"{r.helpfulReplyAngle}"</p>
          {r.softCtaSuggestion && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px dashed var(--border-strong)",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span style={{ ...monoFaint, fontSize: 11, textTransform: "none", letterSpacing: "0.02em" }}>
                Soft CTA
              </span>
              <span style={{ fontSize: 13, color: "var(--fg-muted)", fontStyle: "italic" }}>{r.softCtaSuggestion}</span>
            </div>
          )}
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 6, alignItems: "center", paddingTop: 4 }}>
          <ConfidenceIndicator confidence={r.confidence} />
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => openEvidence(r.evidenceRefs)}
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="download" size={12} /> Copy
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 6 — SEGMENT HINTS

function SegmentHints({
  rows,
  openEvidence,
}: {
  rows: SegmentHintProps[];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
      {rows.map((r, i) => (
        <div key={i} className="re-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="font-mono-feat" style={{ fontSize: 12, fontWeight: 600 }}>
              {r.roleHint ?? "Inferred segment"}
            </span>
            <ConfidenceIndicator confidence={r.confidence} />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {r.companyOrTeamSizeHint && <SegChip>{r.companyOrTeamSizeHint}</SegChip>}
            {r.useCase && <SegChip>{r.useCase}</SegChip>}
            {r.industry && <SegChip>{r.industry}</SegChip>}
            <SegChip tone={r.urgency === "hot" ? "neg" : r.urgency === "warm" ? "warn" : "neu"}>
              urgency · {r.urgency}
            </SegChip>
            <SegChip tone={r.budgetSensitivity === "Low" ? "neg" : "neu"}>
              budget · {r.budgetSensitivity.toLowerCase()}
            </SegChip>
            <SegChip>tech · {r.technicalMaturity.toLowerCase()}</SegChip>
          </div>

          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border-soft)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-sm"
              onClick={() => openEvidence(r.evidenceRefs)}
            >
              <Icon name="quote" size={12} /> Evidence
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SegChip({ children, tone }: { children: React.ReactNode; tone?: "neg" | "warn" | "pos" | "neu" }) {
  const c =
    tone === "neg" ? "var(--neg)" : tone === "warn" ? "var(--warn)" : tone === "pos" ? "var(--pos)" : "var(--fg-muted)";
  const bg =
    tone === "neg"
      ? "color-mix(in srgb, var(--neg) 8%, transparent)"
      : tone === "warn"
        ? "color-mix(in srgb, var(--warn) 8%, transparent)"
        : tone === "pos"
          ? "color-mix(in srgb, var(--pos) 8%, transparent)"
          : "var(--surface-2)";
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        background: bg,
        color: c,
        border: `1px solid ${tone ? `${c}33` : "var(--border-soft)"}`,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER

