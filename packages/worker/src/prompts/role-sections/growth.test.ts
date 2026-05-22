import { describe, expect, test } from "bun:test";
import { buildGrowthSynth } from "./growth";
import { growthViewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";

// ── Minimal fixtures ──────────────────────────────────────────────────────────

const minCtx: PipelineCtx = {
  reportId: "report-001",
  competitor: "Notion",
  category: "productivity software",
  audience: "B2B SaaS ops teams",
  goal: "find switching opportunities",
};

const minMergedSignals: MergedSignals = {
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
  source_coverage: [],
  clustering_meta: {
    total_input_signals: 0,
    total_output_clusters: 0,
    model: "test-model",
    generated_at: "2026-05-22T00:00:00Z",
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildGrowthSynth", () => {
  test("returns the growthViewSectionSchema as its schema property", () => {
    const built = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(built.schema).toBe(growthViewSectionSchema);
  });

  test("system prompt mentions key growth widgets", () => {
    const { system } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });

    // The growth section's core widgets must be referenced in the SYSTEM prompt
    expect(system).toContain("switch_intent_score");
    expect(system).toContain("switch_intent_feed");
    expect(system).toContain("highest_priority_conversations");
    expect(system).toContain("pricing_pain_leads");
    expect(system).toContain("communities_to_engage");
    expect(system).toContain("suggested_reply_angles");
    expect(system).toContain("segment_hints");
  });

  test("system prompt instructs evidence_refs on every insight", () => {
    const { system } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(system).toContain("evidence_refs");
  });

  test("system prompt instructs honest confidence", () => {
    const { system } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(system).toContain("confidence");
  });

  test("system prompt instructs to produce ONLY section JSON", () => {
    const { system } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    // Must be instructed to return only JSON (no prose, no markdown)
    const lowerSystem = system.toLowerCase();
    expect(
      lowerSystem.includes("only") || lowerSystem.includes("json only") || lowerSystem.includes("no prose"),
    ).toBe(true);
  });

  test("system prompt addresses the growth section's job (intent / engage)", () => {
    const { system } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    // The ICP question is "where is intent, and how do we engage?"
    const lower = system.toLowerCase();
    expect(lower.includes("intent") || lower.includes("engag")).toBe(true);
  });

  test("system prompt addresses love/pain balance", () => {
    const { system } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    // Must mention both love/positive and pain/negative signals
    const lower = system.toLowerCase();
    expect(lower.includes("love") || lower.includes("strength")).toBe(true);
    expect(lower.includes("pain") || lower.includes("frustrat")).toBe(true);
  });

  test("user message includes competitor name", () => {
    const { user } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(user).toContain("Notion");
  });

  test("user message includes category", () => {
    const { user } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(user).toContain("productivity software");
  });

  test("user message includes audience", () => {
    const { user } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(user).toContain("B2B SaaS ops teams");
  });

  test("user message includes goal", () => {
    const { user } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    expect(user).toContain("find switching opportunities");
  });

  test("user message contains JSON.stringified mergedSignals", () => {
    const { user } = buildGrowthSynth({ ctx: minCtx, mergedSignals: minMergedSignals });
    // The user message must include the signals as JSON
    expect(user).toContain(JSON.stringify(minMergedSignals, null, 2));
  });

  test("works when audience is null", () => {
    const ctxNoAudience: PipelineCtx = { ...minCtx, audience: null };
    const { user } = buildGrowthSynth({ ctx: ctxNoAudience, mergedSignals: minMergedSignals });
    // Should not throw; should still include competitor
    expect(user).toContain("Notion");
  });
});
