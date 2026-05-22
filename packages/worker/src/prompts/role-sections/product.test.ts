import { describe, expect, test } from "bun:test";
import { buildProductSynth } from "./product";
import { productViewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";

const ctx: PipelineCtx = {
  reportId: "test-report-1",
  competitor: "Notion",
  category: "project management",
  audience: "ops teams",
  goal: "find product gaps to exploit",
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
  source_coverage: [],
  clustering_meta: {
    total_input_signals: 0,
    total_output_clusters: 0,
    model: "test-model",
    generated_at: "2026-05-22T00:00:00Z",
  },
};

describe("buildProductSynth", () => {
  test("returns the productViewSectionSchema as schema", () => {
    const built = buildProductSynth({ ctx, mergedSignals });
    expect(built.schema).toBe(productViewSectionSchema);
  });

  test("system prompt mentions key product widgets", () => {
    const { system } = buildProductSynth({ ctx, mergedSignals });
    // Must instruct on producing ONLY section JSON
    expect(system).toContain("ONLY");
    // Must mention evidence_refs
    expect(system).toContain("evidence_refs");
    // Must mention confidence
    expect(system).toContain("confidence");
    // Must reference key product section widgets
    expect(system).toMatch(/feature.gap|feature_gap/i);
    expect(system).toMatch(/complaint.cluster|complaint_cluster/i);
    expect(system).toMatch(/roadmap/i);
    expect(system).toMatch(/build.*avoid.*learn|build_avoid_learn/i);
    // Must instruct on balanced love/pain
    expect(system).toMatch(/love|loved/i);
    expect(system).toMatch(/pain/i);
  });

  test("user message includes competitor name", () => {
    const { user } = buildProductSynth({ ctx, mergedSignals });
    expect(user).toContain("Notion");
  });

  test("user message includes category", () => {
    const { user } = buildProductSynth({ ctx, mergedSignals });
    expect(user).toContain("project management");
  });

  test("user message includes audience", () => {
    const { user } = buildProductSynth({ ctx, mergedSignals });
    expect(user).toContain("ops teams");
  });

  test("user message includes goal", () => {
    const { user } = buildProductSynth({ ctx, mergedSignals });
    expect(user).toContain("find product gaps to exploit");
  });

  test("user message includes serialised mergedSignals", () => {
    const { user } = buildProductSynth({ ctx, mergedSignals });
    expect(user).toContain("test-model");
  });

  test("returns system and user as strings", () => {
    const built = buildProductSynth({ ctx, mergedSignals });
    expect(typeof built.system).toBe("string");
    expect(typeof built.user).toBe("string");
    expect(built.system.length).toBeGreaterThan(0);
    expect(built.user.length).toBeGreaterThan(0);
  });

  test("system prompt instructs on the product section job (what to build or prioritize)", () => {
    const { system } = buildProductSynth({ ctx, mergedSignals });
    expect(system).toMatch(/build|prioritize|prioritise/i);
  });

  test("system prompt instructs on honest confidence (never fake certainty)", () => {
    const { system } = buildProductSynth({ ctx, mergedSignals });
    expect(system).toMatch(/honest|never fake|thin|weak/i);
  });
});
