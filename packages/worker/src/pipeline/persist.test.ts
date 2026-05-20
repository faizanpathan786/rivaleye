import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  report_actions,
  report_complaints,
  report_threads,
  reports,
  users,
} from "../../../api/src/db/schema/index.js";
import type { SynthOutput } from "../prompts/shared";
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
});

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
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, TEST_USER_EMAIL));
});

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
  });
});
