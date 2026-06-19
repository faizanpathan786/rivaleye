/**
 * E2E pipeline test — exercises the full generate-report flow:
 *   platform briefs in DB → Stage C (merge) → Stage D (synth) → Stage E (refine)
 *   → persist to 16 sub-tables → verify logs + checkpoints
 *
 * Uses real Supabase DB. Mocks only OpenRouterClient.complete() so no LLM tokens
 * are consumed. Run with:
 *   bun test --env-file=../../.env src/__tests__/e2e-pipeline.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, spyOn, type Mock } from "bun:test";
import { eq } from "drizzle-orm";
import { OpenRouterClient } from "@rivaleye/shared";
import type { LlmResponse } from "@rivaleye/shared";
import { db } from "../db";
import { users } from "../../../api/src/db/schema/users.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_briefs,
  report_pipeline_checkpoints,
} from "../../../api/src/db/schema/pipeline.js";
import {
  report_complaints,
  report_feature_gaps,
  report_actions,
  report_opportunities,
} from "../../../api/src/db/schema/reports.js";
import { report_logs } from "../../../api/src/db/schema/logs.js";
import { runPipeline } from "../pipeline/run";
import type {
  MergedClusters,
  SynthOutput,
  PlatformBrief,
  PlatformExtract,
} from "../prompts/shared";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BRIEF_FIXTURE: PlatformBrief = {
  platform: "reddit",
  headline: "Users frustrated with slow performance and high pricing",
  top_themes: [
    { theme: "Performance", weight: 0.8 },
    { theme: "Pricing", weight: 0.6 },
  ],
  sentiment: { positive: 0.2, neutral: 0.3, negative: 0.5 },
  most_quoted_competitors: ["CompetitorB"],
  evidence_coverage: 0.75,
};

const EXTRACT_FIXTURE: PlatformExtract = {
  complaints: [
    { text: "The app is incredibly slow", severity: 0.85, evidence_ids: ["ev1"] },
    { text: "Crashes on export", severity: 0.7, evidence_ids: ["ev2"] },
  ],
  features_requested: [
    { feature: "Dark mode", evidence_ids: ["ev3"] },
    { feature: "Offline mode", evidence_ids: ["ev4"] },
  ],
  pricing_signals: [{ note: "Way too expensive for solo devs", evidence_ids: ["ev5"] }],
  switching_signals: [
    { direction: "outbound", competitor: "CompetitorB", evidence_ids: ["ev6"] },
  ],
  voice_phrases: {
    positive: ["love the UX", "intuitive"],
    negative: ["too slow", "crashes", "overpriced"],
  },
  notable_quotes: [
    { author: "u/dev1", text: "This is painfully slow on large datasets", evidence_id: "ev1" },
  ],
};

const MERGED_FIXTURE: MergedClusters = {
  complaint_clusters: [
    {
      title: "Slow performance on large datasets",
      summary: "Users consistently report unacceptable load times",
      severity: 0.85,
      platforms: ["reddit"],
      evidence_ids: ["ev1"],
      sample_quote: "This is painfully slow on large datasets",
    },
    {
      title: "Frequent crashes on export",
      summary: "Export feature crashes for many users",
      severity: 0.7,
      platforms: ["reddit"],
      evidence_ids: ["ev2"],
      sample_quote: null,
    },
  ],
  feature_clusters: [
    { feature: "Dark mode", demand_score: 0.7, platforms: ["reddit"], evidence_ids: ["ev3"] },
    { feature: "Offline mode", demand_score: 0.6, platforms: ["reddit"], evidence_ids: ["ev4"] },
  ],
  pricing_clusters: [
    {
      tier_label: "Pro",
      pain: 0.65,
      note: "Too expensive for indie developers",
      platforms: ["reddit"],
      sample_quotes: [{ who: "u/dev2", text: "Way too expensive for solo devs" }],
    },
  ],
  switching_clusters: [
    {
      direction: "outbound",
      competitor: "CompetitorB",
      count: 12,
      share: 0.35,
      platforms: ["reddit"],
    },
  ],
  voice_top: {
    positive: [
      { word: "intuitive", count: 20 },
      { word: "easy", count: 15 },
    ],
    negative: [
      { word: "slow", count: 40 },
      { word: "crashes", count: 25 },
      { word: "expensive", count: 18 },
    ],
  },
  cross_platform_themes: [
    { theme: "Performance bottlenecks", platforms: ["reddit"], weight: 0.85 },
  ],
};

const SYNTH_FIXTURE: SynthOutput = {
  complaints: [
    {
      external_id: "complaint-perf",
      title: "Slow performance on large datasets",
      tag: "performance",
      mentions: 40,
      delta: "+12%",
      severity: 0.85,
      summary: "Users consistently report unacceptable load times across large datasets",
      threads: 8,
      sample: "This is painfully slow on large datasets",
      sample_author: null,
    },
    {
      external_id: "complaint-crash",
      title: "Frequent crashes on export",
      tag: "stability",
      mentions: 25,
      delta: null,
      severity: 0.7,
      summary: "The export feature crashes for a significant subset of users",
      threads: 5,
      sample: null,
      sample_author: null,
    },
  ],
  feature_gaps: [
    { feature: "Dark mode", votes: 120, signal: 0.7 },
    { feature: "Offline mode", votes: 80, signal: 0.6 },
  ],
  pricing_tiers: [
    { tier: "Pro ($49/mo)", pain: 0.65, note: "Consistently flagged as overpriced for solo devs" },
  ],
  pricing_quotes: [
    { who: "u/dev2", sub: "r/webdev", text: "Way too expensive for what you get as a solo dev" },
  ],
  switching: [{ direction: "outbound", competitor_name: "CompetitorB", count: 12, share: 0.35 }],
  quotes: [
    {
      who: "u/dev1",
      sub: "r/programming",
      when_label: "2 weeks ago",
      score: 340,
      sentiment: -0.7,
      text: "This is painfully slow on large datasets — switching to CompetitorB",
    },
  ],
  voice_words: [
    { kind: "positive", word: "intuitive", count: 20 },
    { kind: "positive", word: "easy", count: 15 },
    { kind: "negative", word: "slow", count: 40 },
    { kind: "negative", word: "crashes", count: 25 },
    { kind: "negative", word: "expensive", count: 18 },
  ],
  positioning: [
    {
      angle: "Speed-first alternative",
      thesis: "Win users switching away due to performance",
      audience: "Data-heavy teams frustrated with slow tools",
      against: "CompetitorA's sluggish large-dataset handling",
    },
  ],
  actions: [
    {
      step: "Benchmark and optimize critical rendering paths",
      detail: "Profile top 5 slowest operations; target 3× speedup",
      effort: "high",
      role: "Engineering",
    },
    {
      step: "Launch indie developer pricing tier at $19/mo",
      detail: "Reduce churn from solo devs who cite cost as exit reason",
      effort: "low",
      role: "Product",
    },
  ],
  leads: [
    {
      who: "u/dev1",
      sub: "r/programming",
      when_label: "2 weeks ago",
      score: 340,
      signal: "Actively evaluating CompetitorB",
      quote: "switching to CompetitorB",
    },
  ],
  opportunities: [
    {
      title: "Performance-led growth campaign",
      thesis: "Target CompetitorA defectors with benchmarks showing 3× speed advantage",
      effort: "med",
      payoff: "high",
      anchor_complaint_external_id: "complaint-perf",
    },
  ],
  threads: [
    {
      complaint_external_id: "complaint-perf",
      platform: "reddit",
      url: "https://reddit.com/r/programming/comments/abc123",
      title: "Why is this tool so slow on large datasets?",
      author: "u/dev1",
      sub: "r/programming",
      posted_at: "2024-03-01T12:00:00Z",
      score: 340,
      messages: [
        {
          author: "u/dev3",
          body: "Agreed — completely unusable on anything over 10k rows",
          posted_at: "2024-03-01T12:30:00Z",
          score: 120,
        },
      ],
    },
  ],
  report_meta: {
    sentiment_overall: -0.35,
    sentiment_positive: 0.2,
    sentiment_neutral: 0.25,
    sentiment_negative: 0.55,
    sentiment_trend: "down",
    voice_summary: "Users are deeply frustrated with performance and pricing while appreciating UX intuitiveness",
    voice_phrases: ["too slow", "crashes", "overpriced", "love the UX"],
    pricing_blended: "Overpriced for the value delivered, especially for solo developers",
    pricing_pain_score: 0.65,
    switching_net_signal: "Negative — users are actively leaving for CompetitorB due to speed",
    switching_reasons_out: ["performance", "pricing"],
  },
  executive_brief: "CompetitorA's performance on large datasets is the dominant pain — teams cite unacceptable load times as the primary exit reason. Solo developers and data-heavy teams are worst hit because the Pro tier is priced for enterprise. The switching market is fragmented with CompetitorB as the most cited destination.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLlmResponse<T>(parsed: T): LlmResponse<T> {
  return {
    parsed,
    raw: JSON.stringify(parsed),
    usage: { promptTokens: 500, completionTokens: 800 },
    model: "test-model",
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

const TEST_EMAIL = "e2e-pipeline-test@rivaleye.test";

describe("E2E: generate-report pipeline", () => {
  let reportId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let completeSpy: Mock<any>;
  let llmCallCount = 0;

  beforeAll(async () => {
    // Provide a stub API key so OpenRouterClient constructor doesn't throw.
    // The actual HTTP call is mocked via spyOn(OpenRouterClient.prototype, "complete")
    // so this value is never sent to OpenRouter.
    process.env.OPENROUTER_API_KEY = "test-stub-key";

    // Clean up any leftover state from a previous interrupted test run
    await db.delete(users).where(eq(users.email, TEST_EMAIL));

    // Insert test user
    const [user] = await db
      .insert(users)
      .values({ email: TEST_EMAIL, name: "E2E Test User" })
      .returning({ id: users.id });
    if (!user) throw new Error("Failed to create test user");

    // Insert test report
    const [report] = await db
      .insert(reports)
      .values({
        owner_id: user.id,
        category: "project management software",
        competitors: ["LinearApp"],
        audience: "engineering teams at B2B SaaS startups",
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
        primary_competitor_name: "LinearApp",
      })
      .returning({ id: reports.id });
    if (!report) throw new Error("Failed to create test report");
    reportId = report.id;

    // Insert one platform brief (simulates completed scraping for reddit)
    await db.insert(report_platform_briefs).values({
      report_id: reportId,
      platform: "reddit",
      extract: EXTRACT_FIXTURE as unknown as Record<string, unknown>,
      summary: BRIEF_FIXTURE as unknown as Record<string, unknown>,
      model_used: "test-model",
      prompt_tokens: 400,
      completion_tokens: 600,
    });

    // Mock LLM — return fixtures in call order: C → D → E
    // Any 4th+ call returns an unexpected-call error so checkpoint-resume test catches regressions.
    llmCallCount = 0;
    completeSpy = spyOn(OpenRouterClient.prototype, "complete");
    completeSpy.mockImplementation(async () => {
      llmCallCount++;
      if (llmCallCount === 1) return makeLlmResponse(MERGED_FIXTURE); // Stage C
      if (llmCallCount === 2) return makeLlmResponse(SYNTH_FIXTURE);  // Stage D
      if (llmCallCount === 3) return makeLlmResponse(SYNTH_FIXTURE);  // Stage E
      throw new Error(
        `OpenRouterClient.complete called unexpectedly (call #${llmCallCount}). ` +
          "Checkpoint-resume should have skipped all LLM stages on retry.",
      );
    });
  }, 30_000);

  afterAll(async () => {
    completeSpy?.mockRestore();
    // Cascade delete removes report, briefs, logs, checkpoints, sub-tables
    await db.delete(users).where(eq(users.email, TEST_EMAIL));
  });

  // ── Test 1: Full pipeline run ─────────────────────────────────────────────

  it("runs the full pipeline and marks the report completed", async () => {
    await runPipeline(reportId);

    const [row] = await db
      .select({ status: reports.status, stage: reports.stage })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    expect(row?.status).toBe("completed");
    expect(row?.stage).toBe("done");
    expect(llmCallCount).toBe(3); // C, D, E each called once
  }, 30_000);

  // ── Test 2: Sub-table population ──────────────────────────────────────────

  it("persists complaints to the DB", async () => {
    const rows = await db
      .select({ title: report_complaints.title, severity: report_complaints.severity })
      .from(report_complaints)
      .where(eq(report_complaints.report_id, reportId));

    expect(rows.length).toBe(SYNTH_FIXTURE.complaints.length);
    expect(rows[0]?.title).toBe("Slow performance on large datasets");
    expect(rows[0]?.severity).toBeCloseTo(0.85, 2);
  });

  it("persists feature gaps to the DB", async () => {
    const rows = await db
      .select()
      .from(report_feature_gaps)
      .where(eq(report_feature_gaps.report_id, reportId));

    expect(rows.length).toBe(SYNTH_FIXTURE.feature_gaps.length);
    expect(rows[0]?.feature).toBe("Dark mode");
  });

  it("persists actions to the DB", async () => {
    const rows = await db
      .select()
      .from(report_actions)
      .where(eq(report_actions.report_id, reportId));

    expect(rows.length).toBe(SYNTH_FIXTURE.actions.length);
  });

  it("persists opportunities to the DB", async () => {
    const rows = await db
      .select()
      .from(report_opportunities)
      .where(eq(report_opportunities.report_id, reportId));

    expect(rows.length).toBe(1);
    expect(rows[0]?.title).toBe("Performance-led growth campaign");
    expect(rows[0]?.anchor_complaint_external_id).toBe("complaint-perf");
  });

  // ── Test 3: Structured logging ────────────────────────────────────────────

  it("writes structured logs for every pipeline stage", async () => {
    const logs = await db
      .select({ stage: report_logs.stage, level: report_logs.level, message: report_logs.message })
      .from(report_logs)
      .where(eq(report_logs.report_id, reportId));

    expect(logs.length).toBeGreaterThan(0);

    const stages = new Set(logs.map((l) => l.stage));
    expect(stages.has("C")).toBe(true);
    expect(stages.has("D")).toBe(true);
    expect(stages.has("E")).toBe(true);
    expect(stages.has("persist")).toBe(true);

    // Verify token-count metadata is logged for LLM stages
    const stageCDone = logs.find((l) => l.stage === "C" && l.message.includes("done"));
    expect(stageCDone).toBeDefined();

    // No error-level logs on a clean run
    const errors = logs.filter((l) => l.level === "error");
    expect(errors.length).toBe(0);
  });

  // ── Test 4: Checkpoint persistence ───────────────────────────────────────

  it("saves checkpoints for stages C, D, and E", async () => {
    const checkpoints = await db
      .select({ stage: report_pipeline_checkpoints.stage })
      .from(report_pipeline_checkpoints)
      .where(eq(report_pipeline_checkpoints.report_id, reportId));

    const savedStages = new Set(checkpoints.map((c) => c.stage));
    expect(savedStages.has("C")).toBe(true);
    expect(savedStages.has("D")).toBe(true);
    expect(savedStages.has("E")).toBe(true);
  });

  // ── Test 5: Checkpoint resume ─────────────────────────────────────────────

  it("skips all LLM stages on retry when checkpoints exist", async () => {
    const callsBeforeRetry = llmCallCount; // Should be 3 from the first run

    // Re-run the pipeline — all 3 stages have checkpoints now
    await runPipeline(reportId);

    // LLM must not have been called again (checkpoints served all 3 stages)
    expect(llmCallCount).toBe(callsBeforeRetry);

    // Skip logs must appear for C, D, E
    const logs = await db
      .select({ message: report_logs.message, stage: report_logs.stage })
      .from(report_logs)
      .where(eq(report_logs.report_id, reportId));

    const skipLogs = logs.filter((l) => l.message.includes("skipping stage"));
    const skippedStages = new Set(skipLogs.map((l) => l.stage));
    expect(skippedStages.has("C")).toBe(true);
    expect(skippedStages.has("D")).toBe(true);
    expect(skippedStages.has("E")).toBe(true);
  }, 30_000);

  // ── Test 6: Stage E fallback ──────────────────────────────────────────────

  it("completes the report even when stage E exhausts all retries (fallback to stage D)", async () => {
    // Create a fresh report for this isolated test
    await db.delete(users).where(eq(users.email, "e2e-stage-e-fallback@rivaleye.test"));
    const [freshUser] = await db
      .insert(users)
      .values({ email: "e2e-stage-e-fallback@rivaleye.test", name: "Fallback Test User" })
      .returning({ id: users.id });
    if (!freshUser) throw new Error("Failed to create fallback test user");

    const [freshReport] = await db
      .insert(reports)
      .values({
        owner_id: freshUser.id,
        category: "project management software",
        competitors: ["LinearApp"],
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
        primary_competitor_name: "LinearApp",
      })
      .returning({ id: reports.id });
    if (!freshReport) throw new Error("Failed to create fallback test report");

    await db.insert(report_platform_briefs).values({
      report_id: freshReport.id,
      platform: "reddit",
      extract: EXTRACT_FIXTURE as unknown as Record<string, unknown>,
      summary: BRIEF_FIXTURE as unknown as Record<string, unknown>,
      model_used: "test-model",
      prompt_tokens: 400,
      completion_tokens: 600,
    });

    // Mock: C and D succeed, E fails all retries
    let fallbackCallCount = 0;
    completeSpy.mockImplementation(async () => {
      fallbackCallCount++;
      if (fallbackCallCount === 1) return makeLlmResponse(MERGED_FIXTURE); // C
      if (fallbackCallCount === 2) return makeLlmResponse(SYNTH_FIXTURE);  // D
      throw new Error("Simulated E stage total failure");                   // E exhausts retries
    });

    // Pipeline should still complete (fallback to draft)
    await runPipeline(freshReport.id);

    const [row] = await db
      .select({ status: reports.status })
      .from(reports)
      .where(eq(reports.id, freshReport.id))
      .limit(1);

    expect(row?.status).toBe("completed");

    // A warn-level log should indicate the fallback
    const logs = await db
      .select({ level: report_logs.level, message: report_logs.message })
      .from(report_logs)
      .where(eq(report_logs.report_id, freshReport.id));

    const warnLogs = logs.filter((l) => l.level === "warn");
    expect(warnLogs.length).toBeGreaterThan(0);

    // Cleanup
    await db.delete(users).where(eq(users.id, freshUser.id));

    // Restore the primary spy for subsequent tests
    llmCallCount = 3; // Reflect that the main spy state is now irrelevant for remaining tests
    completeSpy.mockImplementation(async () => {
      throw new Error("No more LLM calls expected after all tests complete");
    });
  }, 60_000);
});
