import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";

// Marketing View — positioning intelligence workspace.
// Answers: "What should we say, what language should we use, how should we position?"
// UI only — mock data hardcoded. TODO(backend): replace MARKETING_DATA when the
// positioning-synthesis endpoint ships.

type Tone = "pos" | "neg" | "warn" | "neu";
type LangTone = "pos" | "neg" | "seek";

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
interface LangChip {
  phrase: string;
  count: number;
  sentiment: number;
  sources: number;
}

const COMPETITOR = { name: "Linear", domain: "linear.app" };

const VIO = "#8b5cf6";
const VIO_BG = "rgba(139,92,246,0.08)";

const MARKETING_DATA = {
  score: {
    value: 86,
    label: "Strong messaging opportunity",
    factors: [
      {
        key: "Repeated user language strength",
        value: 0.92,
        tone: "pos",
        note: "Pricing & complexity language is consistent across sources",
      },
      { key: "Pain clarity", value: 0.88, tone: "neg", note: "Top 3 themes account for 60% of negative volume" },
      { key: "Promise / reality gap", value: 0.78, tone: "warn", note: "4 named promise-reality gaps with evidence" },
      { key: "Objection frequency", value: 0.71, tone: "neu", note: "Pricing & integration objections lead" },
      { key: "Quote quality", value: 0.84, tone: "pos", note: "47 high-copy-usefulness verbatims" },
      { key: "Source confidence", value: 0.91, tone: "pos", note: "7 platforms cross-validated" },
    ] as Array<{ key: string; value: number; tone: Tone; note: string }>,
    summary:
      "Users describe Linear as fast, opinionated, and beautiful — but increasingly say it 'punishes growth,' is 'read-mostly' on mobile, and forces 'a tax' just to get SSO. " +
      "The strongest messaging wedge is predictability — pricing that scales with your team's growth, not against it. " +
      "Secondary wedges: triage-first mobile and an executive view your CEO actually opens.",
    coverage: ["reddit", "g2", "producthunt", "hn", "linkedin", "twitter", "youtube"],
  },

  bestAngle: {
    headline: "All the speed. None of the seat tax.",
    sub: "The project tool that doesn't punish you for growing.",
    pain: "Per-seat math becomes uncomfortable past seat 15. Contractors and PMs pay full price for partial usage.",
    why: "287 mentions of 'expensive,' 218 of 'per-seat,' 76 of 'SSO tax.' All trending up. The language is already in your users' mouths.",
    evidence: 412,
    sources: ["reddit", "g2", "hn", "producthunt", "linkedin"],
    confidence: 0.94,
  },

  language: {
    positive: [
      { phrase: "fast", count: 312, sentiment: 0.7, sources: 5 },
      { phrase: "beautiful", count: 187, sentiment: 0.8, sources: 4 },
      { phrase: "opinionated", count: 142, sentiment: 0.6, sources: 4 },
      { phrase: "keyboard-first", count: 98, sentiment: 0.7, sources: 3 },
      { phrase: "focused", count: 76, sentiment: 0.5, sources: 3 },
      { phrase: "muscle memory", count: 64, sentiment: 0.6, sources: 3 },
      { phrase: "shipping tool", count: 54, sentiment: 0.6, sources: 2 },
      { phrase: "it has taste", count: 47, sentiment: 0.8, sources: 2 },
      { phrase: "actually fun", count: 38, sentiment: 0.7, sources: 2 },
    ] as LangChip[],
    negative: [
      { phrase: "expensive", count: 287, sentiment: -0.7, sources: 6 },
      { phrase: "per-seat", count: 218, sentiment: -0.5, sources: 5 },
      { phrase: "begging finance", count: 62, sentiment: -0.8, sources: 3 },
      { phrase: "read-mostly", count: 98, sentiment: -0.5, sources: 3 },
      { phrase: "punishes growth", count: 74, sentiment: -0.7, sources: 3 },
      { phrase: "SSO tax", count: 76, sentiment: -0.6, sources: 3 },
      { phrase: "rigid", count: 142, sentiment: -0.5, sources: 4 },
      { phrase: "no Gantt", count: 119, sentiment: -0.4, sources: 3 },
      { phrase: "contractor problem", count: 87, sentiment: -0.6, sources: 4 },
      { phrase: "workaround", count: 47, sentiment: -0.5, sources: 3 },
      { phrase: "Plus tier just for SSO", count: 41, sentiment: -0.7, sources: 2 },
    ] as LangChip[],
    seeking: [
      { phrase: "looking for a Linear alternative", count: 142, sentiment: -0.4, sources: 4 },
      { phrase: "anyone tried [...] instead", count: 98, sentiment: -0.3, sources: 4 },
      { phrase: "leaving Linear because", count: 76, sentiment: -0.6, sources: 3 },
      { phrase: "what do you use instead", count: 62, sentiment: -0.3, sources: 3 },
      { phrase: "moving off Linear", count: 41, sentiment: -0.5, sources: 2 },
      { phrase: "alternatives that don't charge", count: 38, sentiment: -0.6, sources: 3 },
      { phrase: "considering switching", count: 29, sentiment: -0.4, sources: 3 },
    ] as LangChip[],
  },

  angles: [
    {
      title: "Power without the price-as-you-grow tax",
      headline: "All the speed. None of the seat tax.",
      sub: "Predictable pricing that flattens as you grow. The math is the message.",
      pain: "Per-seat math past 15 seats",
      respect: "Linear is fast — match the floor",
      evidence: 287,
      sources: ["reddit", "g2", "hn", "linkedin"],
      confidence: 0.94,
      use: ["Homepage hero", "Comparison page", "Search ads"],
      risk: "Don't undercut yourself by leading with 'cheap.' Lead with 'predictable.'",
    },
    {
      title: "Mobile that runs your standup",
      headline: "Triage from your phone. Actually.",
      sub: "Skim, assign, comment. The three things you actually do on mobile.",
      pain: "Linear's mobile is 'read-mostly'",
      respect: "The web app is excellent — don't claim parity",
      evidence: 134,
      sources: ["reddit", "g2", "twitter"],
      confidence: 0.78,
      use: ["LinkedIn posts", "Sales decks", "Mobile-app ads"],
      risk: "Easy to overpromise. Ship the three actions first, then talk.",
    },
    {
      title: "Built for billable hours",
      headline: "PM tool that ships invoices, not workarounds.",
      sub: "Native time tracking. Toggl import. Per-issue billable rates.",
      pain: "No native time tracking forces Toggl + manual reconciliation",
      respect: "Linear is not trying to be an agency tool",
      evidence: 412,
      sources: ["reddit", "g2", "hn", "producthunt"],
      confidence: 0.91,
      use: ["Agency vertical landing page", "PPC for 'time tracking PM tool'"],
      risk: "Don't dilute your brand with too-narrow vertical messaging on the main site.",
    },
    {
      title: "The roadmap your CEO opens",
      headline: "From engineering rhythm to executive picture.",
      sub: "Quarterly dependencies and a single-keystroke present mode.",
      pain: "Cycles work for eng, not for board updates",
      respect: "Cycles are loved by engineers — extend, don't replace",
      evidence: 298,
      sources: ["reddit", "linkedin", "g2"],
      confidence: 0.84,
      use: ["LinkedIn thought leadership", "PMM-targeted ads"],
      risk: "Implies you have a polished exec view — make sure that's true before campaigning.",
    },
    {
      title: "Ship in the tool. Announce in the tool.",
      headline: "Your roadmap. Your changelog. No more Notion drift.",
      sub: "Public-facing portal generated from your own issues.",
      pain: "No customer-facing portal — Notion is the workaround",
      respect: "Linear ships fast — don't underestimate them shipping this too",
      evidence: 241,
      sources: ["reddit", "producthunt"],
      confidence: 0.81,
      use: ["B2B SaaS landing page", "Customer-marketing blog"],
      risk: "Linear may ship this in 6 months. Move soon if you commit.",
    },
    {
      title: "Made for the team you have today",
      headline:
        "Power without the bloat — built for the team you have, not the one you're 'supposed to' want.",
      sub: "Pricing for 15–80 person teams that outgrew spreadsheets but don't want enterprise checkbox UI.",
      pain: "Tools either feel toy-grade or enterprise-bloated. Linear handles eng. Mid-market wants more.",
      respect: "Linear has the best taste in the category — don't pretend otherwise",
      evidence: 156,
      sources: ["reddit", "linkedin", "producthunt"],
      confidence: 0.74,
      use: ["Founder-voice LinkedIn posts", "Reddit organic"],
      risk: "Vague if you don't sharpen which 'team you have today' you mean. Pick one segment.",
    },
  ],

  promiseReality: [
    {
      claim: '"The issue tracking tool for high-performance teams"',
      claimSource: "linear.app · hero",
      reality:
        "Users say Linear is high-performance for engineering — but leadership, agencies, and field teams describe it as 'half a tool' or 'web-only.'",
      evidence: 187,
      opportunity: "High performance for everyone — the founder, the PM, the CSM, the contractor on a phone.",
    },
    {
      claim: '"Linear scales with your team"',
      claimSource: "linear.app · pricing",
      reality:
        "Users explicitly model 'pain inflection at 15–25 seats.' Pricing scales with team size — the criticism is that it scales linearly.",
      evidence: 287,
      opportunity: "Pricing that flattens as you grow. Show the seat-math comparison.",
    },
    {
      claim: '"Built for product teams"',
      claimSource: "linear.app · home",
      reality:
        "Praised by engineers; rejected by leadership for board updates. Agencies maintain parallel tools. 'Built for product teams' really means 'built for product engineering.'",
      evidence: 119,
      opportunity: "Built for the whole product org — engineering, leadership, and customer-facing.",
    },
    {
      claim: '"Cycles, roadmaps, projects — one tool"',
      claimSource: "linear.app · features",
      reality:
        "Cycles loved; roadmaps called 'too rigid for execs;' projects work; but customers want a public-facing roadmap and a Gantt-style executive view.",
      evidence: 241,
      opportunity: "One tool, including the public roadmap your customers see.",
    },
    {
      claim: '"Modern, fast, beautiful"',
      claimSource: "linear.app · brand",
      reality:
        "Universally agreed on web. Mobile is repeatedly called 'read-mostly' and 'a billboard.' Modern on a laptop, less so on a phone.",
      evidence: 134,
      opportunity: "Modern, fast, beautiful — everywhere you work, including your pocket.",
    },
  ],

  objections: [
    {
      type: "Pricing",
      title: '"Is a cheaper tool less powerful?"',
      frequency: 0.92,
      hesitation:
        "Buyers conflate price and power. Linear's premium pricing signals quality. Switching feels like a downgrade.",
      response:
        "Don't lead with cheap. Lead with predictable. Show the 30-seat math comparison alongside a feature parity table.",
      confidence: 0.91,
      quote: "I love Linear. I cannot justify it to finance when we hire 30 contractors a year.",
      who: "u/eng_lead · r/ExperiencedDevs",
    },
    {
      type: "Migration",
      title: '"Moving 4,000 issues is a nightmare."',
      frequency: 0.78,
      hesitation:
        "Migration cost is the biggest emotional friction. Even price-pained users stay because moving feels worse.",
      response:
        "Lead with a one-click Linear import. Demo it on the homepage. Make migration the proof, not the promise.",
      confidence: 0.86,
      quote: "Yes Linear is expensive. Yes I've thought about leaving. No I'm not migrating 4,000 issues.",
      who: "u/founder_h · r/SaaS",
    },
    {
      type: "Trust",
      title: '"Will you still be here in two years?"',
      frequency: 0.62,
      hesitation: "Smaller players have to clear the 'will they survive' bar. Linear is established; you are not.",
      response:
        "Show real customer logos, ARR if mature enough, public roadmap with shipped items. Repetition over assertion.",
      confidence: 0.72,
      quote: "Switched to a hot new PM tool. They got acquired. We had to migrate twice. Never again.",
      who: "u/devops_dan · r/sysadmin",
    },
    {
      type: "Feature completeness",
      title: '"Does it have [Linear feature]?"',
      frequency: 0.71,
      hesitation:
        "Buyers measure new tools against their current toolkit. Missing one beloved feature can be a deal-breaker.",
      response:
        "Publish a public feature parity table. Be honest about what you don't have, with timelines on the ones that are coming.",
      confidence: 0.78,
      quote: "I love everything about this except — wait, you don't have Cycles?",
      who: "u/pm_throwaway · r/ProductManagement",
    },
    {
      type: "Complexity",
      title: '"How long is setup, really?"',
      frequency: 0.66,
      hesitation:
        "Linear's onboarding is a benchmark. Anything that feels slower in first 10 minutes feels worse, even if it's better long-term.",
      response:
        "Match the 10-minute setup benchmark. Show a public demo workspace with one click 'try as a sample team.'",
      confidence: 0.83,
      quote: "If your onboarding is longer than 10 minutes I'm closing the tab.",
      who: "u/startup_charlie · r/startups",
    },
    {
      type: "Integration",
      title: '"Does it talk to GitHub / Slack / Figma?"',
      frequency: 0.84,
      hesitation: "Linear's integrations are deep and praised. Buyers assume new tools won't match.",
      response: "Top-3 integrations on the homepage. Demo them in motion. Don't hide them in a feature list.",
      confidence: 0.89,
      quote: "GitHub sync alone justifies the cost. It's the only PM tool that lives where my code lives.",
      who: "u/devops_dan · r/sysadmin",
    },
  ],

  comparison: {
    hero: {
      title: "All the speed. None of the seat tax.",
      sub: "The Linear alternative for teams that outgrow the per-seat math.",
    },
    why: [
      "Pricing becomes painful past 15 seats — flat tiers exist for a reason.",
      "Contractors and PMs shouldn't cost a full seat for partial work.",
      "Mobile is for triage, not just reading.",
      "Executive views shouldn't require a slide deck.",
    ],
    strong: [
      "Speed and keyboard-first feel",
      "GitHub / Slack / Figma integrations",
      "Cycles model for two-week shipping",
      "Opinionated, focused product",
    ],
    weak: [
      "Per-seat math at scale",
      "Mobile beyond reading",
      "Executive Gantt / dependency views",
      "Native time tracking",
      "Customer-facing changelog",
    ],
    chooseUs: [
      "You're 15–80 people and the seat math has started to bite.",
      "You bill clients by the hour and live in two tools.",
      "Your CEO wants a quarterly view, not a cycle.",
      "Your CSMs need scoped access without the full roadmap.",
    ],
    chooseThem: [
      "You're 5–12 engineers who live in cycles.",
      "Mobile is a footnote for your team.",
      "You don't need executive Gantt views.",
      "Pricing isn't a conversation yet.",
    ],
    proof: [
      "Once we hit 22 people I started begging finance for a flat tier.",
      "Our CEO opens Linear, closes it, and asks for a slide instead.",
      "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear.",
    ],
  },

  copy: {
    headlines: [
      {
        text: "All the speed. None of the seat tax.",
        signal: "287 mentions of 'expensive,' 218 of 'per-seat'",
        use: "Homepage hero",
        conf: 0.94,
      },
      {
        text: "The project tool that doesn't punish you for growing.",
        signal: "74 mentions of 'punishes growth'",
        use: "Homepage hero",
        conf: 0.88,
      },
      { text: "Power without the bloat.", signal: "142 mentions of 'rigid,' 98 of 'overwhelming'", use: "Homepage hero", conf: 0.84 },
      {
        text: "Customer insights without the enterprise bloat.",
        signal: "Cross-category resonance",
        use: "Cross-vertical landing",
        conf: 0.78,
      },
    ],
    subheads: [
      { text: "Predictable pricing that flattens as you grow.", signal: "Per-seat math fatigue", use: "Hero subhead", conf: 0.92 },
      { text: "Triage from your phone. Actually.", signal: "Mobile 'read-mostly' complaints", use: "Feature page", conf: 0.78 },
      {
        text: "Ship in the tool. Announce in the same tool.",
        signal: "Notion-drift workaround",
        use: "Portal feature page",
        conf: 0.81,
      },
      { text: "Built for the team you have today.", signal: "Mid-market positioning", use: "Pricing page", conf: 0.74 },
    ],
    ads: [
      { text: "Begging finance for a flat tier? Same.", signal: "Verbatim quote, 62 mentions", use: "Reddit ads, LinkedIn", conf: 0.86 },
      { text: "Linear's per-seat math, but flatter.", signal: "Direct competitor reference", use: "Search ads", conf: 0.84 },
      { text: "PM tool that ships invoices, not workarounds.", signal: "Agency segment", use: "Vertical LinkedIn", conf: 0.81 },
      { text: "Your CEO will open it. That's the bar.", signal: "Executive view pain", use: "PMM ads", conf: 0.76 },
    ],
    linkedin: [
      {
        text: "The cheapest way to lose your best engineers is the most expensive feature in the suite. Here's how we priced for the other 90%.",
        signal: "Pricing pain",
        use: "Founder LinkedIn",
        conf: 0.84,
      },
      {
        text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak. (Thread.)",
        signal: "Agency wedge",
        use: "PM thought leadership",
        conf: 0.88,
      },
    ],
    ctas: [
      { text: "See the seat-math comparison", signal: "Pricing pain", use: "Hero CTA", conf: 0.92 },
      { text: "Run the migration in 5 minutes", signal: "Migration objection", use: "Hero CTA", conf: 0.86 },
      { text: "Try it on your phone first", signal: "Mobile wedge", use: "Secondary CTA", conf: 0.74 },
    ],
  },

  quoteLib: [
    {
      text: "Once we hit 22 people I started begging finance for a flat tier. Linear's pricing scales linearly with us — that's the problem.",
      who: "u/founder_42",
      sub: "r/SaaS",
      when: "3d",
      sentiment: -0.7,
      score: 412,
      signals: ["pricing", "switch-intent"],
      usefulness: 0.96,
      angle: "Power without the seat tax",
    },
    {
      text: "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak.",
      who: "u/contractor_v",
      sub: "r/ExperiencedDevs",
      when: "1w",
      sentiment: -0.6,
      score: 174,
      signals: ["feature-gap", "agency"],
      usefulness: 0.94,
      angle: "Built for billable hours",
    },
    {
      text: "Our CEO opens Linear, closes it, and asks for a slide instead. We've given up trying to use it for board updates.",
      who: "u/pm_throwaway",
      sub: "r/ProductManagement",
      when: "2w",
      sentiment: -0.55,
      score: 287,
      signals: ["feature-gap", "exec"],
      usefulness: 0.93,
      angle: "The roadmap your CEO opens",
    },
    {
      text: "If I'm not at my desk I just can't run standup. The mobile app is read-mostly.",
      who: "u/pm_mariana",
      sub: "r/ProductManagement",
      when: "5d",
      sentiment: -0.55,
      score: 287,
      signals: ["mobile", "feature-gap"],
      usefulness: 0.91,
      angle: "Mobile that runs your standup",
    },
    {
      text: "Plus tier just to get SSO. Felt like a tax.",
      who: "u/pm_throwaway",
      sub: "r/ProductManagement",
      when: "5d",
      sentiment: -0.65,
      score: 287,
      signals: ["pricing", "objection"],
      usefulness: 0.89,
      angle: "Power without the seat tax",
    },
    {
      text: "Quoted $42k/yr for 180 seats. Same headcount in Jira would be a third.",
      who: "u/founder_42",
      sub: "r/SaaS",
      when: "3d",
      sentiment: -0.7,
      score: 412,
      signals: ["pricing", "comparison"],
      usefulness: 0.88,
      angle: "Power without the seat tax",
    },
    {
      text: "We ship in Linear and announce in Notion. The two are always out of sync, customers notice.",
      who: "u/founder_h",
      sub: "r/SaaS",
      when: "2w",
      sentiment: -0.4,
      score: 138,
      signals: ["feature-gap", "portal"],
      usefulness: 0.87,
      angle: "Ship in the tool. Announce in the tool.",
    },
    {
      text: "I love Linear. I cannot justify it to finance when we hire 30 contractors a year.",
      who: "u/eng_lead",
      sub: "r/ExperiencedDevs",
      when: "2w",
      sentiment: -0.5,
      score: 98,
      signals: ["pricing", "love+pain"],
      usefulness: 0.95,
      angle: "Power without the seat tax",
    },
    {
      text: "It does five things and does them better than anything. Refreshing in 2026.",
      who: "u/founder_h",
      sub: "r/SaaS",
      when: "1w",
      sentiment: 0.7,
      score: 142,
      signals: ["competitor-strength", "praise"],
      usefulness: 0.78,
      angle: "Respect: match the floor",
    },
    {
      text: "GitHub sync alone justifies the cost. It's the only PM tool that lives where my code lives.",
      who: "u/devops_dan",
      sub: "r/sysadmin",
      when: "3w",
      sentiment: 0.5,
      score: 76,
      signals: ["competitor-strength", "integration"],
      usefulness: 0.81,
      angle: "Respect: match the integrations",
    },
  ],
};

type QuoteLibEntry = (typeof MARKETING_DATA.quoteLib)[number];

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

export function MarketingPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<Insight | null>(null);
  const [range, setRange] = useState("90d");
  const [quoteFilter, setQuoteFilter] = useState("all");
  const [quoteSearch, setQuoteSearch] = useState("");

  const M = MARKETING_DATA;
  const openEvidence = (insight: Insight) => setDrawer(insight);

  return (
    <div>
      {!embedded && (
        <MarketingHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div style={{ padding: "22px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        <MessagingSnapshot score={M.score} angle={M.bestAngle} openEvidence={openEvidence} />

        <SectionHeadMK
          eyebrow="01 · User language bank"
          title="The exact words users use"
          subtitle="Don't invent language. Borrow it. Click any chip to see quotes."
        />
        <LanguageBank lang={M.language} openEvidence={openEvidence} />

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
          subtitle="Frequency × suggested response. Every objection comes from a real quote."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {M.objections.map((o, i) => (
            <ObjectionCard key={i} o={o} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadMK
          eyebrow="05 · Comparison page builder"
          title={`"Linear alternative" — assembled.`}
          subtitle="Drop these blocks onto your /linear-alternative page. Pre-built for SEO and decision velocity."
        />
        <ComparisonBuilder c={M.comparison} />

        <SectionHeadMK
          eyebrow="06 · Copy ideas"
          title="Copy-ready output"
          subtitle="Headlines, subheads, ads, CTAs — each one linked to the signal it came from."
        />
        <CopyIdeas copy={M.copy} />

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
                opts={["all", "pricing", "feature-gap", "switch-intent", "mobile", "praise", "objection"]}
                onChange={setQuoteFilter}
              />
            </div>
          }
        />
        <QuoteLibrary quotes={M.quoteLib} filter={quoteFilter} search={quoteSearch} />

        <MarketingFooter onNav={(to) => navigate(to)} />
      </div>

      <EvidenceDrawer insight={drawer} onClose={() => setDrawer(null)} />
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
  score: typeof MARKETING_DATA.score;
  angle: typeof MARKETING_DATA.bestAngle;
  openEvidence: (i: Insight) => void;
}

function MessagingSnapshot({ score, angle, openEvidence }: MessagingSnapshotProps) {
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
              {score.value}
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

      {/* SUMMARY + BEST ANGLE */}
      <div className="re-card re-card-elev" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="re-card-hd">
          <h3>
            <Icon name="quote" size={14} /> Messaging summary
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            synthesized · {score.coverage.length} platforms
          </span>
        </div>
        <div style={{ padding: 18 }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "var(--fg)" }}>{score.summary}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
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
            <span className="re-chip" style={{ fontSize: 10, background: "#fff" }}>
              {Math.round(angle.confidence * 100)}% confidence
            </span>
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--fg)",
            }}
          >
            {angle.headline}
          </h2>
          <p className="text-fg-muted" style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.5 }}>
            {angle.sub}
          </p>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 6 }}>
            <span style={labelMono()}>PAIN</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{angle.pain}</span>
            <span style={labelMono()}>WHY IT WORKS</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{angle.why}</span>
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="font-mono-feat tnum" style={{ fontSize: 11, color: VIO, fontWeight: 600 }}>
              {angle.evidence} mentions
            </span>
            <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
            <div style={{ display: "flex", gap: 4 }}>
              {angle.sources.map((s) => (
                <span key={s} className="re-chip" style={{ fontSize: 9, padding: "1px 6px", background: "#fff" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      background: coverageColor(s),
                      marginRight: 3,
                    }}
                  />
                  {sourceName(s)}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="re-btn re-btn-sm"
              style={{ marginLeft: "auto", background: VIO, color: "#fff", borderColor: VIO }}
              onClick={() =>
                openEvidence({
                  kind: "angle",
                  title: angle.headline,
                  quotes: [
                    {
                      text: "Once we hit 22 people I started begging finance for a flat tier.",
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
                      sentiment: -0.65,
                    },
                  ],
                })
              }
            >
              <Icon name="quote" size={12} /> See proof
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 1 — LANGUAGE BANK

function LanguageBank({ lang, openEvidence }: { lang: typeof MARKETING_DATA.language; openEvidence: (i: Insight) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
      <LanguageGroup title="Positive language" sub="What gets praised" tone="pos" chips={lang.positive} openEvidence={openEvidence} />
      <LanguageGroup
        title="Negative language"
        sub="What gets complained about"
        tone="neg"
        chips={lang.negative}
        openEvidence={openEvidence}
      />
      <LanguageGroup
        title="Alternative-seeking"
        sub="When users start switching"
        tone="seek"
        chips={lang.seeking}
        openEvidence={openEvidence}
      />
    </div>
  );
}

function LanguageGroup({
  title,
  sub,
  tone,
  chips,
  openEvidence,
}: {
  title: string;
  sub: string;
  tone: LangTone;
  chips: LangChip[];
  openEvidence: (i: Insight) => void;
}) {
  const color = tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : VIO;
  const bg = tone === "pos" ? "rgba(22,163,74,.04)" : tone === "neg" ? "rgba(220,38,38,.04)" : VIO_BG;
  const max = Math.max(...chips.map((c) => c.count));
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
          const scale = 11 + (c.count / max) * 10;
          return (
            <button
              key={c.phrase}
              type="button"
              onClick={() =>
                openEvidence({
                  kind: "phrase",
                  title: `"${c.phrase}"`,
                  quotes: [
                    {
                      text: `Verbatim usage of "${c.phrase}" — ${c.count} mentions across ${c.sources} platforms. Open the report for thread context.`,
                      who: "synthesis",
                      sub: "",
                      when: "90d",
                      sentiment: c.sentiment,
                    },
                  ],
                })
              }
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
                {c.count}
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
  a: (typeof MARKETING_DATA.angles)[number];
  index: number;
  openEvidence: (i: Insight) => void;
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
        <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 10 }}>
          {a.evidence} mentions · {Math.round(a.confidence * 100)}% conf
        </span>
      </div>

      <div style={{ padding: "18px 18px 16px" }}>
        <div style={{ ...eyebrow, fontSize: 9, marginBottom: 4 }}>HEADLINE</div>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          "{a.headline}"
        </h3>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--fg-muted)" }}>{a.sub}</p>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "84px 1fr", gap: 8, rowGap: 6 }}>
          <span style={labelMono()}>PAIN TARGET</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)" }}>{a.pain}</span>

          <span style={labelMono()}>RESPECT</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{a.respect}</span>

          <span style={labelMono({ color: "var(--neg)" })}>RISK</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{a.risk}</span>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>BEST FOR</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {a.use.map((u) => (
              <span key={u} className="re-chip" style={{ fontSize: 10 }}>
                {u}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() =>
              openEvidence({
                kind: "angle",
                title: a.headline,
                quotes: [{ text: a.pain, who: "synthesis", sub: "", when: "90d", sentiment: -0.5 }],
              })
            }
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
  rows: typeof MARKETING_DATA.promiseReality;
  openEvidence: (i: Insight) => void;
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
              {r.claim}
            </div>
            <div style={{ ...monoFaint, fontSize: 10, marginTop: 6 }}>{r.claimSource}</div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--fg)" }}>{r.reality}</div>
          <div>
            <div className="font-mono-feat tnum" style={{ fontSize: 14, fontWeight: 600, color: VIO }}>
              {r.evidence}
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
            {r.opportunity}
          </div>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            style={{ justifySelf: "end" }}
            onClick={() =>
              openEvidence({
                kind: "promise-reality",
                title: r.opportunity,
                quotes: [{ text: r.reality, who: "synthesis", sub: r.claimSource, when: "90d", sentiment: -0.5 }],
              })
            }
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
  o: (typeof MARKETING_DATA.objections)[number];
  openEvidence: (i: Insight) => void;
}) {
  return (
    <div className="re-card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="re-chip" style={{ fontSize: 10, background: VIO_BG, color: VIO, border: `1px solid ${VIO}33` }}>
          {o.type}
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
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{o.title}</h3>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, rowGap: 6 }}>
          <span style={labelMono()}>WHY</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-muted)" }}>{o.hesitation}</span>

          <span className="font-mono-feat" style={{ ...labelMono({ color: VIO }), fontWeight: 600 }}>
            RESPOND
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>{o.response}</span>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: "var(--surface-2)",
            borderRadius: 8,
            borderLeft: `2px solid ${VIO}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.45 }}>"{o.quote}"</p>
          <div style={{ ...monoFaint, fontSize: 10, marginTop: 6 }}>{o.who}</div>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() =>
              openEvidence({
                kind: "objection",
                title: o.title,
                quotes: [
                  {
                    text: o.quote,
                    who: o.who.split(" · ")[0] ?? o.who,
                    sub: o.who.split(" · ")[1] ?? "",
                    when: "1w",
                    sentiment: -0.5,
                  },
                ],
              })
            }
          >
            <Icon name="quote" size={12} /> {Math.round(o.confidence * 100)}% conf
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — COMPARISON PAGE BUILDER

type BuilderTone = "strong" | "weak" | "us" | "them" | "neutral";

function ComparisonBuilder({ c }: { c: typeof MARKETING_DATA.comparison }) {
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
          "{c.hero.title}"
        </h2>
        <p className="text-fg-muted" style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.5, maxWidth: 600 }}>
          {c.hero.sub}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border-soft)" }}>
        <BuilderBlock title="Where Linear is strong" tone="strong" items={c.strong} />
        <BuilderBlock title="Where users struggle" tone="weak" items={c.weak} borderLeft />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--border-soft)" }}>
        <BuilderBlock title="Choose us if..." tone="us" items={c.chooseUs} />
        <BuilderBlock title="Choose Linear if..." tone="them" items={c.chooseThem} borderLeft />
      </div>

      <BuilderBlock title="Why users look for alternatives" tone="neutral" items={c.why} />

      <div style={{ padding: "18px 22px", borderTop: "1px solid var(--border-soft)", background: "var(--surface-2)" }}>
        <div style={{ ...eyebrow, fontSize: 10, marginBottom: 10 }}>PROOF — VERBATIM QUOTES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {c.proof.map((p, i) => (
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
          : tone === "them"
            ? "var(--fg-muted)"
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

type CopyItem = { text: string; signal: string; use: string; conf: number };

function CopyIdeas({ copy }: { copy: typeof MARKETING_DATA.copy }) {
  const cats: Array<{ key: string; label: string; items: CopyItem[]; big?: boolean }> = [
    { key: "headlines", label: "Homepage headlines", items: copy.headlines, big: true },
    { key: "subheads", label: "Subheads", items: copy.subheads },
    { key: "ads", label: "Ad hooks", items: copy.ads },
    { key: "linkedin", label: "LinkedIn hooks", items: copy.linkedin },
    { key: "ctas", label: "CTAs", items: copy.ctas },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {cats.map((c) => (
        <div key={c.key} className="re-card">
          <div className="re-card-hd">
            <h3>{c.label}</h3>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
              {c.items.length} ideas
            </span>
          </div>
          <div>
            {c.items.map((it, i) => (
              <CopyRow key={i} item={it} big={c.big} index={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CopyRow({ item, big, index }: { item: CopyItem; big?: boolean; index: number }) {
  return (
    <div
      style={{
        padding: big ? "18px 18px" : "14px 18px",
        borderTop: index === 0 ? 0 : "1px solid var(--border-soft)",
        display: "grid",
        gridTemplateColumns: "1fr 1.3fr 130px 110px 90px",
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
          "{item.text}"
        </div>
      </div>
      <div className="text-fg-muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
        <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 6 }}>
          SIGNAL
        </span>
        {item.signal}
      </div>
      <span className="re-chip" style={{ fontSize: 10, justifySelf: "start" }}>
        {item.use}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div className="re-meter" style={{ flex: 1, height: 3 }}>
          <i style={{ width: `${item.conf * 100}%`, background: VIO }} />
        </div>
        <span className="font-mono-feat tnum" style={{ fontSize: 10, color: VIO }}>
          {Math.round(item.conf * 100)}%
        </span>
      </div>
      <div style={{ display: "flex", gap: 4, justifySelf: "end" }}>
        <button type="button" className="re-btn re-btn-ghost re-btn-sm" title="Copy">
          <Icon name="download" size={12} />
        </button>
        <button type="button" className="re-btn re-btn-ghost re-btn-sm" title="More">
          <Icon name="external" size={12} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 7 — QUOTE LIBRARY

function QuoteLibrary({ quotes, filter, search }: { quotes: QuoteLibEntry[]; filter: string; search: string }) {
  const filtered = quotes.filter((q) => {
    if (filter !== "all" && !q.signals.includes(filter)) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
        {[...filtered]
          .sort((a, b) => b.usefulness - a.usefulness)
          .map((q, i) => (
            <QuoteLibraryCard key={i} q={q} />
          ))}
      </div>
    </div>
  );
}

function QuoteLibraryCard({ q }: { q: QuoteLibEntry }) {
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
      <p style={{ margin: 0, fontSize: 14, fontStyle: "italic", lineHeight: 1.55 }}>"{q.text}"</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 500 }}>
          {q.who}
        </span>
        <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
        <span style={{ ...monoFaint, fontSize: 11 }}>{q.sub}</span>
        <span style={{ ...monoFaint, fontSize: 11 }}>·</span>
        <span style={{ ...monoFaint, fontSize: 11 }}>{q.when}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
            {q.score}↑
          </span>
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10, alignItems: "center" }}>
        {q.signals.map((s) => (
          <span key={s} className="re-chip" style={{ fontSize: 9 }}>
            {s}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <span className="font-mono-feat" style={{ fontSize: 10, color: VIO, fontWeight: 600 }}>
          USEFULNESS {Math.round(q.usefulness * 100)}
        </span>
      </div>
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
          {q.angle}
        </span>
        <button type="button" className="re-btn re-btn-ghost re-btn-sm">
          <Icon name="download" size={12} />
        </button>
      </div>
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
          animation: "marketingDrawerIn 280ms cubic-bezier(.2,.7,.2,1)",
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
                  <span style={{ marginLeft: "auto" }}>
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
            <Meta label="Velocity" value="+34% QoQ" />
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
          <button type="button" className="re-btn re-btn-sm" style={{ background: VIO, color: "#fff", borderColor: VIO }}>
            <Icon name="check" size={12} /> Pin to brief
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes marketingDrawerIn {
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
