import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";

// Growth / Sales View — switch-intent intelligence workspace.
// Answers: "Where are people showing intent, and how should we engage thoughtfully?"
// UI only — mock data hardcoded. TODO(backend): replace GROWTH_DATA when the
// switch-intent feed endpoint ships.

type Tone = "pos" | "neg" | "warn" | "neu";
type Urgency = "hot" | "warm" | "research";
type SpamRisk = "low" | "medium" | "high";

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
interface FeedItem {
  id: string;
  title: string;
  source: string;
  sub: string;
  who: string;
  when: string;
  intent: string;
  pain: string;
  score: number;
  urgency: Urgency;
  engagement: { upvotes: number; comments: number };
  summary: string;
  quote: string;
  angle: string;
  doNot: string;
  spamRisk: SpamRisk;
  url: string;
}

const COMPETITOR = { name: "Linear", domain: "linear.app" };

const GRN = "#16a34a";
const GRN_BG = "rgba(22,163,74,0.08)";

const GROWTH_DATA = {
  score: {
    value: 79,
    label: "Strong intent signal",
    factors: [
      { key: "Alternative-seeking posts", value: 0.88, tone: "neg", note: "142 'Linear alternative' posts in 90d" },
      { key: "Pricing complaints", value: 0.82, tone: "neg", note: "287 mentions, +34% QoQ" },
      {
        key: "Explicit competitor frustration",
        value: 0.74,
        tone: "warn",
        note: "14 'leaving Linear' threads",
      },
      { key: "Recency", value: 0.91, tone: "pos", note: "Hot threads from last 72h" },
      { key: "Engagement level", value: 0.68, tone: "neu", note: "Avg 187 upvotes on top leads" },
      { key: "Source quality", value: 0.86, tone: "pos", note: "Reddit + HN dominate, low bot risk" },
    ] as Array<{ key: string; value: number; tone: Tone; note: string }>,
    summary:
      "Users are actively asking for alternatives to Linear, especially in Reddit threads around 15–80 person team workflows and per-seat pricing. " +
      "The clearest opportunities are pricing-pain threads on r/SaaS and r/ProductManagement — high engagement, recent, and explicitly seeking recommendations.",
    weeklyDelta: "+18 high-intent posts vs last week",
  },

  topOpportunity: {
    title: "Front-page r/SaaS thread: 'I cancelled Linear after 3 years'",
    source: "reddit",
    sub: "r/SaaS",
    when: "11h ago",
    intent: "Explicit alternative-seeking",
    pain: "Pricing scales linearly past 20 seats",
    urgency: "hot" as Urgency,
    engagement: "1.4k upvotes · 312 comments",
    score: 96,
    quote:
      "Three years, ten seat increases, four contractor onboardings, and a $42k quote later — what are people using now?",
    angle:
      "Founder-voice reply. Acknowledge the seat-math pain. Share two genuine alternatives (one being yours, one not). Avoid pricing talk in line 1.",
    spamRisk: "low" as SpamRisk,
    url: "reddit.com/r/SaaS/comments/...",
  },

  feed: [
    {
      id: "f-1",
      title: "Looking for a cheaper alternative to Linear — small agency",
      source: "reddit",
      sub: "r/SaaS",
      who: "u/agency_owner_marc",
      when: "3h ago",
      intent: "alternative-seeking",
      pain: "pricing",
      score: 94,
      urgency: "hot",
      engagement: { upvotes: 187, comments: 42 },
      summary:
        "5-person agency. Pricing hit a wall when they added contractors. Asking for tools with predictable team pricing.",
      quote:
        "We're a 5-person agency that just doubled to 10 with contractors. Linear's per-seat math doesn't work for us. What's everyone using?",
      angle:
        "Respond as founder. Mention contractor-friendly tools (yours and 1 other). Ask what features matter most before pitching anything.",
      doNot: "Don't lead with price. Don't drop a link in the first reply.",
      spamRisk: "low",
      url: "reddit.com/r/SaaS/comments/...",
    },
    {
      id: "f-2",
      title: "Linear vs Plane vs Height — what are you using in 2026?",
      source: "hn",
      sub: "Hacker News",
      who: "moonshot_pm",
      when: "8h ago",
      intent: "tool-recommendation",
      pain: "general",
      score: 88,
      urgency: "hot",
      engagement: { upvotes: 412, comments: 156 },
      summary: "Mid-thread alternative discussion. Top comment cites pricing; second cites mobile experience.",
      quote:
        "Been on Linear since 2023. Pricing has crept up and mobile hasn't kept up. What's the smart move in 2026?",
      angle:
        "Long-form, thoughtful comment. Compare 3-4 tools honestly. Mention yours among them with one line on the wedge.",
      doNot: "Don't be only positive about your tool. HN sniffs astroturfing.",
      spamRisk: "medium",
      url: "news.ycombinator.com/item?id=...",
    },
    {
      id: "f-3",
      title: "Plus tier just for SSO — anyone else fed up?",
      source: "reddit",
      sub: "r/ProductManagement",
      who: "u/pm_throwaway",
      when: "5h ago",
      intent: "competitor-frustration",
      pain: "pricing",
      score: 86,
      urgency: "hot",
      engagement: { upvotes: 287, comments: 78 },
      summary:
        "Frustration thread about Linear's Plus tier gating SSO. Several commenters echo the 'SSO tax' framing.",
      quote: "Plus tier just to get SSO. Felt like a tax. We're 25 people. Recommendations welcome.",
      angle:
        "Acknowledge the SSO-tax framing (it's becoming a meme). Quietly mention tools that include SSO in base tiers.",
      doNot: "Don't claim 'we don't do that' — show your pricing page if asked.",
      spamRisk: "low",
      url: "reddit.com/r/ProductManagement/...",
    },
    {
      id: "f-4",
      title: "Time tracking inside a PM tool — does anyone do this well?",
      source: "reddit",
      sub: "r/ExperiencedDevs",
      who: "u/contractor_v",
      when: "1d ago",
      intent: "missing-feature",
      pain: "feature-gap",
      score: 82,
      urgency: "warm",
      engagement: { upvotes: 174, comments: 56 },
      summary:
        "Bill-by-hour developer asking specifically for native time tracking inside their PM. Linear named directly.",
      quote:
        "I bill by the hour. My time tracking lives in Toggl. My work lives in Linear. They will never speak. Anyone solved this?",
      angle: "Direct fit if your tool has native time tracking. Reply with screenshots of the flow, not a pitch.",
      doNot: "Don't compare to Toggl directly. Don't claim 'integration' if it's actually native.",
      spamRisk: "low",
      url: "reddit.com/r/ExperiencedDevs/...",
    },
    {
      id: "f-5",
      title: "Migrating off Linear — how painful was it for you?",
      source: "reddit",
      sub: "r/startups",
      who: "u/founder_h",
      when: "1d ago",
      intent: "migration-question",
      pain: "switching",
      score: 79,
      urgency: "warm",
      engagement: { upvotes: 138, comments: 47 },
      summary: "Founder considering migration. Asking about scripts, exports, and how much was lost in the move.",
      quote: "We're seriously considering moving off Linear. 4,000 issues. How painful is this realistically?",
      angle: "Honest comment about migration. If your tool has Linear import, mention it once, factually, with what carries over.",
      doNot: "Don't oversell migration. Migration is always harder than people promise.",
      spamRisk: "medium",
      url: "reddit.com/r/startups/...",
    },
    {
      id: "f-6",
      title: "Our CEO wants a Gantt view — what do people use alongside Linear?",
      source: "linkedin",
      sub: "PMM Network",
      who: "Jordan Reyes",
      when: "2d ago",
      intent: "missing-feature",
      pain: "exec-view",
      score: 74,
      urgency: "warm",
      engagement: { upvotes: 98, comments: 22 },
      summary: "PM head of leadership team. Explicit request for executive-friendly views. Several commenters suggest tools.",
      quote: "Our CEO opens Linear, closes it, and asks for a slide. What's working for you all?",
      angle: "LinkedIn comment with one screenshot. Don't link to your site. Wait for DM if they want more.",
      doNot: "Don't comment as the brand account. Comment as the founder or PM, person-to-person.",
      spamRisk: "low",
      url: "linkedin.com/posts/jordan-reyes-...",
    },
    {
      id: "f-7",
      title: "Anyone moved off Linear for mobile reasons?",
      source: "reddit",
      sub: "r/ProductManagement",
      who: "u/pm_mariana",
      when: "2d ago",
      intent: "competitor-frustration",
      pain: "mobile",
      score: 71,
      urgency: "warm",
      engagement: { upvotes: 142, comments: 38 },
      summary: "Manager asking specifically about mobile-first alternatives. Niche but high-fit signal.",
      quote: "Web is a dream. Phone is a billboard. Anyone moved to something with real mobile triage?",
      angle: "If your mobile is truly triage-first, share a 10-second screen recording. Show, don't claim.",
      doNot: "Don't claim parity with Linear's web. Honesty wins on mobile.",
      spamRisk: "low",
      url: "reddit.com/r/ProductManagement/...",
    },
    {
      id: "f-8",
      title: "What's the cheapest Linear-style tool that still has GitHub sync?",
      source: "reddit",
      sub: "r/webdev",
      who: "u/devops_dan",
      when: "3d ago",
      intent: "alternative-seeking",
      pain: "pricing",
      score: 68,
      urgency: "warm",
      engagement: { upvotes: 76, comments: 28 },
      summary: "Direct ask for budget-conscious alternatives. GitHub sync is the named non-negotiable.",
      quote: "Looking for the cheapest Linear-style tool that still has solid GitHub sync. What am I missing?",
      angle: "Tactical comment. Compare 2-3 tools on price + GitHub sync depth. Link to your sync docs, not your homepage.",
      doNot: "Don't fudge on integration depth. Devs check.",
      spamRisk: "medium",
      url: "reddit.com/r/webdev/...",
    },
    {
      id: "f-9",
      title: "Considering churning — what's worked for your team post-Linear?",
      source: "twitter",
      sub: "X / Twitter",
      who: "@founder_charlie",
      when: "3d ago",
      intent: "churn-signal",
      pain: "general",
      score: 64,
      urgency: "research",
      engagement: { upvotes: 54, comments: 12 },
      summary: "Public-but-vague signal. Replies are mostly tool recommendations from peers.",
      quote: "Strongly considering churning off Linear this Q. Curious what's worked for teams post-migration.",
      angle: "Wait for DM signal. If you reply, ask what part is the breaking point first.",
      doNot: "Don't reply with a tool link. This is too soft a signal for that.",
      spamRisk: "low",
      url: "x.com/founder_charlie/status/...",
    },
  ] as FeedItem[],

  priority: [
    { tier: "hot" as Urgency, id: "f-1", title: "Looking for a cheaper alternative to Linear — small agency", action: "Reply within 4h. Founder voice." },
    { tier: "hot" as Urgency, id: "f-2", title: "Linear vs Plane vs Height — what are you using in 2026?", action: "Long-form HN reply. 24h window." },
    { tier: "hot" as Urgency, id: "f-3", title: "Plus tier just for SSO — anyone else fed up?", action: "Acknowledge SSO-tax framing." },
    { tier: "warm" as Urgency, id: "f-4", title: "Time tracking inside a PM tool — does anyone do this well?", action: "Show screenshots if you have it." },
    { tier: "warm" as Urgency, id: "f-5", title: "Migrating off Linear — how painful was it for you?", action: "Honest migration comment." },
    { tier: "warm" as Urgency, id: "f-6", title: "Our CEO wants a Gantt view — what do people use alongside Linear?", action: "LinkedIn comment, not brand." },
    { tier: "warm" as Urgency, id: "f-7", title: "Anyone moved off Linear for mobile reasons?", action: "Share mobile screen recording." },
    { tier: "research" as Urgency, id: "f-9", title: "Considering churning — what's worked for your team post-Linear?", action: "Watch, don't reply yet." },
  ],

  pricingLeads: [
    {
      issue: "Per-seat scaling past 20",
      teamHint: "Small B2B / 5–25 people",
      budget: "Tight (founder-funded)",
      altInterest: "explicit",
      who: "u/founder_42 · r/SaaS",
      score: 92,
      quote: "Once we hit 22 people I started begging finance for a flat tier.",
      angle: "Lead with predictable pricing for growth. Show the 30-seat math comparison without naming a competitor.",
    },
    {
      issue: "Plus tier required for SSO",
      teamHint: "20–60 people, IT-mature",
      budget: "Medium",
      altInterest: "researching",
      who: "u/pm_throwaway · r/ProductManagement",
      score: 86,
      quote: "Plus tier just to get SSO. Felt like a tax.",
      angle: "Show SSO in your base tier. Use 'no SSO tax' framing in your subject line.",
    },
    {
      issue: "Contractor seat math",
      teamHint: "Agency / 5–10 FTEs + contractors",
      budget: "Tight",
      altInterest: "explicit",
      who: "u/agency_owner_marc · r/SaaS",
      score: 84,
      quote: "Inviting a contractor for one ticket cost me a full seat for the month.",
      angle: "Lead with read-only or seat-free contractor roles. Demo the invite flow.",
    },
    {
      issue: "Enterprise quote shock",
      teamHint: "120+ people, post-Series B",
      budget: "Procurement-driven",
      altInterest: "researching",
      who: "u/founder_42 · r/SaaS",
      score: 78,
      quote: "Quoted $42k/yr for 180 seats. Same headcount in Jira would be a third.",
      angle: "Side-by-side total cost comparison at 180 seats. Email subject: 'The $30k question.'",
    },
  ],

  communities: [
    {
      name: "r/SaaS",
      source: "reddit",
      posts: 14,
      pain: "Pricing & alternatives",
      engagement: "high",
      fit: 0.94,
      approach: "Founder-voice comments. Share comparisons, not pitches.",
      spamRisk: "low" as SpamRisk,
    },
    {
      name: "r/ProductManagement",
      source: "reddit",
      posts: 11,
      pain: "Workflows & exec views",
      engagement: "high",
      fit: 0.88,
      approach: "Long-form replies with screenshots. PMs sniff astroturfing.",
      spamRisk: "low" as SpamRisk,
    },
    {
      name: "Hacker News",
      source: "hn",
      posts: 6,
      pain: "Pricing & integrations",
      engagement: "med",
      fit: 0.82,
      approach: "One thoughtful comment per thread, never pitch in title.",
      spamRisk: "medium" as SpamRisk,
    },
    {
      name: "r/ExperiencedDevs",
      source: "reddit",
      posts: 9,
      pain: "Tooling depth",
      engagement: "med",
      fit: 0.76,
      approach: "Technical depth wins here. Show, don't tell.",
      spamRisk: "low" as SpamRisk,
    },
    {
      name: "PMM Network (LinkedIn)",
      source: "linkedin",
      posts: 7,
      pain: "Exec-view & roadmaps",
      engagement: "med",
      fit: 0.74,
      approach: "Person-to-person comments. Never comment as brand.",
      spamRisk: "low" as SpamRisk,
    },
    {
      name: "Product Hunt threads",
      source: "producthunt",
      posts: 4,
      pain: "New-tool discovery",
      engagement: "low",
      fit: 0.68,
      approach: "Participate only on adjacent launches, not your own.",
      spamRisk: "medium" as SpamRisk,
    },
    {
      name: "r/startups",
      source: "reddit",
      posts: 5,
      pain: "Tool choices at <30 ppl",
      engagement: "med",
      fit: 0.71,
      approach: "Share early-stage frame: 'we did this when we were 10.'",
      spamRisk: "low" as SpamRisk,
    },
  ],

  replyAngles: [
    {
      context: "User publicly frustrated with Linear's pricing at scale, asking for alternatives.",
      acknowledge: "Recognize the seat-math pain is common past 15 people, and that contractors compound it.",
      doNot: "Don't pitch in line 1. Don't list 5 tools. Don't link.",
      reply:
        "Yeah, seat math is rough between 15 and 30. We hit the same wall — ended up writing a contractor read-only role. What's your contractor situation? That changes the recommendation a lot.",
      cta: "Happy to share what worked once I know your shape.",
      risk: "low" as SpamRisk,
      confidence: 0.91,
    },
    {
      context: "Engineer asks about cheap Linear alternative with deep GitHub sync.",
      acknowledge: "Note that the GitHub depth is the real bar — pricing is secondary.",
      doNot: "Don't claim sync depth without showing what actually syncs.",
      reply:
        "GitHub sync is the bar. A few that go deeper than just 'PR link': X, Y, Z. We made Z. Happy to point you at the sync docs if useful.",
      cta: "Sync docs link only if asked.",
      risk: "low" as SpamRisk,
      confidence: 0.86,
    },
    {
      context: "Long migration-pain thread. User wants to leave but afraid of the move.",
      acknowledge: "Migration is always harder than promised. Be honest about what's lossy.",
      doNot: "Don't promise '100% lossless.' Don't oversell the importer.",
      reply:
        "We built a Linear importer last year. It handles issues, cycles, statuses, comments. It does NOT handle custom fields cleanly — that's still a real cost. If that matters for your 4,000 issues, I'd budget two days.",
      cta: "Drop the import docs if they ask.",
      risk: "medium" as SpamRisk,
      confidence: 0.82,
    },
  ],

  segmentHints: [
    {
      who: "u/agency_owner_marc · r/SaaS",
      role: "Agency founder",
      size: "5–10 FTE + 3 contractors",
      use: "Project management + client billing",
      industry: "Digital agency",
      urgency: "high",
      budget: "Tight",
      maturity: "Mid",
      confidence: 0.81,
    },
    {
      who: "u/pm_throwaway · r/ProductManagement",
      role: "Product manager",
      size: "20–60 people",
      use: "Roadmap + cross-team coordination",
      industry: "B2B SaaS",
      urgency: "medium",
      budget: "Medium",
      maturity: "High",
      confidence: 0.74,
    },
    {
      who: "u/contractor_v · r/ExperiencedDevs",
      role: "Independent developer",
      size: "Solo + 2 clients",
      use: "Billable issue tracking",
      industry: "Freelance dev",
      urgency: "high",
      budget: "Tight",
      maturity: "High",
      confidence: 0.86,
    },
  ],

  trends: [
    { label: "Alternative-seeking posts", count: 142, delta: "+18", deltaTone: "neg", sparkSeed: 1 },
    { label: "Pricing pain posts", count: 87, delta: "+24", deltaTone: "neg", sparkSeed: 2 },
    { label: "Missing-feature posts", count: 54, delta: "+6", deltaTone: "warn", sparkSeed: 3 },
    { label: "Active communities", count: 7, delta: "+1", deltaTone: "pos", sparkSeed: 4 },
  ] as Array<{ label: string; count: number; delta: string; deltaTone: Tone; sparkSeed: number }>,
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

interface Filter {
  intent: string;
  source: string;
  urgency: string;
}

export function GrowthPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState<Insight | null>(null);
  const [range, setRange] = useState("90d");
  const [filter, setFilter] = useState<Filter>({ intent: "all", source: "all", urgency: "all" });

  const G = GROWTH_DATA;
  const openEvidence = (insight: Insight) => setDrawer(insight);

  const filteredFeed = G.feed.filter((f) => {
    if (filter.intent !== "all" && f.intent !== filter.intent) return false;
    if (filter.source !== "all" && f.source !== filter.source) return false;
    if (filter.urgency !== "all" && f.urgency !== filter.urgency) return false;
    return true;
  });

  return (
    <div>
      {!embedded && (
        <GrowthHeader competitor={COMPETITOR} range={range} setRange={setRange} />
      )}

      <div style={{ padding: "22px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        <IntentSnapshot score={G.score} top={G.topOpportunity} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
          {G.trends.map((t, i) => (
            <TrendCard key={i} t={t} />
          ))}
        </div>

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
          subtitle="The 8 conversations worth opening, ranked. Hot first, research-only at the bottom."
        />
        <PriorityTable rows={G.priority} feed={G.feed} />

        <SectionHeadGR
          eyebrow="03 · Pricing pain leads"
          title="Users complaining about Linear's pricing — by lead quality"
          subtitle="Each card shows the team shape, budget hint, and the suggested pricing angle to lead with."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {G.pricingLeads.map((l, i) => (
            <PricingLeadCard key={i} l={l} openEvidence={openEvidence} />
          ))}
        </div>

        <SectionHeadGR
          eyebrow="04 · Communities to engage"
          title="Where the conversation is happening"
          subtitle="Fit-scored. Each row includes a recommended approach — and a spam-risk flag for the cautious."
        />
        <CommunitiesTable rows={G.communities} />

        <SectionHeadGR
          eyebrow="05 · Suggested reply angles"
          title="How to engage without sounding spammy"
          subtitle="Three templates, anchored to live conversations. Each one tells you what to NOT say first."
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {G.replyAngles.map((r, i) => (
            <ReplyAngleCard key={i} r={r} index={i} />
          ))}
        </div>

        <SectionHeadGR
          eyebrow="06 · Segment & account hints"
          title="Who's behind these posts (inferred)"
          subtitle="Soft inferences from post content. Confidence-scored. Use as background, not as fact."
        />
        <SegmentHints rows={G.segmentHints} />

        <GrowthFooter onNav={(to) => navigate(to)} />
      </div>

      <EvidenceDrawer insight={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HEADER

interface GrowthHeaderProps {
  competitor: { name: string; domain: string };
  range: string;
  setRange: (r: string) => void;
}

function GrowthHeader({ competitor, range, setRange }: GrowthHeaderProps) {
  return (
    <div style={{ padding: "20px 28px 14px", borderBottom: "1px solid var(--border-soft)", background: "var(--surface)" }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <div style={eyebrow}>GROWTH VIEW · SWITCH-INTENT INTELLIGENCE</div>
            <h1 className="re-h1" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
              Growth View
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
              Find switch-intent conversations and the right angle to engage. Built for thoughtful participation, not
              lead-scraping.
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...monoFaint, fontSize: 11, marginRight: 4 }}>RANGE</span>
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
// HERO — INTENT SNAPSHOT

function IntentSnapshot({ score, top }: { score: typeof GROWTH_DATA.score; top: typeof GROWTH_DATA.topOpportunity }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(0, 1.4fr)", gap: 14 }}>
      {/* Score */}
      <div className="re-card re-card-elev" style={{ position: "relative", overflow: "hidden" }}>
        <div className="crosshair-bg" style={{ position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: 18 }}>
          <div style={{ ...eyebrow, fontSize: 10 }}>SWITCH INTENT SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <span
              className="font-mono-feat tnum"
              style={{ fontSize: 72, fontWeight: 500, letterSpacing: "-0.04em", lineHeight: 0.9, color: GRN }}
            >
              {score.value}
            </span>
            <span style={{ ...monoFaint, fontSize: 18, fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="re-chip" style={{ fontSize: 11, color: GRN, background: GRN_BG, border: `1px solid ${GRN}33` }}>
              {score.label}
            </span>
            <span style={{ ...monoFaint, fontSize: 11 }}>{score.weeklyDelta}</span>
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

      {/* Top opportunity */}
      <div className="re-card re-card-elev" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="re-card-hd">
          <h3>
            <Icon name="alert" size={14} /> Highest opportunity right now
          </h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            live · auto-ranked
          </span>
        </div>
        <div style={{ padding: 18 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--fg-muted)" }}>{score.summary}</p>
        </div>

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
              <UrgencyPill level={top.urgency} />
              <span className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 600, color: GRN }}>
                {top.score}
                <span className="text-fg-faint" style={{ fontSize: 10 }}>
                  /100
                </span>
              </span>
              <span style={{ width: 1, height: 14, background: "var(--border-soft)" }} />
              <span className="re-chip" style={{ fontSize: 10 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    background: coverageColor(top.source),
                    marginRight: 4,
                  }}
                />
                {sourceName(top.source)} · {top.sub}
              </span>
              <span style={{ ...monoFaint, fontSize: 10 }}>{top.when}</span>
            </div>
            <span style={{ ...monoFaint, fontSize: 10 }}>{top.engagement}</span>
          </div>

          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
            {top.title}
          </h3>

          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              background: "var(--surface-solid)",
              border: "1px solid var(--border-soft)",
              borderRadius: 8,
              borderLeft: `2px solid ${GRN}`,
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontStyle: "italic", lineHeight: 1.5 }}>"{top.quote}"</p>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, rowGap: 6 }}>
            <span style={labelMono()}>INTENT</span>
            <span style={{ fontSize: 12.5 }}>
              <IntentTag intent={top.intent.toLowerCase().replace(" ", "-")} />
              <span className="text-fg-muted" style={{ marginLeft: 8 }}>
                {top.intent}
              </span>
            </span>

            <span style={labelMono()}>PAIN</span>
            <span style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{top.pain}</span>

            <span className="font-mono-feat" style={{ ...labelMono({ color: GRN }), fontWeight: 600 }}>
              ANGLE
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>{top.angle}</span>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SpamRiskBadge level={top.spamRisk} />
            <span style={{ flex: 1 }} />
            <button type="button" className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="quote" size={12} /> Draft reply
            </button>
            <button type="button" className="re-btn re-btn-sm" style={{ background: GRN, color: "#fff", borderColor: GRN }}>
              <Icon name="external" size={12} /> Open thread
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TREND CARDS

function TrendCard({ t }: { t: (typeof GROWTH_DATA.trends)[number] }) {
  const tone = t.deltaTone === "neg" ? "var(--neg)" : t.deltaTone === "pos" ? "var(--pos)" : "var(--warn)";
  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.label}</span>
        <MiniSpark seed={t.sparkSeed} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span className="font-mono-feat tnum" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>
          {t.count}
        </span>
        <span className="font-mono-feat tnum" style={{ fontSize: 11, color: tone, fontWeight: 600 }}>
          {t.delta}
        </span>
        <span style={{ ...monoFaint, fontSize: 10 }}>this week</span>
      </div>
    </div>
  );
}

function MiniSpark({ seed }: { seed: number }) {
  const rng = (s: number) => {
    const x = s * 9301 + 49297;
    return (x % 233280) / 233280;
  };
  const points = Array.from({ length: 14 }).map((_, i) => 0.3 + rng(seed * 17 + i * 13) * 0.7);
  const max = Math.max(...points);
  const w = 70;
  const h = 22;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 2) - 1;
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1] ?? 0;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <path d={path} fill="none" stroke="var(--fg-muted)" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last)} r="1.6" fill={GRN} />
    </svg>
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
      <span style={{ ...monoFaint, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginRight: 4 }}>
        {count}/{total} shown
      </span>
      <SelectChip
        label="Intent"
        value={filter.intent}
        onChange={(v) => setFilter({ ...filter, intent: v })}
        opts={[
          "all",
          "alternative-seeking",
          "tool-recommendation",
          "competitor-frustration",
          "missing-feature",
          "migration-question",
          "churn-signal",
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
          maxWidth: 140,
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

function FeedCard({ f, openEvidence }: { f: FeedItem; openEvidence: (i: Insight) => void }) {
  const urgencyColor = f.urgency === "hot" ? "var(--neg)" : f.urgency === "warm" ? "var(--warn)" : "var(--fg-muted)";
  return (
    <div className="re-card" style={{ display: "grid", gridTemplateColumns: "70px 1fr 320px", overflow: "hidden" }}>
      {/* Score gutter */}
      <div
        style={{
          background: `linear-gradient(180deg, ${urgencyColor}15, transparent 100%)`,
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
          style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: urgencyColor, lineHeight: 1 }}
        >
          {f.score}
        </span>
        <span style={{ ...monoFaint, fontSize: 9, marginTop: 2 }}>INTENT</span>
        <div style={{ marginTop: 8 }}>
          <UrgencyPill level={f.urgency} />
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="re-chip" style={{ fontSize: 10 }}>
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
            {sourceName(f.source)} · {f.sub}
          </span>
          <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg)", fontWeight: 500 }}>
            {f.who}
          </span>
          <span style={{ ...monoFaint, fontSize: 10 }}>·</span>
          <span style={{ ...monoFaint, fontSize: 10 }}>{f.when}</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
              {f.engagement.upvotes}↑
            </span>
            <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
              {f.engagement.comments}💬
            </span>
          </span>
        </div>

        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.35 }}>{f.title}</h3>
        <p className="text-fg-muted" style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>
          {f.summary}
        </p>

        <div
          style={{
            marginTop: 10,
            padding: "8px 10px",
            background: "var(--surface-2)",
            borderRadius: 8,
            borderLeft: `2px solid ${urgencyColor}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.5 }}>"{f.quote}"</p>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <IntentTag intent={f.intent} />
          <PainTag pain={f.pain} />
          <SpamRiskBadge level={f.spamRisk} />
        </div>
      </div>

      {/* Reply angle panel */}
      <div
        style={{
          background: GRN_BG,
          borderLeft: "1px solid var(--border-soft)",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          className="font-mono-feat"
          style={{ fontSize: 10, color: GRN, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
        >
          SUGGESTED ANGLE
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--fg)", fontWeight: 500 }}>{f.angle}</p>

        <div
          style={{
            padding: "6px 8px",
            borderRadius: 4,
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
          }}
        >
          <span
            className="font-mono-feat"
            style={{ fontSize: 9, color: "var(--neg)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
          >
            DON'T
          </span>
          <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--fg-muted)", marginLeft: 6 }}>{f.doNot}</span>
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-sm"
            style={{ flex: 1, justifyContent: "center", background: "#fff" }}
            onClick={() =>
              openEvidence({
                kind: "feed",
                title: f.title,
                quotes: [{ text: f.quote, who: f.who, sub: f.sub, when: f.when, sentiment: -0.5 }],
              })
            }
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
          <a
            href={`https://${f.url}`}
            target="_blank"
            rel="noreferrer noopener"
            className="re-btn re-btn-sm"
            style={{ background: GRN, color: "#fff", borderColor: GRN, textDecoration: "none" }}
          >
            <Icon name="external" size={12} /> Open
          </a>
        </div>
      </div>
    </div>
  );
}

const URGENCY_STYLES: Record<Urgency, { c: string; bg: string; lbl: string }> = {
  hot: { c: "var(--neg)", bg: "rgba(220,38,38,.10)", lbl: "HOT" },
  warm: { c: "var(--warn)", bg: "rgba(217,119,6,.10)", lbl: "WARM" },
  research: { c: "var(--fg-muted)", bg: "rgba(20,16,12,.06)", lbl: "RESEARCH" },
};

function UrgencyPill({ level }: { level: Urgency }) {
  const map = URGENCY_STYLES[level];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        background: map.bg,
        color: map.c,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 9,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 700,
      }}
    >
      {map.lbl}
    </span>
  );
}

const INTENT_COLORS: Record<string, string> = {
  "alternative-seeking": "#dc2626",
  "tool-recommendation": "#ff5c1a",
  "competitor-frustration": "#d97706",
  "missing-feature": "#6366f1",
  "migration-question": "#8b5cf6",
  "churn-signal": "#0ea5e9",
  pricing: "#ff5c1a",
};

function IntentTag({ intent }: { intent: string }) {
  const c = INTENT_COLORS[intent] ?? "var(--fg-muted)";
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        background: `${c}14`,
        color: c,
        border: `1px solid ${c}33`,
        fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        fontWeight: 600,
      }}
    >
      {intent}
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
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      pain · {pain}
    </span>
  );
}

const SPAM_STYLES: Record<SpamRisk, { c: string; bg: string; lbl: string }> = {
  low: { c: "var(--pos)", bg: "rgba(22,163,74,.08)", lbl: "LOW SPAM RISK" },
  medium: { c: "var(--warn)", bg: "rgba(217,119,6,.08)", lbl: "WATCH TONE" },
  high: { c: "var(--neg)", bg: "rgba(220,38,38,.08)", lbl: "HIGH SPAM RISK" },
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
        fontSize: 9,
        textTransform: "uppercase",
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

function PriorityTable({ rows, feed }: { rows: typeof GROWTH_DATA.priority; feed: FeedItem[] }) {
  const feedById: Record<string, FeedItem> = Object.fromEntries(feed.map((f) => [f.id, f]));
  return (
    <div className="re-card">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: PRIO_COLS,
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
        <span>Priority</span>
        <span>Conversation</span>
        <span>Intent</span>
        <span>Pain</span>
        <span>Source</span>
        <span>Suggested action</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const f = feedById[r.id];
        if (!f) return null;
        return (
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
            <UrgencyPill level={r.tier} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3 }}>{r.title}</div>
              <div style={{ ...monoFaint, fontSize: 10, marginTop: 2 }}>
                {f.who} · {f.engagement.upvotes}↑ · {f.engagement.comments} comments
              </div>
            </div>
            <div>
              <IntentTag intent={f.intent} />
            </div>
            <div>
              <PainTag pain={f.pain} />
            </div>
            <div>
              <span className="re-chip" style={{ fontSize: 10 }}>
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
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4, color: "var(--fg-muted)" }}>{r.action}</div>
            <a
              href={`https://${f.url}`}
              target="_blank"
              rel="noreferrer noopener"
              className="re-btn re-btn-ghost re-btn-sm"
              style={{ justifySelf: "end", textDecoration: "none" }}
            >
              <Icon name="external" size={12} /> Open
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 3 — PRICING PAIN LEADS

function PricingLeadCard({
  l,
  openEvidence,
}: {
  l: (typeof GROWTH_DATA.pricingLeads)[number];
  openEvidence: (i: Insight) => void;
}) {
  return (
    <div className="re-card">
      <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          className="re-chip"
          style={{ fontSize: 10, background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid transparent" }}
        >
          PRICING PAIN
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 600, color: GRN }}>
            {l.score}
            <span className="text-fg-faint" style={{ fontSize: 10 }}>
              /100
            </span>
          </span>
          <span style={{ ...monoFaint, fontSize: 10 }}>· lead score</span>
        </div>
      </div>
      <div style={{ padding: "8px 16px 14px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{l.issue}</h3>

        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "var(--surface-2)",
            borderRadius: 8,
            borderLeft: "2px solid var(--accent)",
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", lineHeight: 1.5 }}>"{l.quote}"</p>
          <div style={{ ...monoFaint, fontSize: 10, marginTop: 6 }}>{l.who}</div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, rowGap: 8 }}>
          <Chiplet label="Team" value={l.teamHint} />
          <Chiplet label="Budget" value={l.budget} />
          <Chiplet label="Alt interest" value={l.altInterest} tone={l.altInterest === "explicit" ? "neg" : "neu"} />
          <Chiplet label="Source" value={l.who.split(" · ")[1] ?? ""} />
        </div>

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
              fontSize: 10,
              color: GRN,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            SUGGESTED ANGLE
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{l.angle}</span>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() =>
              openEvidence({
                kind: "pricing-lead",
                title: l.issue,
                quotes: [
                  {
                    text: l.quote,
                    who: l.who.split(" · ")[0] ?? l.who,
                    sub: l.who.split(" · ")[1] ?? "",
                    when: "1w",
                    sentiment: -0.6,
                  },
                ],
              })
            }
          >
            <Icon name="quote" size={12} /> Evidence
          </button>
          <button type="button" className="re-btn re-btn-sm">
            <Icon name="arrow-right" size={12} /> Add to outreach
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
      <div style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div
        style={{
          fontSize: 12,
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

function CommunitiesTable({ rows }: { rows: typeof GROWTH_DATA.communities }) {
  return (
    <div className="re-card">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COMM_COLS,
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
          }}
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
                fontSize: 10,
                fontWeight: 700,
                color: coverageColor(c.source),
                fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
              }}
            >
              {c.name[0] === "r" ? "r/" : c.name[0]}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
              <div style={{ ...monoFaint, fontSize: 10, marginTop: 2 }}>{sourceName(c.source)}</div>
            </div>
          </div>
          <div className="font-mono-feat tnum" style={{ fontSize: 13, fontWeight: 500 }}>
            {c.posts}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--fg-muted)" }}>{c.pain}</div>
          <div>
            <span className="re-chip" style={{ fontSize: 10 }}>
              {c.engagement}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="re-meter" style={{ flex: 1, height: 3 }}>
              <i style={{ width: `${c.fit * 100}%`, background: GRN }} />
            </div>
            <span className="font-mono-feat tnum" style={{ fontSize: 10, color: GRN }}>
              {Math.round(c.fit * 100)}
            </span>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--fg-muted)" }}>{c.approach}</div>
          <div>
            <SpamRiskBadge level={c.spamRisk} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION 5 — REPLY ANGLES

function ReplyAngleCard({ r, index }: { r: (typeof GROWTH_DATA.replyAngles)[number]; index: number }) {
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
          style={{ fontSize: 10, color: GRN, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}
        >
          TEMPLATE {String(index + 1).padStart(2, "0")}
        </span>
        <SpamRiskBadge level={r.risk} />
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div>
          <div style={{ ...eyebrow, fontSize: 9, marginBottom: 4 }}>CONTEXT</div>
          <p className="text-fg-muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>
            {r.context}
          </p>
        </div>

        <div style={{ padding: 10, background: GRN_BG, borderRadius: 8, borderLeft: `2px solid ${GRN}` }}>
          <div
            className="font-mono-feat"
            style={{
              fontSize: 9,
              color: GRN,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            ACKNOWLEDGE
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.acknowledge}</span>
        </div>

        <div
          style={{ padding: 10, background: "rgba(220,38,38,0.05)", borderRadius: 8, borderLeft: "2px solid var(--neg)" }}
        >
          <div
            className="font-mono-feat"
            style={{
              fontSize: 9,
              color: "var(--neg)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            DON'T
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.doNot}</span>
        </div>

        <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
          <div
            className="font-mono-feat"
            style={{
              fontSize: 9,
              color: "var(--fg)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            HELPFUL REPLY
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, fontStyle: "italic" }}>"{r.reply}"</p>
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
            <span style={{ ...monoFaint, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              SOFT CTA
            </span>
            <span style={{ fontSize: 12, color: "var(--fg-muted)", fontStyle: "italic" }}>{r.cta}</span>
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", gap: 6, alignItems: "center", paddingTop: 4 }}>
          <span style={{ ...monoFaint, fontSize: 10 }}>{Math.round(r.confidence * 100)}% confidence</span>
          <span style={{ flex: 1 }} />
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

function SegmentHints({ rows }: { rows: typeof GROWTH_DATA.segmentHints }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
      {rows.map((r, i) => (
        <div key={i} className="re-card" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 600 }}>
              {r.who.split(" · ")[0]}
            </span>
            <span style={{ ...monoFaint, fontSize: 10 }}>{Math.round(r.confidence * 100)}% inferred</span>
          </div>
          <div style={{ ...monoFaint, fontSize: 10, marginBottom: 12 }}>{r.who.split(" · ")[1]}</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <SegChip>{r.role}</SegChip>
            <SegChip>{r.size}</SegChip>
            <SegChip>{r.use}</SegChip>
            <SegChip>{r.industry}</SegChip>
            <SegChip tone={r.urgency === "high" ? "neg" : r.urgency === "medium" ? "warn" : "neu"}>
              urgency · {r.urgency}
            </SegChip>
            <SegChip tone={r.budget === "Tight" ? "neg" : "neu"}>budget · {r.budget.toLowerCase()}</SegChip>
            <SegChip>tech · {r.maturity.toLowerCase()}</SegChip>
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
            <button type="button" className="re-btn re-btn-ghost re-btn-sm">
              <Icon name="user" size={12} /> View profile
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
      ? "rgba(220,38,38,.08)"
      : tone === "warn"
        ? "rgba(217,119,6,.08)"
        : tone === "pos"
          ? "rgba(22,163,74,.08)"
          : "var(--surface-2)";
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        background: bg,
        color: c,
        border: `1px solid ${tone ? `${c}33` : "var(--border-soft)"}`,
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FOOTER

function GrowthFooter({ onNav }: { onNav: (to: string) => void }) {
  return (
    <div
      style={{
        marginTop: 50,
        padding: "22px 24px",
        borderRadius: 10,
        border: "1px solid var(--border-soft)",
        background: `linear-gradient(135deg, ${GRN_BG}, rgba(255,92,26,0.04))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={eyebrow}>GROWTH OPERATING PRINCIPLE</div>
        <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.5, maxWidth: 720, fontWeight: 500 }}>
          "Find five conversations worth participating in today — and earn a reply by being useful, not loud."
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="re-btn" onClick={() => onNav("/history")}>
          <Icon name="list" size={14} /> Open full report
        </button>
        <button type="button" className="re-btn" style={{ background: GRN, color: "#fff", borderColor: GRN }}>
          <Icon name="download" size={14} /> Export today's shortlist
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
          animation: "growthDrawerIn 280ms cubic-bezier(.2,.7,.2,1)",
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
                    <Icon name="external" size={12} /> Open thread
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
            <Meta label="Related conversation" value={insight.title} />
            <Meta label="First seen" value="2026-05-19" />
            <Meta label="Last seen" value="2026-05-22" />
            <Meta label="Recency" value="hot · last 72h" />
            <Meta label="Bot risk" value="low" />
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 8 }}>
          <button type="button" className="re-btn re-btn-ghost re-btn-sm" onClick={onClose}>
            Close
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className="re-btn re-btn-sm">
            <Icon name="quote" size={12} /> Draft reply
          </button>
          <button type="button" className="re-btn re-btn-sm" style={{ background: GRN, color: "#fff", borderColor: GRN }}>
            <Icon name="arrow-right" size={12} /> Add to outreach
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes growthDrawerIn {
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
