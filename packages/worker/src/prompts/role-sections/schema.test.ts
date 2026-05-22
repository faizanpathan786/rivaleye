import { describe, expect, test } from "bun:test";
import {
  overviewSectionSchema,
  founderViewSectionSchema,
  productViewSectionSchema,
  marketingViewSectionSchema,
  growthViewSectionSchema,
  evidenceSectionSchema,
  roleSectionsSchema,
} from "./schema";

// ── Shared minimal builders ────────────────────────────────────────────────────

const minEvidenceRef = { signal_ids: [], quote_ids: [], source_urls: [] };
const minConfidence = { score: 0.5, label: "medium" as const, basis: null };

// ── OverviewSection ────────────────────────────────────────────────────────────

describe("overviewSectionSchema", () => {
  test("accepts a minimal valid object", () => {
    const result = overviewSectionSchema.parse({
      overall_perception_summary: "Test summary.",
      confidence_score: minConfidence,
    });
    expect(result.overall_perception_summary).toBe("Test summary.");
    expect(result.sources_scanned).toEqual([]);
    expect(result.total_mentions).toBeNull();
    expect(result.top_love_signal).toBeNull();
    expect(result.top_pain_signal).toBeNull();
    expect(result.top_gap_signal).toBeNull();
    expect(result.top_switch_signal).toBeNull();
    expect(result.strongest_opportunity).toBeNull();
  });

  test("rejects an object missing overall_perception_summary", () => {
    expect(() =>
      overviewSectionSchema.parse({ confidence_score: minConfidence }),
    ).toThrow();
  });

  test("rejects an object missing confidence_score", () => {
    expect(() =>
      overviewSectionSchema.parse({
        overall_perception_summary: "Test",
      }),
    ).toThrow();
  });
});

// ── FounderViewSection ─────────────────────────────────────────────────────────

describe("founderViewSectionSchema", () => {
  const minMove = {
    recommendation: "Ship it.",
    why: "Because.",
    confidence: minConfidence,
    evidence_refs: minEvidenceRef,
  };

  const minFounder = {
    opportunity_score: {
      score: 50,
      label: "Medium",
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
      target_segment: "ts",
      main_opportunity: "mo",
      why_now: "wn",
      confidence: minConfidence,
      evidence_refs: minEvidenceRef,
    },
    wedge_recommendation: {
      target_segment: "ts",
      core_pain: "cp",
      positioning_promise: "pp",
      why_this_wedge_exists: "why",
      evidence_strength: "medium" as const,
      risk_level: "low" as const,
      evidence_refs: minEvidenceRef,
    },
    pricing_opportunity: {
      pricing_pain_score: 0.4,
      main_pricing_complaint: "too expensive",
      affected_segment: "SMB",
      suggested_pricing_angle: "flat rate",
      evidence_refs: minEvidenceRef,
    },
    recommended_product_move: minMove,
    recommended_positioning_move: minMove,
    recommended_growth_move: minMove,
    evidence_refs: minEvidenceRef,
  };

  test("accepts a minimal valid object", () => {
    const result = founderViewSectionSchema.parse(minFounder);
    expect(result.opportunity_score.score).toBe(50);
    expect(result.strengths_to_respect).toEqual([]);
    expect(result.weaknesses_to_attack).toEqual([]);
    expect(result.unmet_needs).toEqual([]);
    expect(result.strategic_risks).toEqual([]);
  });

  test("rejects object missing opportunity_score", () => {
    const { opportunity_score: _, ...without } = minFounder;
    expect(() => founderViewSectionSchema.parse(without)).toThrow();
  });
});

// ── ProductViewSection ─────────────────────────────────────────────────────────

describe("productViewSectionSchema", () => {
  const minProduct = {
    product_opportunity_score: {
      score: 60,
      label: "High",
      explanation: "many gaps",
      factors: {
        feature_gap_frequency: 0.8,
        pain_severity: 0.7,
        source_spread: 0.6,
        user_urgency: 0.5,
        competitor_love_strength: 0.3,
      },
    },
    build_avoid_learn: { build: [], avoid: [], learn: [] },
    confidence_summary: minConfidence,
    evidence_refs: minEvidenceRef,
  };

  test("accepts a minimal valid object", () => {
    const result = productViewSectionSchema.parse(minProduct);
    expect(result.product_opportunity_score.score).toBe(60);
    expect(result.feature_gap_map).toEqual([]);
    expect(result.complaint_clusters_by_product_area).toEqual([]);
    expect(result.loved_competitor_features).toEqual([]);
    expect(result.workflow_friction).toEqual([]);
    expect(result.roadmap_opportunities).toEqual([]);
  });

  test("rejects object missing product_opportunity_score", () => {
    const { product_opportunity_score: _, ...without } = minProduct;
    expect(() => productViewSectionSchema.parse(without)).toThrow();
  });
});

// ── MarketingViewSection ───────────────────────────────────────────────────────

describe("marketingViewSectionSchema", () => {
  const minMarketing = {
    role: "marketing" as const,
    competitor_id: "cmp_123",
    generated_at: "2026-05-22T10:00:00Z",
    messaging_opportunity_score: {
      score: 72,
      label: "Strong",
      explanation: "clear pain",
      factors: {
        repeated_user_language_strength: 0.8,
        pain_clarity: 0.7,
        promise_reality_gap: 0.9,
        objection_frequency: 0.6,
        quote_quality: 0.75,
        source_confidence: 0.85,
      },
    },
    messaging_summary: "Users describe onboarding as painful.",
    user_language_bank: {
      positive_phrases: [],
      negative_phrases: [],
      alternative_seeking_phrases: [],
      emotional_adjectives: [],
      category_language: [],
    },
    comparison_page_bullets: {
      hero_angle: "No spreadsheets needed.",
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
    evidence_refs: minEvidenceRef,
  };

  test("accepts a minimal valid object", () => {
    const result = marketingViewSectionSchema.parse(minMarketing);
    expect(result.role).toBe("marketing");
    expect(result.competitor_id).toBe("cmp_123");
    expect(result.positioning_angles).toEqual([]);
    expect(result.competitor_promise_vs_user_reality).toEqual([]);
    expect(result.objections_to_handle).toEqual([]);
    expect(result.quote_library).toEqual([]);
  });

  test("rejects object missing role", () => {
    const { role: _, ...without } = minMarketing;
    expect(() => marketingViewSectionSchema.parse(without)).toThrow();
  });
});

// ── GrowthViewSection ──────────────────────────────────────────────────────────

describe("growthViewSectionSchema", () => {
  const minGrowth = {
    switch_intent_score: {
      score: 72,
      label: "High",
      explanation: "many posts seeking alternatives",
      factors: {
        alternative_seeking_posts: 0.8,
        pricing_complaints: 0.6,
        explicit_competitor_frustration: 0.7,
        recency: 0.9,
        engagement_level: 0.5,
        source_quality: 0.75,
      },
    },
    evidence_refs: minEvidenceRef,
  };

  test("accepts a minimal valid object", () => {
    const result = growthViewSectionSchema.parse(minGrowth);
    expect(result.switch_intent_score.score).toBe(72);
    expect(result.highest_opportunity_summary).toBeNull();
    expect(result.switch_intent_feed).toEqual([]);
    expect(result.highest_priority_conversations).toEqual([]);
    expect(result.pricing_pain_leads).toEqual([]);
    expect(result.communities_to_engage).toEqual([]);
    expect(result.suggested_reply_angles).toEqual([]);
    expect(result.segment_hints).toEqual([]);
    expect(result.source_links).toEqual([]);
  });

  test("rejects object missing switch_intent_score", () => {
    const { switch_intent_score: _, ...without } = minGrowth;
    expect(() => growthViewSectionSchema.parse(without)).toThrow();
  });
});

// ── EvidenceSection ────────────────────────────────────────────────────────────

describe("evidenceSectionSchema", () => {
  test("accepts an empty object (all arrays default)", () => {
    const result = evidenceSectionSchema.parse({});
    expect(result.quotes).toEqual([]);
    expect(result.source_links).toEqual([]);
    expect(result.raw_items).toEqual([]);
    expect(result.filters_supported).toEqual([
      "source",
      "signal_type",
      "sentiment",
      "confidence",
      "dashboard_section",
      "date",
      "role_relevance",
    ]);
  });

  test("accepts a fully populated evidence item", () => {
    const item = {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      quote: "The CSV export just breaks silently.",
      source: "reddit" as const,
      source_item_id: "raw-item-uuid",
      source_url: "https://reddit.com/r/saas/comments/abc",
      signal_type: "pain" as const,
      sentiment: -0.8,
      confidence: minConfidence,
    };
    const result = evidenceSectionSchema.parse({ quotes: [item] });
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]?.id).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
  });

  test("rejects an evidence item with invalid uuid", () => {
    const badItem = {
      id: "not-a-uuid",
      quote: "q",
      source: "reddit",
      source_item_id: "x",
      source_url: "https://reddit.com/r/x",
      signal_type: "pain",
      sentiment: -0.5,
      confidence: minConfidence,
    };
    expect(() => evidenceSectionSchema.parse({ quotes: [badItem] })).toThrow();
  });
});

// ── roleSectionsSchema (whole-object) ──────────────────────────────────────────

describe("roleSectionsSchema", () => {
  test("parses an object containing all six sections", () => {
    const minMove = {
      recommendation: "Ship it.",
      why: "Because.",
      confidence: minConfidence,
      evidence_refs: minEvidenceRef,
    };

    const input = {
      overview: {
        overall_perception_summary: "Good product with issues.",
        confidence_score: minConfidence,
      },
      founder: {
        opportunity_score: {
          score: 50,
          label: "Medium",
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
          target_segment: "ts",
          main_opportunity: "mo",
          why_now: "wn",
          confidence: minConfidence,
          evidence_refs: minEvidenceRef,
        },
        wedge_recommendation: {
          target_segment: "ts",
          core_pain: "cp",
          positioning_promise: "pp",
          why_this_wedge_exists: "why",
          evidence_strength: "medium" as const,
          risk_level: "low" as const,
          evidence_refs: minEvidenceRef,
        },
        pricing_opportunity: {
          pricing_pain_score: 0.4,
          main_pricing_complaint: "too expensive",
          affected_segment: "SMB",
          suggested_pricing_angle: "flat rate",
          evidence_refs: minEvidenceRef,
        },
        recommended_product_move: minMove,
        recommended_positioning_move: minMove,
        recommended_growth_move: minMove,
        evidence_refs: minEvidenceRef,
      },
      product: {
        product_opportunity_score: {
          score: 60,
          label: "High",
          explanation: "many gaps",
          factors: {
            feature_gap_frequency: 0.8,
            pain_severity: 0.7,
            source_spread: 0.6,
            user_urgency: 0.5,
            competitor_love_strength: 0.3,
          },
        },
        build_avoid_learn: { build: [], avoid: [], learn: [] },
        confidence_summary: minConfidence,
        evidence_refs: minEvidenceRef,
      },
      marketing: {
        role: "marketing" as const,
        competitor_id: "cmp_123",
        generated_at: "2026-05-22T10:00:00Z",
        messaging_opportunity_score: {
          score: 72,
          label: "Strong",
          explanation: "clear pain",
          factors: {
            repeated_user_language_strength: 0.8,
            pain_clarity: 0.7,
            promise_reality_gap: 0.9,
            objection_frequency: 0.6,
            quote_quality: 0.75,
            source_confidence: 0.85,
          },
        },
        messaging_summary: "Users describe onboarding as painful.",
        user_language_bank: {
          positive_phrases: [],
          negative_phrases: [],
          alternative_seeking_phrases: [],
          emotional_adjectives: [],
          category_language: [],
        },
        comparison_page_bullets: {
          hero_angle: "No spreadsheets needed.",
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
        evidence_refs: minEvidenceRef,
      },
      growth: {
        switch_intent_score: {
          score: 72,
          label: "High",
          explanation: "many posts seeking alternatives",
          factors: {
            alternative_seeking_posts: 0.8,
            pricing_complaints: 0.6,
            explicit_competitor_frustration: 0.7,
            recency: 0.9,
            engagement_level: 0.5,
            source_quality: 0.75,
          },
        },
        evidence_refs: minEvidenceRef,
      },
      evidence: {},
    };

    const result = roleSectionsSchema.parse(input);
    expect(result.overview.overall_perception_summary).toBe(
      "Good product with issues.",
    );
    expect(result.founder.opportunity_score.score).toBe(50);
    expect(result.product.product_opportunity_score.score).toBe(60);
    expect(result.marketing.role).toBe("marketing");
    expect(result.growth.switch_intent_score.score).toBe(72);
    expect(result.evidence.quotes).toEqual([]);
  });

  test("rejects when a section is missing", () => {
    expect(() => roleSectionsSchema.parse({ overview: {}, founder: {} })).toThrow();
  });
});
