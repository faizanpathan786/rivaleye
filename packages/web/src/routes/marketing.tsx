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
  type EvidenceRef,
  type EvidenceSection,
  type Confidence,
} from "@/lib/dashboard-helpers";
import type {
  MarketingViewProps,
  ScoreFactor,
  PhraseItem,
} from "@/lib/dashboard-adapters/marketing";

// Marketing View — positioning intelligence workspace.
// Answers: "What should we say, what language should we use, how should we position?"
// Accepts an optional `data: MarketingViewProps` prop (from the adapter).
// When `data` is undefined, falls back to MARKETING_DATA mock so the
// standalone /marketing design-demo route keeps working.

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

function mockPhraseItems(
  entries: Array<{ phrase: string; count: number; sentiment: number }>,
): PhraseItem[] {
  return entries.map((e) => ({
    phrase: e.phrase,
    frequency: e.count,
    sentiment: e.sentiment,
    source_count: 3,
    evidence_refs: EMPTY_REFS,
  }));
}

/** Convert ScoreFactor[] → Record<string, number> for <ScoreFactors>. */
function factorsToRecord(factors: ScoreFactor[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of factors) {
    out[f.key] = f.value;
  }
  return out;
}

/** Severity float → CSS color token. */
function severityColor(v: number): string {
  const bucket = bucketFloat(v);
  if (bucket === "high") return "var(--neg)";
  if (bucket === "medium") return "var(--warn)";
  return "var(--fg-muted)";
}

// ─────────────────────────────────────────────────────────────────────────
// Mock data — typed to match MarketingViewProps

const MARKETING_DATA: MarketingViewProps = {
  role: "marketing",
  competitor_id: "linear",
  generated_at: "2026-05-22T00:00:00Z",

  score: {
    score: 86,
    label: "Strong messaging opportunity",
    explanation:
      "Users describe Linear as fast, opinionated, and beautiful — but increasingly say it 'punishes growth,' is 'read-mostly' on mobile, and forces 'a tax' just to get SSO.",
    factors: [
      { key: "repeated_user_language_strength", value: 0.92 },
      { key: "pain_clarity", value: 0.88 },
      { key: "promise_reality_gap", value: 0.78 },
      { key: "objection_frequency", value: 0.71 },
      { key: "quote_quality", value: 0.84 },
      { key: "source_confidence", value: 0.91 },
    ],
  },

  messaging_summary:
    "Users describe Linear as fast, opinionated, and beautiful — but increasingly say it 'punishes growth,' is 'read-mostly' on mobile, and forces 'a tax' just to get SSO. " +
    "The strongest messaging wedge is predictability — pricing that scales with your team's growth, not against it. " +
    "Secondary wedges: triage-first mobile and an executive view your CEO actually opens.",

  language: {
    positive_phrases: mockPhraseItems([
      { phrase: "fast", count: 312, sentiment: 0.7 },
      { phrase: "beautiful", count: 187, sentiment: 0.8 },
      { phrase: "opinionated", count: 142, sentiment: 0.6 },
      { phrase: "keyboard-first", count: 98, sentiment: 0.7 },
      { phrase: "focused", count: 76, sentiment: 0.5 },
      { phrase: "muscle memory", count: 64, sentiment: 0.6 },
      { phrase: "shipping tool", count: 54, sentiment: 0.6 },
      { phrase: "it has taste", count: 47, sentiment: 0.8 },
      { phrase: "actually fun", count: 38, sentiment: 0.7 },
    ]),
    negative_phrases: mockPhraseItems([
      { phrase: "expensive", count: 287, sentiment: -0.7 },
      { phrase: "per-seat", count: 218, sentiment: -0.5 },
      { phrase: "begging finance", count: 62, sentiment: -0.8 },
      { phrase: "read-mostly", count: 98, sentiment: -0.5 },
      { phrase: "punishes growth", count: 74, sentiment: -0.7 },
      { phrase: "SSO tax", count: 76, sentiment: -0.6 },
      { phrase: "rigid", count: 142, sentiment: -0.5 },
      { phrase: "no Gantt", count: 119, sentiment: -0.4 },
      { phrase: "contractor problem", count: 87, sentiment: -0.6 },
      { phrase: "workaround", count: 47, sentiment: -0.5 },
      { phrase: "Plus tier just for SSO", count: 41, sentiment: -0.7 },
    ]),
    alternative_seeking_phrases: mockPhraseItems([
      { phrase: "looking for a Linear alternative", count: 142, sentiment: -0.4 },
      { phrase: "anyone tried [...] instead", count: 98, sentiment: -0.3 },
      { phrase: "leaving Linear because", count: 76, sentiment: -0.6 },
      { phrase: "what do you use instead", count: 62, sentiment: -0.3 },
      { phrase: "moving off Linear", count: 41, sentiment: -0.5 },
      { phrase: "alternatives that don't charge", count: 38, sentiment: -0.6 },
      { phrase: "considering switching", count: 29, sentiment: -0.4 },
    ]),
    emotional_adjectives: mockPhraseItems([
      { phrase: "delightful", count: 54, sentiment: 0.8 },
      { phrase: "frustrating", count: 119, sentiment: -0.6 },
      { phrase: "overwhelming", count: 88, sentiment: -0.5 },
      { phrase: "refreshing", count: 42, sentiment: 0.7 },
      { phrase: "painful", count: 76, sentiment: -0.7 },
      { phrase: "elegant", count: 61, sentiment: 0.8 },
    ]),
    category_language: mockPhraseItems([
      { phrase: "project management", count: 203, sentiment: 0.1 },
      { phrase: "issue tracking", count: 178, sentiment: 0.2 },
      { phrase: "sprint planning", count: 94, sentiment: 0.3 },
      { phrase: "roadmap tool", count: 87, sentiment: 0.2 },
      { phrase: "agile software", count: 64, sentiment: 0.1 },
      { phrase: "eng productivity", count: 52, sentiment: 0.4 },
    ]),
  },

  bestAngle: {
    angle_title: "Power without the price-as-you-grow tax",
    suggested_message: "All the speed. None of the seat tax.",
    pain_targeted: "Per-seat math becomes uncomfortable past seat 15.",
    competitor_weakness: "Pricing scales linearly with headcount.",
    competitor_strength_to_respect: "Linear is fast — match the floor.",
    best_channel_or_use_case: "Homepage hero, Comparison page, Search ads",
    risk_warning: "Don't undercut yourself by leading with 'cheap.' Lead with 'predictable.'",
    confidence: mockConfidence(0.94),
    evidence_refs: EMPTY_REFS,
  },

  angles: [
    {
      angle_title: "Power without the price-as-you-grow tax",
      suggested_message: "All the speed. None of the seat tax.",
      pain_targeted: "Per-seat math past 15 seats",
      competitor_weakness: "Pricing scales linearly with headcount",
      competitor_strength_to_respect: "Linear is fast — match the floor",
      best_channel_or_use_case: "Homepage hero, Comparison page, Search ads",
      risk_warning: "Don't undercut yourself by leading with 'cheap.' Lead with 'predictable.'",
      confidence: mockConfidence(0.94),
      evidence_refs: EMPTY_REFS,
    },
    {
      angle_title: "Mobile that runs your standup",
      suggested_message: "Triage from your phone. Actually.",
      pain_targeted: "Linear's mobile is 'read-mostly'",
      competitor_weakness: "Mobile beyond reading is unsupported",
      competitor_strength_to_respect: "The web app is excellent — don't claim parity",
      best_channel_or_use_case: "LinkedIn posts, Sales decks, Mobile-app ads",
      risk_warning: "Easy to overpromise. Ship the three actions first, then talk.",
      confidence: mockConfidence(0.78),
      evidence_refs: EMPTY_REFS,
    },
    {
      angle_title: "Built for billable hours",
      suggested_message: "PM tool that ships invoices, not workarounds.",
      pain_targeted: "No native time tracking forces Toggl + manual reconciliation",
      competitor_weakness: "No native time tracking",
      competitor_strength_to_respect: "Linear is not trying to be an agency tool",
      best_channel_or_use_case: "Agency vertical landing page, PPC for 'time tracking PM tool'",
      risk_warning: "Don't dilute your brand with too-narrow vertical messaging on the main site.",
      confidence: mockConfidence(0.91),
      evidence_refs: EMPTY_REFS,
    },
    {
      angle_title: "The roadmap your CEO opens",
      suggested_message: "From engineering rhythm to executive picture.",
      pain_targeted: "Cycles work for eng, not for board updates",
      competitor_weakness: "No exec-ready quarterly view",
      competitor_strength_to_respect: "Cycles are loved by engineers — extend, don't replace",
      best_channel_or_use_case: "LinkedIn thought leadership, PMM-targeted ads",
      risk_warning: "Implies you have a polished exec view — make sure that's true before campaigning.",
      confidence: mockConfidence(0.84),
      evidence_refs: EMPTY_REFS,
    },
    {
      angle_title: "Ship in the tool. Announce in the tool.",
      suggested_message: "Your roadmap. Your changelog. No more Notion drift.",
      pain_targeted: "No customer-facing portal — Notion is the workaround",
      competitor_weakness: "No customer-facing changelog portal",
      competitor_strength_to_respect: "Linear ships fast — don't underestimate them shipping this too",
      best_channel_or_use_case: "B2B SaaS landing page, Customer-marketing blog",
      risk_warning: "Linear may ship this in 6 months. Move soon if you commit.",
      confidence: mockConfidence(0.81),
      evidence_refs: EMPTY_REFS,
    },
    {
      angle_title: "Made for the team you have today",
      suggested_message:
        "Power without the bloat — built for the team you have, not the one you're 'supposed to' want.",
      pain_targeted: "Tools either feel toy-grade or enterprise-bloated.",
      competitor_weakness: "Mid-market teams feel underserved",
      competitor_strength_to_respect: "Linear has the best taste in the category — don't pretend otherwise",
      best_channel_or_use_case: "Founder-voice LinkedIn posts, Reddit organic",
      risk_warning: "Vague if you don't sharpen which 'team you have today' you mean. Pick one segment.",
      confidence: mockConfidence(0.74),
      evidence_refs: EMPTY_REFS,
    },
  ],

  promiseReality: [
    {
      competitor_claim: '"The issue tracking tool for high-performance teams"',
      user_reality:
        "Users say Linear is high-performance for engineering — but leadership, agencies, and field teams describe it as 'half a tool' or 'web-only.'",
      gap_summary: "Performance gap beyond engineering roles",
      messaging_opportunity:
        "High performance for everyone — the founder, the PM, the CSM, the contractor on a phone.",
      evidence_count: 187,
      evidence_refs: EMPTY_REFS,
    },
    {
      competitor_claim: '"Linear scales with your team"',
      user_reality:
        "Users explicitly model 'pain inflection at 15–25 seats.' Pricing scales with team size — the criticism is that it scales linearly.",
      gap_summary: "Pricing scales linearly, not with value",
      messaging_opportunity: "Pricing that flattens as you grow. Show the seat-math comparison.",
      evidence_count: 287,
      evidence_refs: EMPTY_REFS,
    },
    {
      competitor_claim: '"Built for product teams"',
      user_reality:
        "Praised by engineers; rejected by leadership for board updates. Agencies maintain parallel tools.",
      gap_summary: "'Product teams' means 'product engineering' only",
      messaging_opportunity:
        "Built for the whole product org — engineering, leadership, and customer-facing.",
      evidence_count: 119,
      evidence_refs: EMPTY_REFS,
    },
    {
      competitor_claim: '"Cycles, roadmaps, projects — one tool"',
      user_reality:
        "Cycles loved; roadmaps called 'too rigid for execs;' customers want a public-facing roadmap and a Gantt-style executive view.",
      gap_summary: "Roadmaps missing exec and customer-facing views",
      messaging_opportunity: "One tool, including the public roadmap your customers see.",
      evidence_count: 241,
      evidence_refs: EMPTY_REFS,
    },
    {
      competitor_claim: '"Modern, fast, beautiful"',
      user_reality:
        "Universally agreed on web. Mobile is repeatedly called 'read-mostly' and 'a billboard.'",
      gap_summary: "Mobile doesn't match the web experience",
      messaging_opportunity:
        "Modern, fast, beautiful — everywhere you work, including your pocket.",
      evidence_count: 134,
      evidence_refs: EMPTY_REFS,
    },
  ],

  objections: [
    {
      objection_title: '"Is a cheaper tool less powerful?"',
      objection_type: "Pricing",
      why_users_hesitate:
        "Buyers conflate price and power. Linear's premium pricing signals quality. Switching feels like a downgrade.",
      frequency: 0.92,
      suggested_response:
        "Don't lead with cheap. Lead with predictable. Show the 30-seat math comparison alongside a feature parity table.",
      confidence: mockConfidence(0.91),
      evidence_refs: EMPTY_REFS,
    },
    {
      objection_title: '"Moving 4,000 issues is a nightmare."',
      objection_type: "Migration",
      why_users_hesitate:
        "Migration cost is the biggest emotional friction. Even price-pained users stay because moving feels worse.",
      frequency: 0.78,
      suggested_response:
        "Lead with a one-click Linear import. Demo it on the homepage. Make migration the proof, not the promise.",
      confidence: mockConfidence(0.86),
      evidence_refs: EMPTY_REFS,
    },
    {
      objection_title: '"Will you still be here in two years?"',
      objection_type: "Trust",
      why_users_hesitate: "Smaller players have to clear the 'will they survive' bar. Linear is established; you are not.",
      frequency: 0.62,
      suggested_response:
        "Show real customer logos, ARR if mature enough, public roadmap with shipped items. Repetition over assertion.",
      confidence: mockConfidence(0.72),
      evidence_refs: EMPTY_REFS,
    },
    {
      objection_title: '"Does it have [Linear feature]?"',
      objection_type: "Feature completeness",
      why_users_hesitate:
        "Buyers measure new tools against their current toolkit. Missing one beloved feature can be a deal-breaker.",
      frequency: 0.71,
      suggested_response:
        "Publish a public feature parity table. Be honest about what you don't have, with timelines on the ones that are coming.",
      confidence: mockConfidence(0.78),
      evidence_refs: EMPTY_REFS,
    },
    {
      objection_title: '"How long is setup, really?"',
      objection_type: "Complexity",
      why_users_hesitate:
        "Linear's onboarding is a benchmark. Anything that feels slower in first 10 minutes feels worse, even if it's better long-term.",
      frequency: 0.66,
      suggested_response:
        "Match the 10-minute setup benchmark. Show a public demo workspace with one click 'try as a sample team.'",
      confidence: mockConfidence(0.83),
      evidence_refs: EMPTY_REFS,
    },
    {
      objection_title: '"Does it talk to GitHub / Slack / Figma?"',
      objection_type: "Integration",
      why_users_hesitate: "Linear's integrations are deep and praised. Buyers assume new tools won't match.",
      frequency: 0.84,
      suggested_response:
        "Top-3 integrations on the homepage. Demo them in motion. Don't hide them in a feature list.",
      confidence: mockConfidence(0.89),
      evidence_refs: EMPTY_REFS,
    },
  ],

  comparison: {
    hero_angle: "All the speed. None of the seat tax.",
    why_users_look_for_alternatives: [
      "Pricing becomes painful past 15 seats — flat tiers exist for a reason.",
      "Contractors and PMs shouldn't cost a full seat for partial work.",
      "Mobile is for triage, not just reading.",
      "Executive views shouldn't require a slide deck.",
    ],
    where_competitor_is_strong: [
      "Speed and keyboard-first feel",
      "GitHub / Slack / Figma integrations",
      "Cycles model for two-week shipping",
      "Opinionated, focused product",
    ],
    where_users_struggle: [
      "Per-seat math at scale",
      "Mobile beyond reading",
      "Executive Gantt / dependency views",
      "Native time tracking",
      "Customer-facing changelog",
    ],
    who_should_choose_us: [
      "You're 15–80 people and the seat math has started to bite.",
      "You bill clients by the hour and live in two tools.",
      "Your CEO wants a quarterly view, not a cycle.",
      "Your CSMs need scoped access without the full roadmap.",
    ],
    objections_to_handle: [
      "Will my GitHub / Slack integrations still work?",
      "How long does migration take?",
      "Is flat pricing really that different?",
    ],
    proof_quotes: [
      "Once we hit 22 people I started begging finance for a flat tier.",
      "Our CEO opens Linear, closes it, and asks for a slide instead.",
      "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear.",
    ],
  },

  copy: {
    homepage_headlines: [
      {
        copy: "All the speed. None of the seat tax.",
        signal_behind_it: "287 mentions of 'expensive,' 218 of 'per-seat'",
        best_use_case: "Homepage hero",
        confidence: mockConfidence(0.94),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "The project tool that doesn't punish you for growing.",
        signal_behind_it: "74 mentions of 'punishes growth'",
        best_use_case: "Homepage hero",
        confidence: mockConfidence(0.88),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "Power without the bloat.",
        signal_behind_it: "142 mentions of 'rigid,' 98 of 'overwhelming'",
        best_use_case: "Homepage hero",
        confidence: mockConfidence(0.84),
        evidence_refs: EMPTY_REFS,
      },
    ],
    subheadlines: [
      {
        copy: "Predictable pricing that flattens as you grow.",
        signal_behind_it: "Per-seat math fatigue",
        best_use_case: "Hero subhead",
        confidence: mockConfidence(0.92),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "Triage from your phone. Actually.",
        signal_behind_it: "Mobile 'read-mostly' complaints",
        best_use_case: "Feature page",
        confidence: mockConfidence(0.78),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "Ship in the tool. Announce in the same tool.",
        signal_behind_it: "Notion-drift workaround",
        best_use_case: "Portal feature page",
        confidence: mockConfidence(0.81),
        evidence_refs: EMPTY_REFS,
      },
    ],
    ad_hooks: [
      {
        copy: "Begging finance for a flat tier? Same.",
        signal_behind_it: "Verbatim quote, 62 mentions",
        best_use_case: "Reddit ads, LinkedIn",
        confidence: mockConfidence(0.86),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "Linear's per-seat math, but flatter.",
        signal_behind_it: "Direct competitor reference",
        best_use_case: "Search ads",
        confidence: mockConfidence(0.84),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "PM tool that ships invoices, not workarounds.",
        signal_behind_it: "Agency segment",
        best_use_case: "Vertical LinkedIn",
        confidence: mockConfidence(0.81),
        evidence_refs: EMPTY_REFS,
      },
    ],
    linkedin_hooks: [
      {
        copy: "The cheapest way to lose your best engineers is the most expensive feature in the suite. Here's how we priced for the other 90%.",
        signal_behind_it: "Pricing pain",
        best_use_case: "Founder LinkedIn",
        confidence: mockConfidence(0.84),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak. (Thread.)",
        signal_behind_it: "Agency wedge",
        best_use_case: "PM thought leadership",
        confidence: mockConfidence(0.88),
        evidence_refs: EMPTY_REFS,
      },
    ],
    comparison_page_headlines: [
      {
        copy: "The Linear alternative that doesn't punish your growth.",
        signal_behind_it: "Per-seat math complaints",
        best_use_case: "/linear-alternative hero",
        confidence: mockConfidence(0.91),
        evidence_refs: EMPTY_REFS,
      },
    ],
    cta_ideas: [
      {
        copy: "See the seat-math comparison",
        signal_behind_it: "Pricing pain",
        best_use_case: "Hero CTA",
        confidence: mockConfidence(0.92),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "Run the migration in 5 minutes",
        signal_behind_it: "Migration objection",
        best_use_case: "Hero CTA",
        confidence: mockConfidence(0.86),
        evidence_refs: EMPTY_REFS,
      },
      {
        copy: "Try it on your phone first",
        signal_behind_it: "Mobile wedge",
        best_use_case: "Secondary CTA",
        confidence: mockConfidence(0.74),
        evidence_refs: EMPTY_REFS,
      },
    ],
  },

  quoteLib: [
    {
      quote:
        "Once we hit 22 people I started begging finance for a flat tier. Linear's pricing scales linearly with us — that's the problem.",
      source: "u/founder_42 · r/SaaS",
      source_date: "2026-05-19",
      sentiment: -0.7,
      signals: ["pricing"],
      related_positioning_angle: "Power without the seat tax",
      copy_usefulness_score: 0.96,
      source_url: null,
    },
    {
      quote:
        "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak.",
      source: "u/contractor_v · r/ExperiencedDevs",
      source_date: "2026-05-12",
      sentiment: -0.6,
      signals: ["gap"],
      related_positioning_angle: "Built for billable hours",
      copy_usefulness_score: 0.94,
      source_url: null,
    },
    {
      quote:
        "Our CEO opens Linear, closes it, and asks for a slide instead. We've given up trying to use it for board updates.",
      source: "u/pm_throwaway · r/ProductManagement",
      source_date: "2026-05-07",
      sentiment: -0.55,
      signals: ["gap"],
      related_positioning_angle: "The roadmap your CEO opens",
      copy_usefulness_score: 0.93,
      source_url: null,
    },
    {
      quote: "If I'm not at my desk I just can't run standup. The mobile app is read-mostly.",
      source: "u/pm_mariana · r/ProductManagement",
      source_date: "2026-05-14",
      sentiment: -0.55,
      signals: ["gap"],
      related_positioning_angle: "Mobile that runs your standup",
      copy_usefulness_score: 0.91,
      source_url: null,
    },
    {
      quote: "Plus tier just to get SSO. Felt like a tax.",
      source: "u/pm_throwaway · r/ProductManagement",
      source_date: "2026-05-14",
      sentiment: -0.65,
      signals: ["pricing"],
      related_positioning_angle: "Power without the seat tax",
      copy_usefulness_score: 0.89,
      source_url: null,
    },
    {
      quote: "Quoted $42k/yr for 180 seats. Same headcount in Jira would be a third.",
      source: "u/founder_42 · r/SaaS",
      source_date: "2026-05-19",
      sentiment: -0.7,
      signals: ["pricing"],
      related_positioning_angle: "Power without the seat tax",
      copy_usefulness_score: 0.88,
      source_url: null,
    },
    {
      quote: "I love Linear. I cannot justify it to finance when we hire 30 contractors a year.",
      source: "u/eng_lead · r/ExperiencedDevs",
      source_date: "2026-05-07",
      sentiment: -0.5,
      signals: ["pricing"],
      related_positioning_angle: "Power without the seat tax",
      copy_usefulness_score: 0.95,
      source_url: null,
    },
    {
      quote: "It does five things and does them better than anything. Refreshing in 2026.",
      source: "u/founder_h · r/SaaS",
      source_date: "2026-05-12",
      sentiment: 0.7,
      signals: ["love"],
      related_positioning_angle: "Respect: match the floor",
      copy_usefulness_score: 0.78,
      source_url: null,
    },
    {
      quote: "GitHub sync alone justifies the cost. It's the only PM tool that lives where my code lives.",
      source: "u/devops_dan · r/sysadmin",
      source_date: "2026-04-30",
      sentiment: 0.5,
      signals: ["love"],
      related_positioning_angle: "Respect: match the integrations",
      copy_usefulness_score: 0.81,
      source_url: null,
    },
  ],

  evidence_refs: EMPTY_REFS,
};

const COMPETITOR = { name: "Linear", domain: "linear.app" };

const VIO = "#8b5cf6";
const VIO_BG = "rgba(139,92,246,0.08)";

// ─────────────────────────────────────────────────────────────────────────
// Language bank tab type

type LangTab =
  | "positive_phrases"
  | "negative_phrases"
  | "alternative_seeking_phrases"
  | "emotional_adjectives"
  | "category_language";

const LANG_TABS: Array<{ key: LangTab; label: string; sub: string; tone: "pos" | "neg" | "seek" | "neu" | "cat" }> = [
  { key: "positive_phrases", label: "Positive language", sub: "What gets praised", tone: "pos" },
  { key: "negative_phrases", label: "Negative language", sub: "What gets complained about", tone: "neg" },
  { key: "alternative_seeking_phrases", label: "Alternative-seeking", sub: "When users start switching", tone: "seek" },
  { key: "emotional_adjectives", label: "Emotional adjectives", sub: "How users feel about it", tone: "neu" },
  { key: "category_language", label: "Category language", sub: "How the category is talked about", tone: "cat" },
];

// ─────────────────────────────────────────────────────────────────────────
// Style helpers

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

export function MarketingPage({
  embedded = false,
  data,
  evidenceSection,
  range: propRange,
  competitorName,
}: {
  embedded?: boolean;
  data?: MarketingViewProps;
  evidenceSection?: EvidenceSection | null;
  range?: string;
  competitorName?: string;
}) {
  const navigate = useNavigate();
  const reportsQuery = useReportsQuery();
  const [drawerRefs, setDrawerRefs] = useState<EvidenceRef | null>(null);
  const [range, setRange] = useState(propRange ?? "90d");
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [activeLangTab, setActiveLangTab] = useState<LangTab>("positive_phrases");

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

  const M = data ?? MARKETING_DATA;
  const cName = competitorName ?? COMPETITOR.name;
  const openEvidence = (refs: EvidenceRef) => setDrawerRefs(refs);
  const closeEvidence = () => setDrawerRefs(null);

  return (
    <div>
      {!embedded && (
        <MarketingHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div style={{ padding: "22px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        <MessagingSnapshot
          score={M.score}
          messaging_summary={M.messaging_summary}
          bestAngle={M.bestAngle}
          openEvidence={openEvidence}
        />

        <SectionHeadMK
          eyebrow="01 · User language bank"
          title="The exact words users use"
          subtitle="Don't invent language. Borrow it. Click any chip to see quotes."
          right={
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {LANG_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`re-chip ${activeLangTab === t.key ? "re-chip-solid" : ""}`}
                  style={{ cursor: "pointer", padding: "4px 10px", fontSize: 11 }}
                  onClick={() => setActiveLangTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
        />
        {LANG_TABS.filter((t) => t.key === activeLangTab).map((t) => (
          <LanguageGroup
            key={t.key}
            title={t.label}
            sub={t.sub}
            tone={t.tone}
            chips={M.language[t.key]}
            openEvidence={openEvidence}
          />
        ))}

        <SectionHeadMK
          eyebrow="02 · Positioning angles"
          title="Copy-ready angles, backed by evidence"
          subtitle="Each angle ties to a real complaint cluster and lists where to deploy it."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {M.angles.map((a, i) => (
            <AngleCard key={i} a={a} index={i} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadMK
          eyebrow="03 · Competitor promise vs user reality"
          title="What they claim. What users say."
          subtitle="The widest gaps are the loudest messaging opportunities."
        />
        <PromiseRealityTable rows={M.promiseReality} openEvidence={openEvidence} />

        <SectionHeadMK
          eyebrow="04 · Objection map"
          title="The objections you'll hear — and how to answer them"
          subtitle="Frequency × suggested response. Every objection is backed by evidence."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {M.objections.map((o, i) => (
            <ObjectionCard key={i} o={o} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadMK
          eyebrow="05 · Comparison page builder"
          title={`"${cName} alternative" — assembled.`}
          subtitle={`Drop these blocks onto your /${cName.toLowerCase().replace(/\s+/g, "-")}-alternative page. Pre-built for SEO and decision velocity.`}
        />
        <ComparisonBuilder c={M.comparison} competitorName={cName} />

        <SectionHeadMK
          eyebrow="06 · Copy ideas"
          title="Copy-ready output"
          subtitle="Headlines, subheads, ads, CTAs — each one linked to the signal it came from."
        />
        <CopyIdeas copy={M.copy} openEvidence={openEvidence} />

        <SectionHeadMK
          eyebrow="07 · Quote library"
          title="The verbatim bank"
          subtitle="Searchable, filterable, copy-ready. Every quote scored on copy-usefulness."
          right={
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                className="re-input"
                type="text"
                placeholder="Search quotes..."
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
                style={{ height: 30, fontSize: 12, width: 200 }}
              />
              <FilterChipMK
                label="Filter"
                value={quoteFilter}
                opts={["all", "pricing", "gap", "switch", "love", "pain", "feature", "positioning"]}
                onChange={setQuoteFilter}
              />
            </div>
          }
        />
        <QuoteLibrary
          quotes={M.quoteLib}
          filter={quoteFilter}
          search={quoteSearch}
          openEvidence={openEvidence}
        />

        <MarketingFooter onNav={(to) => navigate(to)} />
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

interface MarketingHeaderProps {
  competitor: { name: string; domain: string };
  range: string;
  setRange: (r: string) => void;
}

function MarketingHeader({ competitor, range, setRange }: MarketingHeaderProps) {
  return (
    <div style={{ padding: "20px 28px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <div style={eyebrow}>MARKETING VIEW · POSITIONING INTELLIGENCE</div>
            <h1 className="re-h1" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
              Marketing View
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
              Turn competitor user conversations into positioning, copy, and campaign angles.
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
              <Icon name="download" size={14} /> Export brief
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

function SectionHeadMK({
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

function FilterChipMK({
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
// HERO — MESSAGING SNAPSHOT

interface MessagingSnapshotProps {
  score: MarketingViewProps["score"];
  messaging_summary: string;
  bestAngle: MarketingViewProps["bestAngle"];
  openEvidence: (refs: EvidenceRef) => void;
}

function MessagingSnapshot({ score, messaging_summary, bestAngle, openEvidence }: MessagingSnapshotProps) {
  const factorsRecord = factorsToRecord(score.factors);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.95fr) minmax(0,1.4fr)", gap: 14 }}>
      {/* SCORE */}
      <div className="re-card re-card-elev" style={{ position: "relative", overflow: "hidden" }}>
        <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: 18 }}>
          <div style={{ ...eyebrow, fontSize: 10 }}>MESSAGING OPPORTUNITY SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span
              className="font-mono-feat tnum"
              style={{ fontSize: 72, fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 0.9, color: VIO }}
            >
              {score.score}
            </span>
            <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <span className="re-chip" style={{ fontSize: 11, color: VIO, background: VIO_BG, border: `1px solid ${VIO}33` }}>
              {score.label}
            </span>
          </div>

          <hr className="re-rule" style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "18px 0 12px" }} />

          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>SCORE FACTORS</div>
          <ScoreFactors factors={factorsRecord} />
        </div>
      </div>

      {/* SUMMARY + BEST ANGLE */}
      <div className="re-card re-card-elev" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="re-card-hd">
          <h3>
            <Icon name="quote" size={14} /> Messaging summary
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            synthesized · multi-platform
          </span>
        </div>
        <div style={{ padding: 18 }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>{messaging_summary}</p>
        </div>

        {bestAngle && (
          <div
            style={{
              margin: "0 18px 18px",
              padding: 18,
              background: `linear-gradient(135deg, ${VIO_BG}, rgba(255,92,26,0.04))`,
              border: `1px solid ${VIO}33`,
              borderRadius: 10,
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span
                className="font-mono-feat"
                style={{ fontSize: 10, color: VIO, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
              >
                ★ BEST POSITIONING ANGLE
              </span>
              <ConfidenceIndicator confidence={bestAngle.confidence} />
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                color: "var(--fg)",
              }}
            >
              {bestAngle.suggested_message}
            </h2>
            <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5 }}>
              {bestAngle.angle_title}
            </p>

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, rowGap: 6 }}>
              <span style={labelMono()}>PAIN</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                {bestAngle.pain_targeted}
              </span>
              <span style={labelMono()}>CHANNEL</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                {bestAngle.best_channel_or_use_case}
              </span>
              {bestAngle.risk_warning && (
                <>
                  <span style={labelMono({ color: "var(--neg)" })}>RISK</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>
                    {bestAngle.risk_warning}
                  </span>
                </>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="re-btn re-btn-sm"
                style={{ marginLeft: "auto", background: VIO, color: "#fff", borderColor: VIO }}
                onClick={() => openEvidence(bestAngle.evidence_refs)}
              >
                <Icon name="quote" size={12} /> See proof
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — LANGUAGE BANK

function LanguageGroup({
  title,
  sub,
  tone,
  chips,
  openEvidence,
}: {
  title: string;
  sub: string;
  tone: "pos" | "neg" | "seek" | "neu" | "cat";
  chips: PhraseItem[];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const color =
    tone === "pos"
      ? "var(--pos)"
      : tone === "neg"
        ? "var(--neg)"
        : tone === "seek"
          ? VIO
          : tone === "cat"
            ? "var(--fg-muted)"
            : "var(--fg-muted)";
  const bg =
    tone === "pos"
      ? "rgba(22,163,74,.04)"
      : tone === "neg"
        ? "rgba(220,38,38,.04)"
        : tone === "seek"
          ? VIO_BG
          : "rgba(20,16,12,.04)";
  const max = Math.max(...chips.map((c) => c.frequency), 1);

  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="re-card-hd" style={{ background: bg }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="re-dot"
            style={{
              background: color,
              boxShadow:
                tone === "pos"
                  ? "0 0 0 3px rgba(22,163,74,.10)"
                  : tone === "neg"
                    ? "0 0 0 3px rgba(220,38,38,.10)"
                    : `0 0 0 3px ${VIO_BG}`,
            }}
          />
          {title}
        </h3>
        <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          {sub}
        </span>
      </div>
      <div style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start", flex: 1 }}>
        {chips.map((c) => {
          const scale = 11 + (c.frequency / max) * 10;
          return (
            <button
              key={c.phrase}
              type="button"
              onClick={() => openEvidence(c.evidence_refs)}
              style={{
                border: `1px solid ${color}33`,
                background: "var(--surface-solid)",
                color: "var(--fg)",
                padding: "5px 10px",
                borderRadius: 99,
                fontSize: scale,
                fontWeight: scale > 17 ? 600 : 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-sans, 'Geist Sans', sans-serif)",
                lineHeight: 1.2,
                transition: "background 80ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = bg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface-solid)";
              }}
            >
              "{c.phrase}"
              <span
                className="font-mono-feat tnum"
                style={{ fontSize: 10, color, fontWeight: 600, padding: "1px 5px", borderRadius: 99, background: bg }}
              >
                {c.frequency}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-soft)", textAlign: "center" }}>
        <button type="button" className="re-btn re-btn-ghost re-btn-sm">
          <Icon name="download" size={12} /> Copy all {chips.length}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 2 — POSITIONING ANGLES

function AngleCard({
  a,
  index,
  openEvidence,
}: {
  a: MarketingViewProps["angles"][number];
  index: number;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card re-card-elev" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-soft)",
          background: `linear-gradient(90deg, ${VIO_BG}, transparent 70%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="font-mono-feat"
          style={{ fontSize: 10, color: VIO, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
        >
          ANGLE {String(index + 1).padStart(2, "0")}
        </span>
        <ConfidenceIndicator confidence={a.confidence} />
      </div>

      <div style={{ padding: "18px 18px 16px" }}>
        <div style={{ ...eyebrow, fontSize: 9, marginBottom: 4 }}>HEADLINE</div>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          "{a.suggested_message}"
        </h3>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--fg-muted)" }}>{a.angle_title}</p>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "84px 1fr", gap: 8, rowGap: 6 }}>
          <span style={labelMono()}>PAIN TARGET</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)" }}>{a.pain_targeted}</span>

          <span style={labelMono()}>RESPECT</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>
            {a.competitor_strength_to_respect}
          </span>

          {a.risk_warning && (
            <>
              <span style={labelMono({ color: "var(--neg)" })}>RISK</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{a.risk_warning}</span>
            </>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>BEST FOR</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {a.best_channel_or_use_case.split(",").map((u) => (
              <span key={u.trim()} className="re-chip" style={{ fontSize: 10 }}>
                {u.trim()}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => openEvidence(a.evidence_refs)}
          >
            <Icon name="quote" size={12} /> View evidence
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
// SECTION 3 — PROMISE vs REALITY

const PR_COLS = "1.1fr 1.4fr 80px 1.2fr 110px";

function PromiseRealityTable({
  rows,
  openEvidence,
}: {
  rows: MarketingViewProps["promiseReality"];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: PR_COLS,
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
        <span>Competitor claim</span>
        <span>User reality</span>
        <span>Evidence</span>
        <span>Messaging opportunity</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: PR_COLS,
            padding: "16px 18px",
            borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontStyle: "italic",
                lineHeight: 1.45,
                padding: "8px 10px",
                background: "var(--surface-2)",
                borderRadius: 8,
                borderLeft: "2px solid var(--fg-faint)",
              }}
            >
              {r.competitor_claim}
            </div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg)" }}>{r.user_reality}</div>
          <div>
            <div className="font-mono-feat tnum" style={{ fontSize: 14, fontWeight: 600, color: VIO }}>
              {r.evidence_count}
            </div>
            <div style={{ ...monoFaint, fontSize: 9, marginTop: 2 }}>MENTIONS</div>
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              padding: "8px 10px",
              background: VIO_BG,
              borderRadius: 8,
              borderLeft: `2px solid ${VIO}`,
              color: "var(--fg)",
              fontWeight: 500,
            }}
          >
            {r.messaging_opportunity}
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
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 4 — OBJECTION CARDS

function ObjectionCard({
  o,
  openEvidence,
}: {
  o: MarketingViewProps["objections"][number];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="re-chip" style={{ fontSize: 10, background: VIO_BG, color: VIO, border: `1px solid ${VIO}33` }}>
          {o.objection_type}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>FREQ</span>
          <div className="re-meter" style={{ width: 36, height: 3 }}>
            <i style={{ width: `${o.frequency * 100}%`, background: VIO }} />
          </div>
          <span className="font-mono-feat tnum" style={{ fontSize: 10, color: VIO, fontWeight: 600 }}>
            {Math.round(o.frequency * 100)}
          </span>
        </div>
      </div>
      <div style={{ padding: "10px 14px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{o.objection_title}</h3>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 6 }}>
          <span style={labelMono()}>WHY</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{o.why_users_hesitate}</span>

          <span className="font-mono-feat" style={{ ...labelMono({ color: VIO }), fontWeight: 600 }}>
            RESPOND
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>
            {o.suggested_response}
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            CONFIDENCE
          </span>
          <ConfidenceIndicator confidence={o.confidence} />
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => openEvidence(o.evidence_refs)}
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — COMPARISON PAGE BUILDER

type BuilderTone = "strong" | "weak" | "us" | "neutral";

function ComparisonBuilder({ c, competitorName }: { c: MarketingViewProps["comparison"]; competitorName?: string }) {
  return (
    <div className="re-card" style={{ overflow: "hidden" }}>
      <div
        style={{
          padding: "32px 32px 28px",
          background: `linear-gradient(135deg, ${VIO_BG}, rgba(255,92,26,0.04))`,
          borderBottom: "1px solid var(--border-soft)",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 12, right: 16, display: "flex", gap: 6 }}>
          <span className="re-chip" style={{ fontSize: 10, background: "#fff" }}>
            BLOCK · HERO
          </span>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="download" size={12} /> Copy
          </button>
        </div>
        <div style={{ ...eyebrow, fontSize: 10 }}>RIVALEYE.app/linear-alternative</div>
        <h2
          style={{
            margin: "8px 0 0",
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            maxWidth: 720,
          }}
        >
          "{c.hero_angle}"
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border-soft)" }}>
        <BuilderBlock title={`Where ${competitorName ?? "the competitor"} is strong`} tone="strong" items={c.where_competitor_is_strong} />
        <BuilderBlock title="Where users struggle" tone="weak" items={c.where_users_struggle} borderLeft />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border-soft)" }}>
        <BuilderBlock title="Choose us if..." tone="us" items={c.who_should_choose_us} />
        <BuilderBlock title="Why users look for alternatives" tone="neutral" items={c.why_users_look_for_alternatives} borderLeft />
      </div>

      <BuilderBlock title="Objections to address" tone="neutral" items={c.objections_to_handle} />

      <div style={{ padding: "18px 22px", borderTop: "1px solid var(--border-soft)", background: "var(--surface-2)" }}>
        <div style={{ ...eyebrow, fontSize: 10, marginBottom: 10 }}>PROOF — VERBATIM QUOTES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {c.proof_quotes.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                background: "var(--surface-solid)",
                border: "1px solid var(--border-soft)",
                borderRadius: 8,
                borderLeft: `2px solid ${VIO}`,
                fontSize: 14,
                fontStyle: "italic",
                lineHeight: 1.5,
              }}
            >
              "{p}"
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuilderBlock({
  title,
  tone,
  items,
  borderLeft,
}: {
  title: string;
  tone: BuilderTone;
  items: string[];
  borderLeft?: boolean;
}) {
  const color =
    tone === "strong"
      ? "var(--fg-muted)"
      : tone === "weak"
        ? "var(--neg)"
        : tone === "us"
          ? VIO
          : "var(--fg)";
  return (
    <div style={{ padding: "18px 22px", borderLeft: borderLeft ? "1px solid var(--border-soft)" : 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color }}>{title}</h4>
        <span className="re-chip" style={{ fontSize: 9 }}>
          BLOCK
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.5, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ flexShrink: 0, marginTop: 6, width: 5, height: 5, borderRadius: 99, background: color }} />
            <span style={{ color: "var(--fg)" }}>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 6 — COPY IDEAS

function CopyIdeas({
  copy,
  openEvidence,
}: {
  copy: MarketingViewProps["copy"];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const cats: Array<{
    key: keyof MarketingViewProps["copy"];
    label: string;
    big?: boolean;
  }> = [
    { key: "homepage_headlines", label: "Homepage headlines", big: true },
    { key: "subheadlines", label: "Subheads" },
    { key: "ad_hooks", label: "Ad hooks" },
    { key: "linkedin_hooks", label: "LinkedIn hooks" },
    { key: "comparison_page_headlines", label: "Comparison page headlines" },
    { key: "cta_ideas", label: "CTAs" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {cats.map((c) => {
        const items = copy[c.key];
        return (
          <div key={c.key} className="re-card">
            <div className="re-card-hd">
              <h3>{c.label}</h3>
              <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
                {items.length} ideas
              </span>
            </div>
            <div>
              {items.map((it, i) => (
                <CopyRow key={i} item={it} big={c.big} index={i} openEvidence={openEvidence} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CopyRow({
  item,
  big,
  index,
  openEvidence,
}: {
  item: MarketingViewProps["copy"]["homepage_headlines"][number];
  big?: boolean;
  index: number;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div
      style={{
        padding: big ? "18px 18px" : "14px 18px",
        borderTop: index === 0 ? 0 : "1px solid var(--border-soft)",
        display: "grid",
        gridTemplateColumns: "1fr 1.3fr 130px auto 90px",
        gap: 14,
        alignItems: "center",
      }}
    >
      <div>
        <div
          style={{
            fontSize: big ? 18 : 14,
            fontWeight: big ? 600 : 500,
            letterSpacing: big ? "-0.015em" : 0,
            lineHeight: 1.3,
          }}
        >
          "{item.copy}"
        </div>
      </div>
      <div className="text-fg-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 6 }}>
          SIGNAL
        </span>
        {item.signal_behind_it}
      </div>
      <span className="re-chip" style={{ fontSize: 10, justifySelf: "start" }}>
        {item.best_use_case}
      </span>
      <ConfidenceIndicator confidence={item.confidence} />
      <div style={{ display: "flex", gap: 4, justifySelf: "end" }}>
        <button
          type="button"
          className="re-btn re-btn-ghost re-btn-sm re-btn-icon"
          title="Evidence"
          onClick={() => openEvidence(item.evidence_refs)}
        >
          <Icon name="quote" size={12} />
        </button>
        <button type="button" className="re-btn re-btn-ghost re-btn-sm re-btn-icon" title="Copy">
          <Icon name="download" size={12} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 7 — QUOTE LIBRARY

function QuoteLibrary({
  quotes,
  filter,
  search,
  openEvidence,
}: {
  quotes: MarketingViewProps["quoteLib"];
  filter: string;
  search: string;
  openEvidence: (refs: EvidenceRef) => void;
}) {
  const filtered = quotes.filter((q) => {
    if (filter !== "all" && !q.signals.includes(filter as MarketingViewProps["quoteLib"][number]["signals"][number]))
      return false;
    if (search && !q.quote.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.copy_usefulness_score - a.copy_usefulness_score);

  return (
    <div className="re-card">
      <div
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ ...monoFaint, fontSize: 11 }}>
          {filtered.length} of {quotes.length} quotes · sorted by copy-usefulness
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="download" size={12} /> Export all
          </button>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="filter" size={12} /> Advanced
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: 14, gap: 12 }}>
        {sorted.map((q, i) => (
          <QuoteLibraryCard key={i} q={q} openEvidence={openEvidence} />
        ))}
      </div>
    </div>
  );
}

function QuoteLibraryCard({
  q,
  openEvidence,
}: {
  q: MarketingViewProps["quoteLib"][number];
  openEvidence: (refs: EvidenceRef) => void;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: "var(--surface-solid)",
        border: "1px solid var(--border-soft)",
        borderRadius: 8,
        borderLeft: `3px solid ${q.sentiment > 0 ? "var(--pos)" : "var(--neg)"}`,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontStyle: "italic", lineHeight: 1.55 }}>"{q.quote}"</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 500 }}>
          {q.source}
        </span>
        {q.source_date && (
          <>
            <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
            <span style={{ ...monoFaint, fontSize: 11 }}>{q.source_date}</span>
          </>
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10, alignItems: "center" }}>
        {q.signals.map((s) => (
          <span key={s} className="re-chip" style={{ fontSize: 9 }}>
            {s}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <span className="font-mono-feat" style={{ fontSize: 10, color: VIO, fontWeight: 600 }}>
          USEFULNESS {Math.round(q.copy_usefulness_score * 100)}
        </span>
      </div>
      {q.related_positioning_angle && (
        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            background: VIO_BG,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 11.5, color: "var(--fg)" }}>
            <span style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 6 }}>
              ANGLE
            </span>
            {q.related_positioning_angle}
          </span>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm re-btn-icon"
            title="Evidence"
            onClick={() => openEvidence(q.source_url ? { signal_ids: [], quote_ids: [], source_urls: [q.source_url] } : EMPTY_REFS)}
          >
            <Icon name="quote" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER

function MarketingFooter({ onNav }: { onNav: (to: string) => void }) {
  return (
    <div
      style={{
        marginTop: 50,
        padding: "22px 24px",
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
        background: `linear-gradient(135deg, ${VIO_BG}, rgba(255,92,26,0.04))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={eyebrow}>MARKETING CHECKLIST</div>
        <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.5, maxWidth: 720, fontWeight: 500 }}>
          "I know exactly what to say, in what words, on which channel — and every line is anchored to a real user
          quote."
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="re-btn" onClick={() => onNav("/history")}>
          <Icon name="list" size={14} /> Open full report
        </button>
        <button type="button" className="re-btn" style={{ background: VIO, color: "#fff", borderColor: VIO }}>
          <Icon name="download" size={14} /> Export positioning brief
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Severity helper exported for potential reuse
export { severityColor };
