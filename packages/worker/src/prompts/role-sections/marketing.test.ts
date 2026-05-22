import { describe, expect, it } from "bun:test";
import { marketingViewSectionSchema } from "./schema";
import { buildMarketingSynth } from "./marketing";
import type { PipelineCtx, MergedSignals } from "../shared";

const ctx: PipelineCtx = {
  reportId: "report-123",
  competitor: "Acme CRM",
  category: "CRM software",
  audience: "B2B SaaS sales teams",
  goal: "find positioning angles against Acme CRM",
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

describe("buildMarketingSynth", () => {
  it("returns the marketingViewSectionSchema as schema", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.schema).toBe(marketingViewSectionSchema);
  });

  it("system prompt mentions key marketing widgets", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    const sys = built.system.toLowerCase();

    // Must mention the marketing section's job (what should we say)
    expect(sys).toMatch(/what should we say|marketing/);

    // Must mention key widgets from the schema
    expect(sys).toMatch(/user_language_bank|language bank/);
    expect(sys).toMatch(/positioning_angle|positioning angle/);
    expect(sys).toMatch(/copy_idea|copy idea/);
    expect(sys).toMatch(/quote_library|quote library/);
    expect(sys).toMatch(/comparison_page_bullet|comparison page/);
    expect(sys).toMatch(/objection/);
    expect(sys).toMatch(/promise.*reality|reality.*promise/);
  });

  it("system prompt requires evidence_refs on every insight", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.system).toMatch(/evidence_refs/);
  });

  it("system prompt instructs honest confidence", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    const sys = built.system.toLowerCase();
    expect(sys).toMatch(/confidence/);
  });

  it("system prompt says produce ONLY the section JSON", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    const sys = built.system.toLowerCase();
    expect(sys).toMatch(/only.*json|json.*only/);
  });

  it("system prompt mentions balanced love and pain", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    const sys = built.system.toLowerCase();
    expect(sys).toMatch(/love|strength/);
    expect(sys).toMatch(/pain|weakness/);
  });

  it("user message includes competitor name", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.user).toContain("Acme CRM");
  });

  it("user message includes category", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.user).toContain("CRM software");
  });

  it("user message includes audience", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.user).toContain("B2B SaaS sales teams");
  });

  it("user message includes goal", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.user).toContain("find positioning angles against Acme CRM");
  });

  it("user message includes serialized mergedSignals", () => {
    const built = buildMarketingSynth({ ctx, mergedSignals });
    expect(built.user).toContain(JSON.stringify(mergedSignals, null, 2));
  });
});
