/**
 * founder.test.ts — Unit tests for toFounderViewProps adapter.
 *
 * One fixture per insight type (plan requirement):
 *   - opportunity_score
 *   - market_opening_summary
 *   - strengths_to_respect   → loves[]
 *   - weaknesses_to_attack   → frustrations[]
 *   - unmet_needs            → unmet[]
 *   - wedge_recommendation   → wedge
 *   - pricing_opportunity    → pricing
 *   - strategic_risks        → risks[]
 *   - three moves            → actions[] (kind: product/positioning/growth)
 */

import { describe, it, expect } from "vitest";
import { toFounderViewProps } from "./founder";
import type { FounderViewSection } from "./founder";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const emptyRefs = { signal_ids: [], quote_ids: [], source_urls: [] };

const lowConf = { score: 0.4, label: "low" as const, basis: null };
const medConf = { score: 0.65, label: "medium" as const, basis: "65 signals" };
const highConf = { score: 0.88, label: "high" as const, basis: "188 signals across 4 platforms" };

const testRefs = {
  signal_ids: ["sig_1", "sig_2"],
  quote_ids: ["q_1"],
  source_urls: ["https://reddit.com/r/SaaS/1"],
};

// ─── Minimal full fixture ─────────────────────────────────────────────────────

const FIXTURE: FounderViewSection = {
  opportunity_score: {
    score: 74,
    label: "Strong opening",
    explanation: "High pain frequency with clear feature gaps and moderate loyalty",
    factors: {
      pain_frequency: 0.81,
      gap_severity: 0.72,
      switch_intent: 0.60,
      competitor_love_strength: 0.35,
      pricing_pain: 0.68,
      source_confidence: 0.75,
    },
  },
  market_opening_summary: {
    summary: "Users love the speed but churn on pricing above 15 seats",
    target_segment: "15–80 person B2B SaaS teams, Series A–B",
    main_opportunity: "Predictable growth-friendly pricing",
    why_now: "Post-layoffs teams model per-seat cost earlier than before",
    confidence: medConf,
    evidence_refs: testRefs,
  },
  strengths_to_respect: [
    {
      title: "Speed and keyboard-first feel",
      summary: "Users describe it as fast and opinionated",
      why_users_love_it: "Cmd-K muscle memory saves hours weekly",
      strategic_implication: "Don't compete on speed — differentiate elsewhere",
      confidence: highConf,
      evidence_refs: testRefs,
    },
  ],
  weaknesses_to_attack: [
    {
      title: "Pricing inflects at 15 seats",
      summary: "Per-seat math becomes painful for growing teams",
      severity: 0.84,
      frequency: 0.72,
      opportunity_implication: "Flat-tier pricing is the clearest wedge",
      confidence: highConf,
      evidence_refs: testRefs,
    },
  ],
  unmet_needs: [
    {
      need: "Native time tracking",
      user_segment: "Agencies, consultancies",
      frequency: 0.78,
      source_spread: 4,
      opportunity_level: "high",
      evidence_refs: testRefs,
    },
  ],
  wedge_recommendation: {
    target_segment: "15–80 person B2B teams, Series A–B",
    core_pain: "Per-seat math compounds — pain inflects between seats 15 and 30",
    positioning_promise: "The project tool that doesn't punish you for growing",
    why_this_wedge_exists: "Pricing is the #1 reason 'leaving' threads start",
    evidence_strength: "high",
    risk_level: "medium",
    evidence_refs: testRefs,
  },
  pricing_opportunity: {
    pricing_pain_score: 0.74,
    main_pricing_complaint: "Per-seat math inflects between 15 and 30 paid seats",
    affected_segment: "Founders of 20–80 person teams, contractor-heavy orgs",
    suggested_pricing_angle: "Flat-rate for up to 25 seats — remove the per-seat anxiety",
    risk_warning: "Users stay for integrations despite price complaints",
    evidence_refs: testRefs,
  },
  strategic_risks: [
    {
      risk_title: "Integration lock-in",
      explanation: "GitHub/Slack/Figma integrations create real migration cost",
      why_it_matters: "Price pain alone won't overcome deep workflow embedding",
      mitigation: "Build auto-import tooling on day one",
      severity: 0.79,
      evidence_refs: testRefs,
    },
  ],
  recommended_product_move: {
    recommendation: "Build pricing the day you build the product",
    why: "Pricing is the #1 outbound switching reason across 5 sources",
    confidence: highConf,
    evidence_refs: testRefs,
  },
  recommended_positioning_move: {
    recommendation: "Position against complexity-of-cost, not features",
    why: "Linear's features are strong; attacking price-as-you-grow wins",
    confidence: medConf,
    evidence_refs: testRefs,
  },
  recommended_growth_move: {
    recommendation: "Engage the 14 'leaving' threads with founder voice",
    why: "High-intent prospects are publicly signaling switch",
    confidence: { score: 0.84, label: "high", basis: "14 explicit-switch leads" },
    evidence_refs: testRefs,
  },
  evidence_refs: testRefs,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("toFounderViewProps", () => {
  const result = toFounderViewProps(FIXTURE);

  // ── Widget 1: opportunity_score ───────────────────────────────────────────
  describe("opportunity_score → opportunity", () => {
    it("maps score and label directly", () => {
      expect(result.opportunity.score).toBe(74);
      expect(result.opportunity.label).toBe("Strong opening");
    });

    it("maps explanation → headline", () => {
      expect(result.opportunity.headline).toBe(
        "High pain frequency with clear feature gaps and moderate loyalty"
      );
    });

    it("converts factors object to ordered array with correct keys and values", () => {
      const keys = result.opportunity.factors.map((f) => f.key);
      expect(keys).toEqual([
        "pain_frequency",
        "gap_severity",
        "switch_intent",
        "competitor_love_strength",
        "pricing_pain",
        "source_confidence",
      ]);
      const factorMap = Object.fromEntries(result.opportunity.factors.map((f) => [f.key, f.value]));
      expect(factorMap["pain_frequency"]).toBe(0.81);
      expect(factorMap["gap_severity"]).toBe(0.72);
      expect(factorMap["switch_intent"]).toBe(0.60);
      expect(factorMap["competitor_love_strength"]).toBe(0.35);
      expect(factorMap["pricing_pain"]).toBe(0.68);
      expect(factorMap["source_confidence"]).toBe(0.75);
    });

    it("always emits exactly 6 factor entries", () => {
      expect(result.opportunity.factors).toHaveLength(6);
    });
  });

  // ── Widget 2: market_opening_summary ────────────────────────────────────
  describe("market_opening_summary", () => {
    it("keeps summary unchanged", () => {
      expect(result.market_opening_summary.summary).toBe(
        "Users love the speed but churn on pricing above 15 seats"
      );
    });

    it("renames target_segment → target", () => {
      expect(result.market_opening_summary.target).toBe("15–80 person B2B SaaS teams, Series A–B");
    });

    it("keeps main_opportunity and why_now", () => {
      expect(result.market_opening_summary.main_opportunity).toBe(
        "Predictable growth-friendly pricing"
      );
      expect(result.market_opening_summary.why_now).toBe(
        "Post-layoffs teams model per-seat cost earlier than before"
      );
    });

    it("propagates confidence object", () => {
      expect(result.market_opening_summary.confidence).toEqual(medConf);
    });

    it("propagates evidence_refs", () => {
      expect(result.market_opening_summary.evidence_refs).toEqual(testRefs);
    });
  });

  // ── Widget 3: strengths_to_respect → loves ──────────────────────────────
  describe("strengths_to_respect → loves[]", () => {
    it("maps one strength", () => {
      expect(result.loves).toHaveLength(1);
    });

    it("keeps title unchanged", () => {
      expect(result.loves[0]?.title).toBe("Speed and keyboard-first feel");
    });

    it("renames summary → explanation", () => {
      expect(result.loves[0]?.explanation).toBe("Users describe it as fast and opinionated");
    });

    it("keeps why_users_love_it", () => {
      expect(result.loves[0]?.why_users_love_it).toBe("Cmd-K muscle memory saves hours weekly");
    });

    it("renames strategic_implication → implication", () => {
      expect(result.loves[0]?.implication).toBe(
        "Don't compete on speed — differentiate elsewhere"
      );
    });

    it("propagates confidence and evidence_refs", () => {
      expect(result.loves[0]?.confidence).toEqual(highConf);
      expect(result.loves[0]?.evidence_refs).toEqual(testRefs);
    });
  });

  // ── Widget 4: weaknesses_to_attack → frustrations ───────────────────────
  describe("weaknesses_to_attack → frustrations[]", () => {
    it("maps one weakness", () => {
      expect(result.frustrations).toHaveLength(1);
    });

    it("keeps title and summary", () => {
      expect(result.frustrations[0]?.title).toBe("Pricing inflects at 15 seats");
      expect(result.frustrations[0]?.summary).toBe(
        "Per-seat math becomes painful for growing teams"
      );
    });

    it("keeps severity and frequency as 0..1 floats (not bucketed)", () => {
      expect(result.frustrations[0]?.severity).toBe(0.84);
      expect(result.frustrations[0]?.frequency).toBe(0.72);
    });

    it("keeps opportunity_implication", () => {
      expect(result.frustrations[0]?.opportunity_implication).toBe(
        "Flat-tier pricing is the clearest wedge"
      );
    });
  });

  // ── Widget 5: unmet_needs → unmet ────────────────────────────────────────
  describe("unmet_needs → unmet[]", () => {
    it("maps one unmet need", () => {
      expect(result.unmet).toHaveLength(1);
    });

    it("keeps need unchanged", () => {
      expect(result.unmet[0]?.need).toBe("Native time tracking");
    });

    it("renames user_segment → segment", () => {
      expect(result.unmet[0]?.segment).toBe("Agencies, consultancies");
    });

    it("keeps frequency (0..1), source_spread (int), and opportunity_level", () => {
      expect(result.unmet[0]?.frequency).toBe(0.78);
      expect(result.unmet[0]?.source_spread).toBe(4);
      expect(result.unmet[0]?.opportunity_level).toBe("high");
    });
  });

  // ── Widget 6: wedge_recommendation → wedge ──────────────────────────────
  describe("wedge_recommendation → wedge", () => {
    it("sets title from positioning_promise", () => {
      expect(result.wedge.title).toBe(
        "The project tool that doesn't punish you for growing"
      );
    });

    it("renames target_segment → target", () => {
      expect(result.wedge.target).toBe("15–80 person B2B teams, Series A–B");
    });

    it("renames core_pain → pain", () => {
      expect(result.wedge.pain).toBe(
        "Per-seat math compounds — pain inflects between seats 15 and 30"
      );
    });

    it("renames positioning_promise → promise", () => {
      expect(result.wedge.promise).toBe(
        "The project tool that doesn't punish you for growing"
      );
    });

    it("renames why_this_wedge_exists → why", () => {
      expect(result.wedge.why).toBe("Pricing is the #1 reason 'leaving' threads start");
    });

    it("keeps evidence_strength and risk_level enum strings", () => {
      expect(result.wedge.evidence_strength).toBe("high");
      expect(result.wedge.risk_level).toBe("medium");
    });
  });

  // ── Widget 7: pricing_opportunity → pricing ──────────────────────────────
  describe("pricing_opportunity → pricing", () => {
    it("keeps pricing_pain_score as 0..1 (no multiplication)", () => {
      expect(result.pricing.score).toBe(0.74);
      expect(result.pricing.score).toBeGreaterThan(0);
      expect(result.pricing.score).toBeLessThanOrEqual(1);
    });

    it("renames main_pricing_complaint → main", () => {
      expect(result.pricing.main).toBe(
        "Per-seat math inflects between 15 and 30 paid seats"
      );
    });

    it("renames affected_segment → who", () => {
      expect(result.pricing.who).toBe(
        "Founders of 20–80 person teams, contractor-heavy orgs"
      );
    });

    it("renames suggested_pricing_angle → opportunity", () => {
      expect(result.pricing.opportunity).toBe(
        "Flat-rate for up to 25 seats — remove the per-seat anxiety"
      );
    });

    it("renames risk_warning → risk (may be null)", () => {
      expect(result.pricing.risk).toBe(
        "Users stay for integrations despite price complaints"
      );
    });

    it("passes through null risk_warning as null risk", () => {
      const noRisk: FounderViewSection = {
        ...FIXTURE,
        pricing_opportunity: {
          ...FIXTURE.pricing_opportunity,
          risk_warning: null,
        },
      };
      const r = toFounderViewProps(noRisk);
      expect(r.pricing.risk).toBeNull();
    });
  });

  // ── Widget 8: strategic_risks → risks ────────────────────────────────────
  describe("strategic_risks → risks[]", () => {
    it("maps one risk", () => {
      expect(result.risks).toHaveLength(1);
    });

    it("renames risk_title → title", () => {
      expect(result.risks[0]?.title).toBe("Integration lock-in");
    });

    it("keeps severity as 0..1 float", () => {
      expect(result.risks[0]?.severity).toBe(0.79);
    });

    it("keeps explanation and why_it_matters", () => {
      expect(result.risks[0]?.explanation).toBe(
        "GitHub/Slack/Figma integrations create real migration cost"
      );
      expect(result.risks[0]?.why_it_matters).toBe(
        "Price pain alone won't overcome deep workflow embedding"
      );
    });

    it("renames mitigation → recommendation", () => {
      expect(result.risks[0]?.recommendation).toBe(
        "Build auto-import tooling on day one"
      );
    });
  });

  // ── Widget 9: three moves → actions[] ────────────────────────────────────
  describe("three moves → actions[]", () => {
    it("always produces exactly 3 actions", () => {
      expect(result.actions).toHaveLength(3);
    });

    it("first action has kind 'product'", () => {
      expect(result.actions[0]?.kind).toBe("product");
    });

    it("second action has kind 'positioning'", () => {
      expect(result.actions[1]?.kind).toBe("positioning");
    });

    it("third action has kind 'growth'", () => {
      expect(result.actions[2]?.kind).toBe("growth");
    });

    it("maps recommendation → title for product move", () => {
      expect(result.actions[0]?.title).toBe(
        "Build pricing the day you build the product"
      );
    });

    it("maps recommendation → title for positioning move", () => {
      expect(result.actions[1]?.title).toBe(
        "Position against complexity-of-cost, not features"
      );
    });

    it("maps recommendation → title for growth move", () => {
      expect(result.actions[2]?.title).toBe(
        "Engage the 14 'leaving' threads with founder voice"
      );
    });

    it("keeps why, confidence, and evidence_refs on each action", () => {
      const a0 = result.actions[0]!;
      expect(a0.why).toBe("Pricing is the #1 outbound switching reason across 5 sources");
      expect(a0.confidence).toEqual(highConf);
      expect(a0.evidence_refs).toEqual(testRefs);
    });

    it("does NOT include a 'next' field (dropped mock-only field)", () => {
      for (const a of result.actions) {
        expect(a).not.toHaveProperty("next");
      }
    });

    it("does NOT include an 'evidence' string field (dropped mock-only field)", () => {
      for (const a of result.actions) {
        expect(a).not.toHaveProperty("evidence");
      }
    });
  });

  // ── Empty arrays pass through ─────────────────────────────────────────────
  describe("empty arrays", () => {
    it("returns empty loves when strengths_to_respect is empty", () => {
      const r = toFounderViewProps({ ...FIXTURE, strengths_to_respect: [] });
      expect(r.loves).toEqual([]);
    });

    it("returns empty frustrations when weaknesses_to_attack is empty", () => {
      const r = toFounderViewProps({ ...FIXTURE, weaknesses_to_attack: [] });
      expect(r.frustrations).toEqual([]);
    });

    it("returns empty unmet when unmet_needs is empty", () => {
      const r = toFounderViewProps({ ...FIXTURE, unmet_needs: [] });
      expect(r.unmet).toEqual([]);
    });

    it("returns empty risks when strategic_risks is empty", () => {
      const r = toFounderViewProps({ ...FIXTURE, strategic_risks: [] });
      expect(r.risks).toEqual([]);
    });
  });

  // ── Pricing score stays within 0..1 ────────────────────────────────────
  describe("pricing score boundary", () => {
    it("accepts minimum score of 0", () => {
      const r = toFounderViewProps({
        ...FIXTURE,
        pricing_opportunity: { ...FIXTURE.pricing_opportunity, pricing_pain_score: 0 },
      });
      expect(r.pricing.score).toBe(0);
    });

    it("accepts maximum score of 1", () => {
      const r = toFounderViewProps({
        ...FIXTURE,
        pricing_opportunity: { ...FIXTURE.pricing_opportunity, pricing_pain_score: 1 },
      });
      expect(r.pricing.score).toBe(1);
    });
  });
});
