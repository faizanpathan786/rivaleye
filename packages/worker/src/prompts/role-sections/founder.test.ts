import { describe, expect, test } from "bun:test";
import { buildFounderSynth } from "./founder";
import { founderViewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";

// ── Minimal fixtures ───────────────────────────────────────────────────────────

const ctx: PipelineCtx = {
  reportId: "rpt_001",
  competitor: "Acme Corp",
  category: "B2B project management",
  audience: "ops leads at 10-50 person SaaS teams",
  goal: "find the wedge to win their churning users",
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("buildFounderSynth", () => {
  test("returns the founderViewSectionSchema as the schema property", () => {
    const built = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(built.schema).toBe(founderViewSectionSchema);
  });

  test("system prompt instructs the LLM to produce ONLY the section JSON", () => {
    const { system } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(system.toLowerCase()).toMatch(/only.*json|json.*only/);
  });

  test("system prompt names key founder widgets", () => {
    const { system } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    // Must mention the core widgets a founder dashboard needs
    expect(system).toMatch(/opportunity_score/i);
    expect(system).toMatch(/market_opening_summary/i);
    expect(system).toMatch(/wedge_recommendation/i);
    expect(system).toMatch(/strengths_to_respect|weaknesses_to_attack/i);
    expect(system).toMatch(/pricing_opportunity/i);
    expect(system).toMatch(/strategic_risks/i);
  });

  test("system prompt requires evidence_refs on every insight", () => {
    const { system } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(system).toMatch(/evidence_refs/i);
  });

  test("system prompt requires honest confidence", () => {
    const { system } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(system).toMatch(/confidence/i);
  });

  test("system prompt instructs balanced love/pain coverage", () => {
    const { system } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    // Must acknowledge competitor strengths (love) as well as weaknesses (pain)
    expect(system).toMatch(/strength|love/i);
    expect(system).toMatch(/weakness|pain/i);
  });

  test("system prompt explains the founder section's job", () => {
    const { system } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    // The founder section answers "where is the market opportunity?"
    expect(system).toMatch(/market opportunity|where.*opportunit|opportunit.*where/i);
  });

  test("user message includes the competitor name", () => {
    const { user } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(user).toContain("Acme Corp");
  });

  test("user message includes category", () => {
    const { user } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(user).toContain("B2B project management");
  });

  test("user message includes audience when provided", () => {
    const { user } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(user).toContain("ops leads at 10-50 person SaaS teams");
  });

  test("user message includes goal", () => {
    const { user } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(user).toContain("find the wedge to win their churning users");
  });

  test("user message includes serialized mergedSignals", () => {
    const { user } = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(user).toContain(JSON.stringify(minMergedSignals, null, 2));
  });

  test("user message handles null audience gracefully", () => {
    const ctxNoAudience: PipelineCtx = { ...ctx, audience: null };
    const { user } = buildFounderSynth({ ctx: ctxNoAudience, mergedSignals: minMergedSignals });
    expect(user).toContain("general");
  });

  test("return shape has system, user, and schema keys", () => {
    const built = buildFounderSynth({ ctx, mergedSignals: minMergedSignals });
    expect(typeof built.system).toBe("string");
    expect(typeof built.user).toBe("string");
    expect(built.schema).toBeDefined();
  });
});
