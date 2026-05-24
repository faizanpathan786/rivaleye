/**
 * product.test.ts — Unit tests for the product dashboard adapter (Task G3).
 *
 * Run via: bun test packages/web/src/lib/dashboard-adapters/product.test.ts
 *
 * Coverage areas:
 *   1. Score factors object preserved correctly
 *   2. Feature gap mapping — severity passthrough, no requirement/effort/risk
 *   3. Heatmap aggregation — groups by product_area, averages severity/spread,
 *      normalises volume, handles empty input
 *   4. Friction enum derivation from impact 0..1 via bucketFloat
 *   5. Rec lowercase normalisation ("Match" → "match", already lowercase kept)
 *   6. Roadmap — expected_impact passthrough, no impact enum
 *   7. Build/Avoid/Learn — evidence_count kept, no quote field
 */

import { describe, it, expect } from "vitest";
import {
  toProductViewProps,
  type ProductViewSection,
} from "./product";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_EVIDENCE = {
  signal_ids: [],
  quote_ids: [],
  source_urls: [],
};

const CONFIDENCE_MED = {
  score: 0.65,
  label: "medium" as const,
  basis: "test basis",
};

const CONFIDENCE_HIGH = {
  score: 0.85,
  label: "high" as const,
  basis: "strong evidence",
};

/** Minimal valid ProductViewSection for testing */
function makeSection(
  overrides: Partial<ProductViewSection> = {},
): ProductViewSection {
  return {
    product_opportunity_score: {
      score: 74,
      label: "High",
      explanation: "Three high-severity gaps",
      factors: {
        feature_gap_frequency: 0.8,
        pain_severity: 0.7,
        source_spread: 0.6,
        user_urgency: 0.5,
        competitor_love_strength: 0.3,
      },
    },
    feature_gap_map: [],
    complaint_clusters_by_product_area: [],
    loved_competitor_features: [],
    workflow_friction: [],
    roadmap_opportunities: [],
    build_avoid_learn: { build: [], avoid: [], learn: [] },
    confidence_summary: CONFIDENCE_MED,
    evidence_refs: EMPTY_EVIDENCE,
    ...overrides,
  };
}

// ─── 1. Score factors object ──────────────────────────────────────────────────

describe("score factors", () => {
  it("passes through all five factor keys unchanged", () => {
    const section = makeSection();
    const props = toProductViewProps(section);

    expect(props.score.value).toBe(74);
    expect(props.score.label).toBe("High");
    expect(props.score.explanation).toBe("Three high-severity gaps");
    expect(props.score.factors.feature_gap_frequency).toBe(0.8);
    expect(props.score.factors.pain_severity).toBe(0.7);
    expect(props.score.factors.source_spread).toBe(0.6);
    expect(props.score.factors.user_urgency).toBe(0.5);
    expect(props.score.factors.competitor_love_strength).toBe(0.3);
  });

  it("does not expose insight/focus/coverage mock-only fields", () => {
    const props = toProductViewProps(makeSection());
    const scoreAsRecord = props.score as Record<string, unknown>;

    expect(scoreAsRecord["insight"]).toBeUndefined();
    expect(scoreAsRecord["focus"]).toBeUndefined();
    expect(scoreAsRecord["coverage"]).toBeUndefined();
  });
});

// ─── 2. Feature gap mapping ───────────────────────────────────────────────────

describe("feature gap mapping", () => {
  it("maps gap fields correctly and preserves severity as 0..1 float", () => {
    const section = makeSection({
      feature_gap_map: [
        {
          feature_gap: "Bulk CSV export",
          summary: "Users want to export data",
          mentions: 47,
          sources: ["reddit", "g2"],
          severity: 0.8,
          confidence: CONFIDENCE_HIGH,
          user_segment: "enterprise admins",
          suggested_action: "Ship export MVP",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const gap = props.gaps[0];

    expect(gap).toBeDefined();
    // Use non-null assertion via optional chaining + explicit check
    if (!gap) throw new Error("gap should be defined");

    expect(gap.feature_gap).toBe("Bulk CSV export");
    expect(gap.mentions).toBe(47);
    expect(gap.severity).toBe(0.8);
    expect(gap.sources).toEqual(["reddit", "g2"]);
    expect(gap.user_segment).toBe("enterprise admins");
    expect(gap.suggested_action).toBe("Ship export MVP");
  });

  it("drops requirement, effort, and risk fields (mock-only)", () => {
    const section = makeSection({
      feature_gap_map: [
        {
          feature_gap: "Offline mode",
          summary: "Needs offline",
          mentions: 10,
          sources: [],
          severity: 0.5,
          confidence: CONFIDENCE_MED,
          user_segment: null,
          suggested_action: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const gap = props.gaps[0];
    if (!gap) throw new Error("gap should be defined");
    const gapAsRecord = gap as Record<string, unknown>;

    expect(gapAsRecord["requirement"]).toBeUndefined();
    expect(gapAsRecord["effort"]).toBeUndefined();
    expect(gapAsRecord["risk"]).toBeUndefined();
  });
});

// ─── 3. Heatmap aggregation ───────────────────────────────────────────────────

describe("heatmap aggregation", () => {
  it("returns an empty array when there are no complaint clusters", () => {
    const props = toProductViewProps(makeSection());
    expect(props.productAreas).toEqual([]);
  });

  it("creates one row per distinct product_area", () => {
    const section = makeSection({
      complaint_clusters_by_product_area: [
        {
          product_area: "onboarding",
          complaint_title: "Slow setup",
          summary: "Setup takes too long",
          frequency: 50,
          severity: 0.6,
          source_spread: 0.4,
          impact_on_workflow: 0.5,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
        {
          product_area: "performance",
          complaint_title: "Search is slow",
          summary: "Search takes > 2s",
          frequency: 90,
          severity: 0.8,
          source_spread: 0.7,
          impact_on_workflow: 0.9,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    expect(props.productAreas).toHaveLength(2);

    const areas = props.productAreas.map((r) => r.area);
    expect(areas).toContain("Onboarding");
    expect(areas).toContain("Performance");
  });

  it("averages severity and source_spread across clusters in the same area", () => {
    const section = makeSection({
      complaint_clusters_by_product_area: [
        {
          product_area: "collaboration",
          complaint_title: "Comment threading broken",
          summary: "Comments don't thread",
          frequency: 30,
          severity: 0.4,
          source_spread: 0.2,
          impact_on_workflow: 0.3,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
        {
          product_area: "collaboration",
          complaint_title: "Real-time sync lags",
          summary: "Sync is delayed",
          frequency: 70,
          severity: 0.8,
          source_spread: 0.6,
          impact_on_workflow: 0.7,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    expect(props.productAreas).toHaveLength(1);

    const row = props.productAreas[0];
    if (!row) throw new Error("row should be defined");

    expect(row.area).toBe("Collaboration");
    expect(row.cluster_count).toBe(2);
    // average severity: (0.4 + 0.8) / 2 = 0.6
    expect(row.severity).toBeCloseTo(0.6);
    // average source_spread: (0.2 + 0.6) / 2 = 0.4
    expect(row.source_spread).toBeCloseTo(0.4);
  });

  it("normalises volume so the area with the most clusters gets volume=1", () => {
    const section = makeSection({
      complaint_clusters_by_product_area: [
        // onboarding: 1 cluster
        {
          product_area: "onboarding",
          complaint_title: "A",
          summary: "a",
          frequency: 10,
          severity: 0.3,
          source_spread: 0.2,
          impact_on_workflow: 0.2,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
        // performance: 2 clusters → max
        {
          product_area: "performance",
          complaint_title: "B",
          summary: "b",
          frequency: 20,
          severity: 0.5,
          source_spread: 0.4,
          impact_on_workflow: 0.5,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
        {
          product_area: "performance",
          complaint_title: "C",
          summary: "c",
          frequency: 30,
          severity: 0.7,
          source_spread: 0.6,
          impact_on_workflow: 0.7,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const perfRow = props.productAreas.find((r) => r.area === "Performance");
    const onbRow = props.productAreas.find((r) => r.area === "Onboarding");

    if (!perfRow) throw new Error("performance row should exist");
    if (!onbRow) throw new Error("onboarding row should exist");

    expect(perfRow.volume).toBe(1); // 2 / 2 = 1 (max)
    expect(onbRow.volume).toBe(0.5); // 1 / 2 = 0.5
  });

  it("formats product_area enum labels correctly", () => {
    const section = makeSection({
      complaint_clusters_by_product_area: [
        {
          product_area: "ux_navigation",
          complaint_title: "Hard to navigate",
          summary: "Navigation is confusing",
          frequency: 40,
          severity: 0.5,
          source_spread: 0.5,
          impact_on_workflow: 0.4,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
        {
          product_area: "reporting_analytics",
          complaint_title: "Dashboards are limited",
          summary: "No custom dashboards",
          frequency: 60,
          severity: 0.7,
          source_spread: 0.6,
          impact_on_workflow: 0.6,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
        {
          product_area: "pricing_packaging",
          complaint_title: "Too expensive",
          summary: "Per-seat pricing bites",
          frequency: 80,
          severity: 0.9,
          source_spread: 0.8,
          impact_on_workflow: 0.8,
          suggested_product_response: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const areas = props.productAreas.map((r) => r.area);
    expect(areas).toContain("UX / Navigation");
    expect(areas).toContain("Reporting / Analytics");
    expect(areas).toContain("Pricing / Packaging");
  });
});

// ─── 4. Friction enum derivation ─────────────────────────────────────────────

describe("friction enum derivation from impact", () => {
  it("maps impact 0..1 to friction low/medium/high via bucketFloat thresholds", () => {
    const makeStep = (impact: number) => ({
      workflow_name: "Step",
      friction_point: "Some friction",
      impact,
      frequency: 10,
      affected_segment: null,
      suggested_improvement: null,
      evidence_refs: EMPTY_EVIDENCE,
    });

    const section = makeSection({
      workflow_friction: [
        makeStep(0.1),  // low
        makeStep(0.5),  // medium
        makeStep(0.8),  // high
        makeStep(0.33), // medium (inclusive lower bound)
        makeStep(0.66), // high (inclusive lower bound)
      ],
    });

    const props = toProductViewProps(section);

    expect(props.workflow[0]?.friction).toBe("low");
    expect(props.workflow[1]?.friction).toBe("medium");
    expect(props.workflow[2]?.friction).toBe("high");
    expect(props.workflow[3]?.friction).toBe("medium");
    expect(props.workflow[4]?.friction).toBe("high");
  });

  it("preserves the raw impact float alongside the bucketed friction", () => {
    const section = makeSection({
      workflow_friction: [
        {
          workflow_name: "Reporting",
          friction_point: "Export flow",
          impact: 0.73,
          frequency: 25,
          affected_segment: "Finance team",
          suggested_improvement: "Add scheduled reports",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const step = props.workflow[0];
    if (!step) throw new Error("step should be defined");

    expect(step.impact).toBe(0.73);
    expect(step.friction).toBe("high");
    expect(step.workflow_name).toBe("Reporting");
    expect(step.affected_segment).toBe("Finance team");
  });
});

// ─── 5. Rec lowercase normalisation ──────────────────────────────────────────

describe("recommendation (rec) normalisation", () => {
  it("normalises PascalCase recommendation values to lowercase", () => {
    const makeFeature = (recommendation: string) => ({
      feature_name: "Feature",
      why_users_love_it: "It is great",
      positive_mentions: 50,
      stickiness_level: 0.6,
      recommendation: recommendation as "learn" | "match" | "differentiate" | "ignore",
      product_lesson: null,
      evidence_refs: EMPTY_EVIDENCE,
    });

    const section = makeSection({
      loved_competitor_features: [
        makeFeature("Match"),
        makeFeature("Learn"),
        makeFeature("Differentiate"),
        makeFeature("Ignore"),
      ],
    });

    const props = toProductViewProps(section);

    expect(props.loves[0]?.recommendation).toBe("match");
    expect(props.loves[1]?.recommendation).toBe("learn");
    expect(props.loves[2]?.recommendation).toBe("differentiate");
    expect(props.loves[3]?.recommendation).toBe("ignore");
  });

  it("preserves already-lowercase recommendation values", () => {
    const section = makeSection({
      loved_competitor_features: [
        {
          feature_name: "Cmd-K",
          why_users_love_it: "Fast navigation",
          positive_mentions: 200,
          stickiness_level: 0.9,
          recommendation: "match",
          product_lesson: "Match on day one",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    expect(props.loves[0]?.recommendation).toBe("match");
  });
});

// ─── 6. Roadmap items ─────────────────────────────────────────────────────────

describe("roadmap opportunities", () => {
  it("passes expected_impact through as 0..1 float", () => {
    const section = makeSection({
      roadmap_opportunities: [
        {
          opportunity_title: "Scheduled report delivery",
          user_problem: "No scheduled exports",
          suggested_feature: "Cron-based export jobs",
          expected_impact: 0.8,
          effort_estimate: "medium",
          confidence: CONFIDENCE_HIGH,
          why_now: "Finance teams block adoption without this",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const item = props.roadmap[0];
    if (!item) throw new Error("roadmap item should be defined");

    expect(item.opportunity_title).toBe("Scheduled report delivery");
    expect(item.user_problem).toBe("No scheduled exports");
    expect(item.suggested_feature).toBe("Cron-based export jobs");
    expect(item.expected_impact).toBe(0.8);
    expect(item.effort_estimate).toBe("medium");
    expect(item.why_now).toBe("Finance teams block adoption without this");
  });

  it("does not expose a mock impact enum field", () => {
    const section = makeSection({
      roadmap_opportunities: [
        {
          opportunity_title: "X",
          user_problem: "Y",
          suggested_feature: "Z",
          expected_impact: 0.5,
          effort_estimate: "low",
          confidence: CONFIDENCE_MED,
          why_now: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });

    const props = toProductViewProps(section);
    const item = props.roadmap[0];
    if (!item) throw new Error("roadmap item should be defined");
    const itemAsRecord = item as Record<string, unknown>;

    // The mock had `impact: "high" | "med" | "low"` as an enum string.
    // The contract only has expected_impact (0..1 float). No `impact` enum.
    expect(itemAsRecord["impact"]).toBeUndefined();
  });
});

// ─── 7. Build / Avoid / Learn ─────────────────────────────────────────────────

describe("build / avoid / learn decisions", () => {
  it("maps evidence_count correctly for all three lists", () => {
    const makeDecisionItem = (title: string, evidence_count: number) => ({
      title,
      reason: "Good reason",
      evidence_count,
      confidence: CONFIDENCE_MED,
      evidence_refs: EMPTY_EVIDENCE,
    });

    const section = makeSection({
      build_avoid_learn: {
        build: [makeDecisionItem("Time tracking", 412)],
        avoid: [makeDecisionItem("AI summaries", 12)],
        learn: [makeDecisionItem("Cmd-K", 312)],
      },
    });

    const props = toProductViewProps(section);

    expect(props.decisions.build[0]?.evidence_count).toBe(412);
    expect(props.decisions.avoid[0]?.evidence_count).toBe(12);
    expect(props.decisions.learn[0]?.evidence_count).toBe(312);
  });

  it("does not expose the mock quote field on decision items", () => {
    const section = makeSection({
      build_avoid_learn: {
        build: [
          {
            title: "Native time tracking",
            reason: "Agency wedge",
            evidence_count: 412,
            confidence: CONFIDENCE_HIGH,
            evidence_refs: EMPTY_EVIDENCE,
          },
        ],
        avoid: [],
        learn: [],
      },
    });

    const props = toProductViewProps(section);
    const item = props.decisions.build[0];
    if (!item) throw new Error("item should be defined");
    const itemAsRecord = item as Record<string, unknown>;

    expect(itemAsRecord["quote"]).toBeUndefined();
  });

  it("preserves title and reason on decision items", () => {
    const section = makeSection({
      build_avoid_learn: {
        build: [],
        avoid: [
          {
            title: "Generic AI summaries",
            reason: "Saturated. No signal.",
            evidence_count: 12,
            confidence: CONFIDENCE_MED,
            evidence_refs: EMPTY_EVIDENCE,
          },
        ],
        learn: [],
      },
    });

    const props = toProductViewProps(section);
    const item = props.decisions.avoid[0];
    if (!item) throw new Error("item should be defined");

    expect(item.title).toBe("Generic AI summaries");
    expect(item.reason).toBe("Saturated. No signal.");
  });
});

// ─── 8. Section-level confidence and evidence_refs passthrough ────────────────

describe("section-level fields", () => {
  it("passes confidence_summary through unchanged", () => {
    const section = makeSection({
      confidence_summary: { score: 0.72, label: "medium", basis: "432 signals" },
    });
    const props = toProductViewProps(section);
    expect(props.confidence_summary.score).toBe(0.72);
    expect(props.confidence_summary.label).toBe("medium");
    expect(props.confidence_summary.basis).toBe("432 signals");
  });

  it("passes evidence_refs through unchanged", () => {
    const refs = {
      signal_ids: ["s1", "s2"],
      quote_ids: ["q1"],
      source_urls: [],
    };
    const section = makeSection({ evidence_refs: refs });
    const props = toProductViewProps(section);
    expect(props.evidence_refs).toEqual(refs);
  });
});
