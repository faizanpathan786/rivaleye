import { describe, expect, it } from "bun:test";
import { buildOverviewSynth } from "./overview";
import { overviewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";

const ctx: PipelineCtx = {
  reportId: "report-001",
  competitor: "Notion",
  category: "productivity tools",
  audience: "B2B SaaS founders",
  goal: "Find switching signals",
};

const mergedSignals: MergedSignals = {
  love_clusters: [],
  pain_clusters: [],
  gap_clusters: [],
  switch_clusters: [],
  pricing_clusters: [],
  feature_clusters: [],
  positioning_clusters: [],
  voice_top: { positive: [], negative: [] },
  cross_platform_themes: [],
  evidence_index: [],
  source_coverage: [
    { platform: "reddit", signal_count: 42, contributed: true },
  ],
  clustering_meta: {
    total_input_signals: 42,
    total_output_clusters: 5,
    model: "deepseek/deepseek-chat",
    generated_at: "2026-05-22T10:00:00Z",
  },
};

describe("buildOverviewSynth", () => {
  it("returns the overviewSectionSchema as the schema property", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    expect(built.schema).toBe(overviewSectionSchema);
  });

  it("system prompt mentions key overview widgets", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    const sys = built.system;

    // Must reference the section's job
    expect(sys).toContain("overall_perception_summary");

    // Must reference the four quadrant widgets
    expect(sys).toContain("top_love_signal");
    expect(sys).toContain("top_pain_signal");
    expect(sys).toContain("top_gap_signal");
    expect(sys).toContain("top_switch_signal");

    // Must reference the opportunity widget
    expect(sys).toContain("strongest_opportunity");

    // Must instruct evidence_refs on every insight
    expect(sys).toContain("evidence_refs");

    // Must instruct honest confidence (never fake certainty)
    expect(sys).toContain("confidence");

    // Must instruct JSON-only output
    expect(sys.toLowerCase()).toMatch(/only.*json|json.*only/);
  });

  it("system prompt instructs balanced love and pain reporting", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    const sys = built.system;
    expect(sys).toMatch(/love|strength/i);
    expect(sys).toMatch(/pain|weakness/i);
  });

  it("user message includes the competitor name", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    expect(built.user).toContain("Notion");
  });

  it("user message includes the category", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    expect(built.user).toContain("productivity tools");
  });

  it("user message includes the audience when provided", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    expect(built.user).toContain("B2B SaaS founders");
  });

  it("user message includes the goal", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    expect(built.user).toContain("Find switching signals");
  });

  it("user message includes serialised mergedSignals JSON", () => {
    const built = buildOverviewSynth({ ctx, mergedSignals });
    // JSON.stringify with indent 2 should be present
    expect(built.user).toContain('"clustering_meta"');
    expect(built.user).toContain('"total_input_signals"');
  });

  it("handles null audience gracefully", () => {
    const noAudience: PipelineCtx = { ...ctx, audience: null };
    const built = buildOverviewSynth({ ctx: noAudience, mergedSignals });
    expect(typeof built.system).toBe("string");
    expect(typeof built.user).toBe("string");
    expect(built.schema).toBe(overviewSectionSchema);
  });
});
