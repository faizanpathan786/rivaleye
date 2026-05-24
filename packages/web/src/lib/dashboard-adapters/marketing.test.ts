/**
 * marketing.test.ts
 *
 * Unit tests for toMarketingViewProps.
 * Tests cover: bestAngle derivation, score factors reshape,
 * objection frequency normalisation, language bank completeness.
 */

import { describe, expect, it } from "vitest";
import {
  toMarketingViewProps,
  type MarketingViewSection,
} from "./marketing";

// ── Fixture helpers ──────────────────────────────────────────────────────────

const EMPTY_REF = { signal_ids: [], quote_ids: [], source_urls: [] };

const CONFIDENCE_HIGH = { score: 0.9, label: "high" as const, basis: "test" };
const CONFIDENCE_MED = { score: 0.6, label: "medium" as const, basis: "test" };
const CONFIDENCE_LOW = { score: 0.3, label: "low" as const, basis: "test" };

function makePhrase(phrase: string, frequency = 10): MarketingViewSection["user_language_bank"]["positive_phrases"][number] {
  return {
    phrase,
    frequency,
    sentiment: 0.5,
    source_count: 2,
    evidence_refs: EMPTY_REF,
  };
}

function makeAngle(
  title: string,
  confidenceScore: number,
): MarketingViewSection["positioning_angles"][number] {
  return {
    angle_title: title,
    suggested_message: `Message for ${title}`,
    pain_targeted: "Some pain",
    competitor_weakness: "Some weakness",
    competitor_strength_to_respect: "Some strength",
    best_channel_or_use_case: "LinkedIn",
    risk_warning: null,
    confidence: { score: confidenceScore, label: confidenceScore >= 0.66 ? "high" : confidenceScore >= 0.33 ? "medium" : "low", basis: null },
    evidence_refs: EMPTY_REF,
  };
}

function makeObjection(
  title: string,
  frequency: number,
): MarketingViewSection["objections_to_handle"][number] {
  return {
    objection_title: title,
    objection_type: "pricing",
    why_users_hesitate: "Hesitation reason",
    frequency,
    suggested_response: "Suggested response",
    confidence: CONFIDENCE_MED,
    evidence_refs: EMPTY_REF,
  };
}

function makeQuoteLibItem(
  quote: string,
  signal_type: MarketingViewSection["quote_library"][number]["signal_type"],
): MarketingViewSection["quote_library"][number] {
  return {
    quote,
    source: "Reddit",
    source_date: "2026-01-01",
    sentiment: -0.5,
    signal_type,
    related_positioning_angle: null,
    copy_usefulness_score: 0.8,
    source_url: null,
  };
}

function makeCopyItem(copy: string): MarketingViewSection["copy_ideas"]["homepage_headlines"][number] {
  return {
    copy,
    signal_behind_it: "Some signal",
    best_use_case: "Homepage",
    confidence: CONFIDENCE_HIGH,
    evidence_refs: EMPTY_REF,
  };
}

function makeMinimalSection(
  overrides: Partial<MarketingViewSection> = {},
): MarketingViewSection {
  return {
    role: "marketing",
    competitor_id: "comp_001",
    generated_at: "2026-05-22T10:00:00Z",
    messaging_opportunity_score: {
      score: 72,
      label: "Strong",
      explanation: "Test explanation",
      factors: {
        repeated_user_language_strength: 0.82,
        pain_clarity: 0.74,
        promise_reality_gap: 0.91,
        objection_frequency: 0.60,
        quote_quality: 0.77,
        source_confidence: 0.85,
      },
    },
    messaging_summary: "Test summary",
    user_language_bank: {
      positive_phrases: [makePhrase("fast"), makePhrase("clean")],
      negative_phrases: [makePhrase("expensive"), makePhrase("slow")],
      alternative_seeking_phrases: [makePhrase("looking for alternative")],
      emotional_adjectives: [makePhrase("overwhelming")],
      category_language: [makePhrase("project tracker")],
    },
    positive_phrases: [],
    negative_phrases: [],
    positioning_angles: [],
    competitor_promise_vs_user_reality: [],
    objections_to_handle: [],
    comparison_page_bullets: {
      hero_angle: "The better alternative",
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
    evidence_refs: EMPTY_REF,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("toMarketingViewProps", () => {
  describe("score factors reshape", () => {
    it("converts the factors object into an array of { key, value } pairs", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      const { factors } = result.score;

      expect(Array.isArray(factors)).toBe(true);
      expect(factors).toHaveLength(6);

      const keys = factors.map((f) => f.key);
      expect(keys).toContain("repeated_user_language_strength");
      expect(keys).toContain("pain_clarity");
      expect(keys).toContain("promise_reality_gap");
      expect(keys).toContain("objection_frequency");
      expect(keys).toContain("quote_quality");
      expect(keys).toContain("source_confidence");
    });

    it("preserves factor values exactly", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      const factorMap = Object.fromEntries(
        result.score.factors.map((f) => [f.key, f.value]),
      );

      expect(factorMap["repeated_user_language_strength"]).toBe(0.82);
      expect(factorMap["pain_clarity"]).toBe(0.74);
      expect(factorMap["promise_reality_gap"]).toBe(0.91);
      expect(factorMap["objection_frequency"]).toBe(0.60);
      expect(factorMap["quote_quality"]).toBe(0.77);
      expect(factorMap["source_confidence"]).toBe(0.85);
    });

    it("does not include a 'tone' or 'note' field on any factor", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      for (const factor of result.score.factors) {
        expect(factor).not.toHaveProperty("tone");
        expect(factor).not.toHaveProperty("note");
      }
    });

    it("passes through the composite score, label, and explanation unchanged", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      expect(result.score.score).toBe(72);
      expect(result.score.label).toBe("Strong");
      expect(result.score.explanation).toBe("Test explanation");
    });
  });

  describe("bestAngle derivation", () => {
    it("returns null when positioning_angles is empty", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({ positioning_angles: [] }),
      );
      expect(result.bestAngle).toBeNull();
    });

    it("returns the single angle when there is only one", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          positioning_angles: [makeAngle("Only Angle", 0.7)],
        }),
      );
      expect(result.bestAngle?.angle_title).toBe("Only Angle");
    });

    it("picks the angle with the highest confidence.score", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          positioning_angles: [
            makeAngle("Low Confidence", 0.3),
            makeAngle("High Confidence", 0.92),
            makeAngle("Medium Confidence", 0.6),
          ],
        }),
      );
      expect(result.bestAngle?.angle_title).toBe("High Confidence");
    });

    it("does not mutate the input angles array ordering", () => {
      const angles = [
        makeAngle("A", 0.3),
        makeAngle("B", 0.9),
        makeAngle("C", 0.6),
      ];
      const section = makeMinimalSection({ positioning_angles: angles });
      toMarketingViewProps(section);
      // Original array order must be preserved
      expect(section.positioning_angles[0]?.angle_title).toBe("A");
      expect(section.positioning_angles[1]?.angle_title).toBe("B");
      expect(section.positioning_angles[2]?.angle_title).toBe("C");
    });

    it("exposes all bestAngle sub-fields that the UI expects", () => {
      const angle = makeAngle("Best", 0.95);
      angle.risk_warning = "Use carefully";
      const result = toMarketingViewProps(
        makeMinimalSection({ positioning_angles: [angle] }),
      );
      const best = result.bestAngle;
      expect(best).not.toBeNull();
      expect(best?.angle_title).toBe("Best");
      expect(best?.suggested_message).toBeDefined();
      expect(best?.pain_targeted).toBeDefined();
      expect(best?.competitor_weakness).toBeDefined();
      expect(best?.competitor_strength_to_respect).toBeDefined();
      expect(best?.best_channel_or_use_case).toBeDefined();
      expect(best?.risk_warning).toBe("Use carefully");
      expect(best?.confidence).toBeDefined();
      expect(best?.evidence_refs).toBeDefined();
    });

    it("does NOT include mock-only standalone fields: evidence, sources, confidence scalar", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({ positioning_angles: [makeAngle("Angle", 0.9)] }),
      );
      // bestAngle is the new shape — it must have confidence as a Confidence
      // object, not a bare number
      const best = result.bestAngle;
      expect(typeof best?.confidence).toBe("object");
      expect(best).not.toHaveProperty("evidence");       // integer mention count dropped
      expect(best).not.toHaveProperty("sources");        // string[] sources dropped
    });
  });

  describe("objection frequency normalisation", () => {
    it("returns an empty array when there are no objections", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({ objections_to_handle: [] }),
      );
      expect(result.objections).toHaveLength(0);
    });

    it("normalises integer counts to 0..1 by dividing by max", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          objections_to_handle: [
            makeObjection("A", 100),
            makeObjection("B", 50),
            makeObjection("C", 25),
          ],
        }),
      );
      const freqs = result.objections.map((o) => o.frequency);
      // max is 100 → A = 1.0, B = 0.5, C = 0.25
      expect(freqs[0]).toBeCloseTo(1.0);
      expect(freqs[1]).toBeCloseTo(0.5);
      expect(freqs[2]).toBeCloseTo(0.25);
    });

    it("all normalised frequencies are in the range 0..1", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          objections_to_handle: [
            makeObjection("X", 300),
            makeObjection("Y", 1),
          ],
        }),
      );
      for (const o of result.objections) {
        expect(o.frequency).toBeGreaterThanOrEqual(0);
        expect(o.frequency).toBeLessThanOrEqual(1);
      }
    });

    it("the objection with the highest raw count gets frequency = 1.0", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          objections_to_handle: [
            makeObjection("Less", 40),
            makeObjection("Most", 80),
          ],
        }),
      );
      const maxFreq = Math.max(...result.objections.map((o) => o.frequency));
      expect(maxFreq).toBeCloseTo(1.0);
    });

    it("handles all-zero frequencies without NaN", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          objections_to_handle: [
            makeObjection("Zero1", 0),
            makeObjection("Zero2", 0),
          ],
        }),
      );
      for (const o of result.objections) {
        expect(o.frequency).toBe(0);
        expect(Number.isNaN(o.frequency)).toBe(false);
      }
    });
  });

  describe("language bank — all 5 sub-arrays", () => {
    it("exposes all 5 sub-arrays on language", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      expect(result.language).toHaveProperty("positive_phrases");
      expect(result.language).toHaveProperty("negative_phrases");
      expect(result.language).toHaveProperty("alternative_seeking_phrases");
      expect(result.language).toHaveProperty("emotional_adjectives");
      expect(result.language).toHaveProperty("category_language");
    });

    it("maps phrases from user_language_bank, not the top-level aliases", () => {
      const section = makeMinimalSection();
      // Override user_language_bank with distinct data; top-level aliases are empty
      section.user_language_bank.positive_phrases = [makePhrase("from_bank", 99)];
      section.positive_phrases = [makePhrase("from_alias", 1)];

      const result = toMarketingViewProps(section);
      // Should use the bank, not the alias
      expect(result.language.positive_phrases[0]?.phrase).toBe("from_bank");
    });

    it("preserves phrase item fields correctly", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      const phrase = result.language.positive_phrases[0];
      expect(phrase?.phrase).toBe("fast");
      expect(phrase?.frequency).toBe(10);
      expect(phrase?.sentiment).toBe(0.5);
      expect(phrase?.source_count).toBe(2);
      expect(phrase?.evidence_refs).toBeDefined();
    });

    it("all 5 sub-arrays default to empty arrays when bank is empty", () => {
      const section = makeMinimalSection();
      section.user_language_bank = {
        positive_phrases: [],
        negative_phrases: [],
        alternative_seeking_phrases: [],
        emotional_adjectives: [],
        category_language: [],
      };
      const result = toMarketingViewProps(section);
      expect(result.language.positive_phrases).toHaveLength(0);
      expect(result.language.negative_phrases).toHaveLength(0);
      expect(result.language.alternative_seeking_phrases).toHaveLength(0);
      expect(result.language.emotional_adjectives).toHaveLength(0);
      expect(result.language.category_language).toHaveLength(0);
    });
  });

  describe("quoteLib signals array", () => {
    it("wraps a single signal_type in a 1-element array", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          quote_library: [makeQuoteLibItem("Test quote", "pricing")],
        }),
      );
      expect(result.quoteLib[0]?.signals).toHaveLength(1);
      expect(result.quoteLib[0]?.signals[0]).toBe("pricing");
    });

    it("does not include a score (upvote int) field on quoteLib items", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          quote_library: [makeQuoteLibItem("Test quote", "pain")],
        }),
      );
      expect(result.quoteLib[0]).not.toHaveProperty("score");
    });

    it("preserves other quoteLib fields", () => {
      const result = toMarketingViewProps(
        makeMinimalSection({
          quote_library: [makeQuoteLibItem("Some quote text", "switch")],
        }),
      );
      const q = result.quoteLib[0];
      expect(q?.quote).toBe("Some quote text");
      expect(q?.source).toBe("Reddit");
      expect(q?.sentiment).toBe(-0.5);
      expect(q?.copy_usefulness_score).toBe(0.8);
    });
  });

  describe("comparison — chooseThem[] dropped", () => {
    it("does not include chooseThem on the comparison prop", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      expect(result.comparison).not.toHaveProperty("chooseThem");
      expect(result.comparison).not.toHaveProperty("choose_them");
    });

    it("includes the expected comparison fields", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      expect(result.comparison).toHaveProperty("hero_angle");
      expect(result.comparison).toHaveProperty("why_users_look_for_alternatives");
      expect(result.comparison).toHaveProperty("where_competitor_is_strong");
      expect(result.comparison).toHaveProperty("where_users_struggle");
      expect(result.comparison).toHaveProperty("who_should_choose_us");
      expect(result.comparison).toHaveProperty("objections_to_handle");
      expect(result.comparison).toHaveProperty("proof_quotes");
    });
  });

  describe("top-level identity fields", () => {
    it("passes through role, competitor_id, generated_at", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      expect(result.role).toBe("marketing");
      expect(result.competitor_id).toBe("comp_001");
      expect(result.generated_at).toBe("2026-05-22T10:00:00Z");
    });

    it("passes through messaging_summary", () => {
      const result = toMarketingViewProps(makeMinimalSection());
      expect(result.messaging_summary).toBe("Test summary");
    });

    it("passes through section-level evidence_refs", () => {
      const refs = { signal_ids: ["s1"], quote_ids: [], source_urls: [] };
      const result = toMarketingViewProps(
        makeMinimalSection({ evidence_refs: refs }),
      );
      expect(result.evidence_refs.signal_ids).toContain("s1");
    });
  });

  describe("copy ideas passthrough", () => {
    it("maps copy_ideas sub-arrays correctly", () => {
      const section = makeMinimalSection();
      section.copy_ideas.homepage_headlines = [makeCopyItem("Headline A")];
      section.copy_ideas.ad_hooks = [makeCopyItem("Ad Hook B")];
      const result = toMarketingViewProps(section);
      expect(result.copy.homepage_headlines[0]?.copy).toBe("Headline A");
      expect(result.copy.ad_hooks[0]?.copy).toBe("Ad Hook B");
    });
  });
});
