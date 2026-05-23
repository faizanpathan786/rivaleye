import { describe, it, expect } from "bun:test";
import { runRoleSynthesis } from "./stage-d-role";
import type { OpenRouterClient, LlmCallOptions, LlmRequest } from "@rivaleye/shared";
import {
  roleSectionsSchema,
  evidenceSectionSchema,
  overviewSectionSchema,
  founderViewSectionSchema,
  productViewSectionSchema,
  marketingViewSectionSchema,
  growthViewSectionSchema,
} from "../prompts/role-sections/schema";
import type { PipelineCtx, MergedSignals } from "../prompts/shared";
import type { ZodSchema } from "zod";
import { z } from "zod";

// ── Minimal valid fixtures ────────────────────────────────────────────────────

const CTX: PipelineCtx = {
  reportId: "rep-1",
  competitor: "Acme",
  category: "CRM",
  audience: null,
  goal: "find gaps",
};

const MERGED_SIGNALS: MergedSignals = {
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
    generated_at: new Date().toISOString(),
  },
};

// ── Minimal valid section payloads ─────────────────────────────────────────────

function makeOverview() {
  return overviewSectionSchema.parse({
    overall_perception_summary: "Overall summary.",
    confidence_score: { score: 0.5, label: "medium", basis: "test" },
  });
}

function makeFounder() {
  return founderViewSectionSchema.parse({
    opportunity_score: {
      score: 50,
      label: "medium",
      explanation: "ok",
      factors: {
        pain_frequency: 0.5,
        gap_severity: 0.5,
        switch_intent: 0.5,
        competitor_love_strength: 0.5,
        pricing_pain: 0.5,
        source_confidence: 0.5,
      },
    },
    market_opening_summary: {
      summary: "s",
      target_segment: "t",
      main_opportunity: "m",
      why_now: "w",
      confidence: { score: 0.5, label: "medium", basis: "b" },
      evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
    },
    wedge_recommendation: {
      target_segment: "ts",
      core_pain: "cp",
      positioning_promise: "pp",
      why_this_wedge_exists: "why",
      evidence_strength: "medium",
      risk_level: "low",
      evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
    },
    pricing_opportunity: {
      pricing_pain_score: 0.3,
      main_pricing_complaint: "expensive",
      affected_segment: "SMB",
      suggested_pricing_angle: "freemium",
      evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
    },
    recommended_product_move: {
      recommendation: "Build X",
      why: "because",
      confidence: { score: 0.5, label: "medium", basis: "b" },
      evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
    },
    recommended_positioning_move: {
      recommendation: "Position as Y",
      why: "because",
      confidence: { score: 0.5, label: "medium", basis: "b" },
      evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
    },
    recommended_growth_move: {
      recommendation: "Grow via Z",
      why: "because",
      confidence: { score: 0.5, label: "medium", basis: "b" },
      evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
    },
    evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
  });
}

function makeProduct() {
  return productViewSectionSchema.parse({
    product_opportunity_score: {
      score: 60,
      label: "medium",
      explanation: "ok",
      factors: {
        feature_gap_frequency: 0.5,
        pain_severity: 0.5,
        source_spread: 0.5,
        user_urgency: 0.5,
        competitor_love_strength: 0.5,
      },
    },
    build_avoid_learn: { build: [], avoid: [], learn: [] },
    confidence_summary: { score: 0.5, label: "medium", basis: "b" },
    evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
  });
}

function makeMarketing() {
  return marketingViewSectionSchema.parse({
    role: "marketing",
    competitor_id: "acme",
    generated_at: new Date().toISOString(),
    messaging_opportunity_score: {
      score: 55,
      label: "medium",
      explanation: "ok",
      factors: {
        repeated_user_language_strength: 0.5,
        pain_clarity: 0.5,
        promise_reality_gap: 0.5,
        objection_frequency: 0.5,
        quote_quality: 0.5,
        source_confidence: 0.5,
      },
    },
    messaging_summary: "msg summary",
    user_language_bank: {
      positive_phrases: [],
      negative_phrases: [],
      alternative_seeking_phrases: [],
      emotional_adjectives: [],
      category_language: [],
    },
    comparison_page_bullets: {
      hero_angle: "h",
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
    evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
  });
}

function makeGrowth() {
  return growthViewSectionSchema.parse({
    switch_intent_score: {
      score: 40,
      label: "medium",
      explanation: "ok",
      factors: {
        alternative_seeking_posts: 0.4,
        pricing_complaints: 0.4,
        explicit_competitor_frustration: 0.4,
        recency: 0.4,
        engagement_level: 0.4,
        source_quality: 0.4,
      },
    },
    evidence_refs: { signal_ids: [], quote_ids: [], source_urls: [] },
  });
}

// ── Fake OpenRouterClient ──────────────────────────────────────────────────────

/**
 * Tracks call count for usage aggregation assertions.
 * Returns a minimal valid parsed object for each section schema.
 */
function makeFakeLlm() {
  let callCount = 0;
  const usagePerCall = { promptTokens: 100, completionTokens: 50 };

  const sectionPayloads = [
    makeOverview(),
    makeFounder(),
    makeProduct(),
    makeMarketing(),
    makeGrowth(),
  ];

  const fakeLlm = {
    complete: async <T>(
      req: LlmRequest<ZodSchema<T>>,
      _opts?: LlmCallOptions,
    ): Promise<{ parsed: T; raw: string; usage: typeof usagePerCall; model: string }> => {
      const payload = sectionPayloads[callCount] as T;
      callCount++;
      return {
        parsed: payload,
        raw: JSON.stringify(payload),
        usage: usagePerCall,
        model: "fake-model",
      };
    },
    getCallCount: () => callCount,
  };

  return fakeLlm;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("runRoleSynthesis", () => {
  it("returns roleSections that validates against roleSectionsSchema", async () => {
    const fakeLlm = makeFakeLlm();
    const result = await runRoleSynthesis({
      llm: fakeLlm as unknown as OpenRouterClient,
      ctx: CTX,
      mergedSignals: MERGED_SIGNALS,
    });

    const parsed = roleSectionsSchema.safeParse(result.roleSections);
    expect(parsed.success).toBe(true);
  });

  it("roleSections.evidence is built from code (buildEvidenceSection), not an LLM call", async () => {
    const fakeLlm = makeFakeLlm();
    const result = await runRoleSynthesis({
      llm: fakeLlm as unknown as OpenRouterClient,
      ctx: CTX,
      mergedSignals: MERGED_SIGNALS,
    });

    // evidenceSectionSchema must validate
    const parsed = evidenceSectionSchema.safeParse(result.roleSections.evidence);
    expect(parsed.success).toBe(true);

    // With empty evidence_index, quotes and source_links should be empty arrays
    expect(result.roleSections.evidence.quotes).toEqual([]);
    expect(result.roleSections.evidence.source_links).toEqual([]);

    // Exactly 5 LLM calls — overview, founder, product, marketing, growth
    expect(fakeLlm.getCallCount()).toBe(5);
  });

  it("aggregates usage across the five LLM calls", async () => {
    const fakeLlm = makeFakeLlm();
    const result = await runRoleSynthesis({
      llm: fakeLlm as unknown as OpenRouterClient,
      ctx: CTX,
      mergedSignals: MERGED_SIGNALS,
    });

    // 5 calls × 100 promptTokens + 5 × 50 completionTokens
    expect(result.usage.promptTokens).toBe(500);
    expect(result.usage.completionTokens).toBe(250);
  });

  it("returns model string from the LLM calls", async () => {
    const fakeLlm = makeFakeLlm();
    const result = await runRoleSynthesis({
      llm: fakeLlm as unknown as OpenRouterClient,
      ctx: CTX,
      mergedSignals: MERGED_SIGNALS,
    });

    expect(result.model).toBe("fake-model");
  });

  it("wraps errors in PipelineError", async () => {
    const brokenLlm = {
      complete: async () => {
        throw new Error("network error");
      },
    };

    let caught: unknown;
    try {
      await runRoleSynthesis({
        llm: brokenLlm as unknown as OpenRouterClient,
        ctx: CTX,
        mergedSignals: MERGED_SIGNALS,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const e = caught as Error;
    expect(e.name).toBe("PipelineError");
    expect(e.message).toContain("role synthesis failed");
  });
});
