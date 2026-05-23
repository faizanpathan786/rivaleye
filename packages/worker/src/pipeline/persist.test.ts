import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  report_actions,
  report_complaints,
  report_role_sections,
  report_threads,
  reports,
  users,
} from "../../../api/src/db/schema/index.js";
import type { SynthOutput } from "../prompts/shared";
import type { RoleSections } from "../prompts/role-sections/schema";
import { persistReport } from "./persist";

const TEST_USER_EMAIL = "persist-test@rivaleye.test";

const SYNTH_FIXTURE: SynthOutput = {
  complaints: [
    {
      external_id: "c1",
      title: "Crashes on export",
      tag: "stability",
      mentions: 42,
      delta: "+5%",
      severity: 0.8,
      summary: "Users report frequent crashes when exporting large files.",
      threads: 3,
      sample: "The app crashed again when I tried to export.",
    },
  ],
  feature_gaps: [
    { feature: "Dark mode", votes: 120, signal: 0.9 },
  ],
  pricing_tiers: [
    { tier: "Pro", pain: 0.6, note: "Too expensive for small teams." },
  ],
  pricing_quotes: [
    { who: "u/someone", sub: "r/saas", text: "Pricing is ridiculous." },
  ],
  switching: [
    { direction: "outbound", competitor_name: "Linear", count: 15, share: 0.3 },
  ],
  quotes: [
    {
      who: "u/founder1",
      sub: "r/startups",
      when_label: "2 months ago",
      score: 88,
      sentiment: -0.4,
      text: "Switched away after pricing doubled.",
    },
  ],
  voice_words: [
    { kind: "negative", word: "crashes", count: 34 },
    { kind: "positive", word: "fast", count: 20 },
  ],
  positioning: [
    {
      angle: "Stability-first",
      thesis: "Win users who need reliability.",
      audience: "Enterprise teams",
      against: "Notion",
    },
  ],
  actions: [
    {
      step: "Fix export crash",
      detail: "Reproduce with large PDFs and patch the renderer.",
      effort: "high",
      role: "engineer",
    },
  ],
  leads: [
    {
      who: "u/angryfounder",
      sub: "r/saas",
      when_label: "last week",
      score: 92,
      signal: "switching intent",
      quote: "Looking for alternatives.",
    },
  ],
  opportunities: [
    {
      title: "Export reliability",
      thesis: "Nail crash-free exports to take market share.",
      effort: "high",
      payoff: "high",
      anchor_complaint_external_id: "c1",
    },
  ],
  threads: [
    {
      complaint_external_id: "c1",
      platform: "reddit",
      url: "https://reddit.com/r/saas/comments/abc123",
      title: "The app keeps crashing on export",
      author: "u/reddituser",
      sub: "r/saas",
      posted_at: "2026-01-15T12:00:00.000Z",
      score: 55,
      messages: [
        {
          author: "u/replier1",
          body: "Same here, happens every time.",
          posted_at: "2026-01-15T13:00:00.000Z",
          score: 12,
        },
      ],
    },
  ],
  report_meta: {
    sentiment_overall: -0.2,
    sentiment_positive: 0.3,
    sentiment_neutral: 0.4,
    sentiment_negative: 0.3,
    sentiment_trend: "down",
    voice_summary: "Users are frustrated with stability and pricing.",
    voice_phrases: ["crashes constantly", "too expensive"],
    pricing_blended: "Mid-market SaaS pricing with enterprise tier.",
    pricing_pain_score: 0.65,
    switching_net_signal: "Mostly outbound churn to cheaper alternatives.",
    switching_reasons_out: ["pricing", "crashes"],
  },
  executive_brief: "Crashes on export and pricing pain are the dominant complaints — enterprise teams are worst hit. Stability-first positioning can steal users from Notion. The switching market is fragmented with no clear winner yet.",
};

let testUserId: string;
let testReportId: string;

beforeAll(async () => {
  const inserted = await db
    .insert(users)
    .values({
      email: TEST_USER_EMAIL,
      name: "Persist Test User",
      email_verified: false,
    })
    .returning({ id: users.id });

  const row = inserted[0];
  if (!row) throw new Error("Failed to insert test user");
  testUserId = row.id;
}, 15000);

beforeEach(async () => {
  const inserted = await db
    .insert(reports)
    .values({
      owner_id: testUserId,
      category: "project-management",
      competitors: ["Notion"],
      goal: "find_user_pain",
    })
    .returning({ id: reports.id });

  const row = inserted[0];
  if (!row) throw new Error("Failed to insert test report");
  testReportId = row.id;
}, 15000);

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_USER_EMAIL));
}, 15000);

const CONF_MED = { score: 0.5, label: "medium" as const, basis: null };
const CONF_HIGH = { score: 0.8, label: "high" as const, basis: null };
const EVIDENCE_REFS = { signal_ids: [], quote_ids: [], source_urls: [] };

const ROLE_SECTIONS_FIXTURE: RoleSections = {
  overview: {
    overall_perception_summary: "Users are frustrated.",
    sources_scanned: ["reddit"],
    total_mentions: 10,
    top_love_signal: null,
    top_pain_signal: null,
    top_gap_signal: null,
    top_switch_signal: null,
    strongest_opportunity: null,
    confidence_score: CONF_MED,
    source_coverage: [],
    report_limitations: [],
  },
  founder: {
    opportunity_score: {
      score: 60,
      label: "Moderate",
      explanation: "Solid signals.",
      factors: {
        pain_frequency: 0.6,
        gap_severity: 0.5,
        switch_intent: 0.4,
        competitor_love_strength: 0.3,
        pricing_pain: 0.5,
        source_confidence: 0.7,
      },
    },
    market_opening_summary: {
      summary: "There is a clear opening.",
      target_segment: "SMBs",
      main_opportunity: "Stability",
      why_now: "Competitor is struggling.",
      confidence: CONF_MED,
      evidence_refs: EVIDENCE_REFS,
    },
    strengths_to_respect: [],
    weaknesses_to_attack: [],
    unmet_needs: [],
    wedge_recommendation: {
      target_segment: "SMBs",
      core_pain: "Crashes",
      positioning_promise: "Crash-free exports",
      why_this_wedge_exists: "Competitor fails here.",
      evidence_strength: "medium",
      risk_level: "low",
      evidence_refs: EVIDENCE_REFS,
    },
    pricing_opportunity: {
      pricing_pain_score: 0.6,
      main_pricing_complaint: "Too expensive",
      affected_segment: "Small teams",
      suggested_pricing_angle: "Usage-based",
      risk_warning: null,
      evidence_refs: EVIDENCE_REFS,
    },
    strategic_risks: [],
    recommended_product_move: {
      recommendation: "Fix crashes",
      why: "Users are leaving.",
      confidence: CONF_HIGH,
      evidence_refs: EVIDENCE_REFS,
    },
    recommended_positioning_move: {
      recommendation: "Lead with stability",
      why: "Differentiator.",
      confidence: CONF_MED,
      evidence_refs: EVIDENCE_REFS,
    },
    recommended_growth_move: {
      recommendation: "Target Reddit switchers",
      why: "High switch intent.",
      confidence: CONF_MED,
      evidence_refs: EVIDENCE_REFS,
    },
    evidence_refs: EVIDENCE_REFS,
  },
  product: {
    product_opportunity_score: {
      score: 55,
      label: "Moderate",
      explanation: "Several feature gaps.",
      factors: {
        feature_gap_frequency: 0.5,
        pain_severity: 0.6,
        source_spread: 0.4,
        user_urgency: 0.5,
        competitor_love_strength: 0.3,
      },
    },
    feature_gap_map: [],
    complaint_clusters_by_product_area: [],
    loved_competitor_features: [],
    workflow_friction: [],
    roadmap_opportunities: [],
    build_avoid_learn: { build: [], avoid: [], learn: [] },
    confidence_summary: CONF_MED,
    evidence_refs: EVIDENCE_REFS,
  },
  marketing: {
    role: "marketing",
    competitor_id: "notion",
    generated_at: "2026-01-01T00:00:00Z",
    messaging_opportunity_score: {
      score: 50,
      label: "Moderate",
      explanation: "Clear messaging opportunity.",
      factors: {
        repeated_user_language_strength: 0.5,
        pain_clarity: 0.6,
        promise_reality_gap: 0.4,
        objection_frequency: 0.3,
        quote_quality: 0.5,
        source_confidence: 0.6,
      },
    },
    messaging_summary: "Users are vocal about pricing pain.",
    user_language_bank: {
      positive_phrases: [],
      negative_phrases: [],
      alternative_seeking_phrases: [],
      emotional_adjectives: [],
      category_language: [],
    },
    positive_phrases: [],
    negative_phrases: [],
    positioning_angles: [],
    competitor_promise_vs_user_reality: [],
    objections_to_handle: [],
    comparison_page_bullets: {
      hero_angle: "Stability first",
      why_users_look_for_alternatives: [],
      where_competitor_is_strong: [],
      where_users_struggle: [],
      who_should_choose_us: [],
      objections_to_handle: [],
      proof_quotes: [],
    },
    copy_ideas: {
      homepage_headlines: [],
      subheadlines: [],
      ad_hooks: [],
      linkedin_hooks: [],
      comparison_page_headlines: [],
      cta_ideas: [],
    },
    quote_library: [],
    evidence_refs: EVIDENCE_REFS,
  },
  growth: {
    highest_opportunity_summary: "High switch intent detected.",
    switch_intent_score: {
      score: 65,
      label: "High",
      explanation: "Many users looking for alternatives.",
      factors: {
        alternative_seeking_posts: 0.7,
        pricing_complaints: 0.6,
        explicit_competitor_frustration: 0.5,
        recency: 0.8,
        engagement_level: 0.6,
        source_quality: 0.7,
      },
    },
    switch_intent_feed: [],
    highest_priority_conversations: [],
    pricing_pain_leads: [],
    communities_to_engage: [],
    suggested_reply_angles: [],
    segment_hints: [],
    spam_risk_notes: null,
    source_links: [],
    evidence_refs: EVIDENCE_REFS,
  },
  evidence: {
    quotes: [],
    source_links: [],
    raw_items: [],
    filters_supported: ["source", "signal_type", "sentiment", "confidence", "dashboard_section", "date", "role_relevance"],
  },
};

describe("persistReport", () => {
  it("writes all synth sections into sub-tables and updates the parent reports row", async () => {
    const platformStats = [
      { platform: "reddit", label: "Reddit", count: 10 },
    ];
    const subreddits = [
      { subreddit: "r/saas", count: 8 },
    ];

    await persistReport({
      reportId: testReportId,
      synth: SYNTH_FIXTURE,
      platformStats,
      subreddits,
    });

    const complaints = await db
      .select()
      .from(report_complaints)
      .where(eq(report_complaints.report_id, testReportId));

    expect(complaints).toHaveLength(1);
    expect(complaints[0]?.external_id).toBe("c1");
    expect(complaints[0]?.title).toBe("Crashes on export");

    const actions = await db
      .select()
      .from(report_actions)
      .where(eq(report_actions.report_id, testReportId));

    expect(actions).toHaveLength(1);
    expect(actions[0]?.step).toBe("Fix export crash");
    expect(actions[0]?.effort).toBe("high");

    const threads = await db
      .select()
      .from(report_threads)
      .where(eq(report_threads.report_id, testReportId));

    expect(threads).toHaveLength(1);
    expect(threads[0]?.title).toBe("The app keeps crashing on export");
    expect(threads[0]?.platform).toBe("reddit");

    const [updated] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, testReportId));

    expect(updated?.voice_summary).toBe(
      "Users are frustrated with stability and pricing.",
    );
    expect(updated?.sentiment_overall).toBeCloseTo(-0.2);
    expect(updated?.status).toBe("completed");
    expect(updated?.stage).toBe("done");
    expect(updated?.scanned_at).not.toBeNull();
  }, 30000);

  it("upserts one row per section_type into report_role_sections when roleSections is provided", async () => {
    await persistReport({
      reportId: testReportId,
      synth: SYNTH_FIXTURE,
      platformStats: [],
      subreddits: [],
      roleSections: ROLE_SECTIONS_FIXTURE,
    });

    const rows = await db
      .select()
      .from(report_role_sections)
      .where(eq(report_role_sections.report_id, testReportId));

    expect(rows).toHaveLength(6);

    const types = rows.map((r) => r.section_type).sort();
    expect(types).toEqual(["evidence", "founder", "growth", "marketing", "overview", "product"]);

    const overviewRow = rows.find((r) => r.section_type === "overview");
    expect(overviewRow).toBeDefined();
    expect((overviewRow?.data as Record<string, unknown>)["overall_perception_summary"]).toBe(
      "Users are frustrated.",
    );
  }, 30000);

  it("does not write role-section rows when roleSections is omitted and legacy persist still completes", async () => {
    await persistReport({
      reportId: testReportId,
      synth: SYNTH_FIXTURE,
      platformStats: [],
      subreddits: [],
    });

    const rows = await db
      .select()
      .from(report_role_sections)
      .where(eq(report_role_sections.report_id, testReportId));

    expect(rows).toHaveLength(0);

    const [updated] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, testReportId));

    expect(updated?.status).toBe("completed");
  }, 30000);
});
