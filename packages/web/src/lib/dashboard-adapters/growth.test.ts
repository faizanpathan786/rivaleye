/**
 * growth.test.ts
 *
 * Unit tests for the Growth adapter.
 * Run with: pnpm --filter @rivaleye/web test
 */

import { describe, it, expect } from "vitest";
import {
  toGrowthViewProps,
  normalizeUrgency,
  normalizeUrgencyLmh,
  toDisplayTier,
  type GrowthViewSection,
  type SwitchIntentFeedItemContract,
} from "./growth";

// ─── Minimal fixture helpers ──────────────────────────────────────────────────

const EMPTY_EVIDENCE = {
  signal_ids: [] as string[],
  quote_ids: [] as string[],
  source_urls: [] as string[],
};

const CONFIDENCE = {
  score: 0.8,
  label: "high" as const,
  basis: "test basis",
};

function makeFeedItem(
  overrides: Partial<SwitchIntentFeedItemContract> = {},
): SwitchIntentFeedItemContract {
  return {
    id: "sif_001",
    source: "Reddit",
    title: "Looking for a Linear alternative",
    user_or_context: "r/SaaS",
    source_date: null,
    intent_type: "looking_for_alternative",
    competitor_mentioned: "Linear",
    pain_mentioned: "Per-seat pricing",
    urgency: "high",
    engagement_level: "high",
    intent_score: 0.87,
    suggested_angle: "Mention flat-rate pricing",
    source_url: "https://reddit.com/r/saas/comments/abc",
    evidence_refs: EMPTY_EVIDENCE,
    ...overrides,
  };
}

function makeMinimalSection(
  overrides: Partial<GrowthViewSection> = {},
): GrowthViewSection {
  return {
    highest_opportunity_summary: "15 threads seeking Notion alternatives",
    switch_intent_score: {
      score: 72,
      label: "High",
      explanation: "Strong alternative-seeking signal",
      factors: {
        alternative_seeking_posts: 0.88,
        pricing_complaints: 0.82,
        explicit_competitor_frustration: 0.74,
        recency: 0.91,
        engagement_level: 0.68,
        source_quality: 0.86,
      },
    },
    switch_intent_feed: [makeFeedItem({ intent_score: 0.87 })],
    highest_priority_conversations: [],
    pricing_pain_leads: [],
    communities_to_engage: [],
    suggested_reply_angles: [],
    segment_hints: [],
    spam_risk_notes: null,
    source_links: [],
    evidence_refs: EMPTY_EVIDENCE,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeUrgency (ConversationPriority)", () => {
  it('maps "research_only" → "research"', () => {
    expect(normalizeUrgency("research_only")).toBe("research");
  });

  it('passes "hot" through unchanged', () => {
    expect(normalizeUrgency("hot")).toBe("hot");
  });

  it('passes "warm" through unchanged', () => {
    expect(normalizeUrgency("warm")).toBe("warm");
  });
});

describe("normalizeUrgencyLmh (LowMedHigh)", () => {
  it('maps "high" → "hot"', () => {
    expect(normalizeUrgencyLmh("high")).toBe("hot");
  });

  it('maps "medium" → "warm"', () => {
    expect(normalizeUrgencyLmh("medium")).toBe("warm");
  });

  it('maps "low" → "research"', () => {
    expect(normalizeUrgencyLmh("low")).toBe("research");
  });
});

describe("toDisplayTier", () => {
  it('maps "low" → "Low"', () => {
    expect(toDisplayTier("low")).toBe("Low");
  });

  it('maps "medium" → "Medium"', () => {
    expect(toDisplayTier("medium")).toBe("Medium");
  });

  it('maps "high" → "High"', () => {
    expect(toDisplayTier("high")).toBe("High");
  });
});

describe("toGrowthViewProps — intent_score scaling", () => {
  it("multiplies intent_score by 100 for UI scale", () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ intent_score: 0.87 })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.intentScore).toBe(87);
  });

  it("rounds to nearest integer", () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ intent_score: 0.876 })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.intentScore).toBe(88);
  });

  it("handles 0.0 intent_score → 0", () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ intent_score: 0 })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.intentScore).toBe(0);
  });

  it("handles 1.0 intent_score → 100", () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ intent_score: 1.0 })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.intentScore).toBe(100);
  });
});

describe("toGrowthViewProps — urgency normalisation", () => {
  it('maps feed item urgency "high" → "hot"', () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ urgency: "high" })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.urgency).toBe("hot");
  });

  it('maps feed item urgency "medium" → "warm"', () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ urgency: "medium" })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.urgency).toBe("warm");
  });

  it('maps feed item urgency "low" → "research"', () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ urgency: "low" })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.urgency).toBe("research");
  });

  it('maps priority conversation priority "research_only" → "research"', () => {
    const section = makeMinimalSection({
      highest_priority_conversations: [
        {
          priority: "research_only",
          conversation_title: "Test conv",
          intent_type: "churn_signal",
          pain: null,
          source: "Reddit",
          source_date: null,
          suggested_action: "Watch",
          source_url: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.priority[0]?.priority).toBe("research");
  });

  it('maps priority conversation priority "hot" → "hot"', () => {
    const section = makeMinimalSection({
      highest_priority_conversations: [
        {
          priority: "hot",
          conversation_title: "Hot conv",
          intent_type: "looking_for_alternative",
          pain: "pricing",
          source: "HN",
          source_date: null,
          suggested_action: "Reply now",
          source_url: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.priority[0]?.priority).toBe("hot");
  });

  it('segment_hints urgency "high" → "hot"', () => {
    const section = makeMinimalSection({
      segment_hints: [
        {
          role_hint: "Founder",
          company_or_team_size_hint: "5–20",
          use_case: "PM tool",
          industry: "SaaS",
          urgency: "high",
          budget_sensitivity: "medium",
          technical_maturity: "high",
          confidence: CONFIDENCE,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.segmentHints[0]?.urgency).toBe("hot");
  });
});

describe("toGrowthViewProps — source_date formatting", () => {
  it("formats a recent ISO date to relative string", () => {
    // Use a date 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ source_date: twoHoursAgo })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.sourceDate).toBe("2h ago");
  });

  it('returns "—" for null source_date', () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ source_date: null })],
    });
    const props = toGrowthViewProps(section);
    expect(props.feed[0]?.sourceDate).toBe("—");
  });

  it("formats priority conversation source_date", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const section = makeMinimalSection({
      highest_priority_conversations: [
        {
          priority: "warm",
          conversation_title: "Test",
          intent_type: "migration_question",
          pain: null,
          source: "Reddit",
          source_date: threeDaysAgo,
          suggested_action: "Reply",
          source_url: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.priority[0]?.sourceDate).toBe("3d ago");
  });
});

describe("toGrowthViewProps — topOpportunity derivation", () => {
  it("picks the feed item with the highest intent_score", () => {
    const section = makeMinimalSection({
      switch_intent_feed: [
        makeFeedItem({ id: "sif_low", intent_score: 0.5, title: "Low intent" }),
        makeFeedItem({ id: "sif_high", intent_score: 0.95, title: "High intent" }),
        makeFeedItem({ id: "sif_mid", intent_score: 0.75, title: "Mid intent" }),
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.topOpportunity?.id).toBe("sif_high");
  });

  it("returns null when feed is empty", () => {
    const section = makeMinimalSection({ switch_intent_feed: [] });
    const props = toGrowthViewProps(section);
    expect(props.topOpportunity).toBeNull();
  });

  it("topOpportunity intentScore is already scaled to 0–100", () => {
    const section = makeMinimalSection({
      switch_intent_feed: [makeFeedItem({ intent_score: 0.96 })],
    });
    const props = toGrowthViewProps(section);
    expect(props.topOpportunity?.intentScore).toBe(96);
  });

  it("does not mutate the original switch_intent_feed order", () => {
    const ids = ["sif_a", "sif_b", "sif_c"];
    const section = makeMinimalSection({
      switch_intent_feed: [
        makeFeedItem({ id: "sif_a", intent_score: 0.5 }),
        makeFeedItem({ id: "sif_b", intent_score: 0.9 }),
        makeFeedItem({ id: "sif_c", intent_score: 0.7 }),
      ],
    });
    toGrowthViewProps(section);
    // Original order unchanged in the section (we should have sorted a copy)
    expect(section.switch_intent_feed.map((f) => f.id)).toEqual(ids);
  });
});

describe("toGrowthViewProps — community renames", () => {
  it("renames community_name → name", () => {
    const section = makeMinimalSection({
      communities_to_engage: [
        {
          community_name: "r/SaaS",
          source: "reddit",
          relevant_posts_count: 14,
          dominant_pain: "Pricing",
          engagement_level: "high",
          community_fit_score: 0.94,
          recommended_approach: "Founder-voice comments",
          spam_risk: "low",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.communities[0]?.name).toBe("r/SaaS");
  });

  it("renames relevant_posts_count → posts", () => {
    const section = makeMinimalSection({
      communities_to_engage: [
        {
          community_name: "r/SaaS",
          source: "reddit",
          relevant_posts_count: 23,
          dominant_pain: null,
          engagement_level: "medium",
          community_fit_score: 0.7,
          recommended_approach: null,
          spam_risk: "low",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.communities[0]?.posts).toBe(23);
  });

  it("renames community_fit_score → fit", () => {
    const section = makeMinimalSection({
      communities_to_engage: [
        {
          community_name: "HN",
          source: "hn",
          relevant_posts_count: 6,
          dominant_pain: null,
          engagement_level: "medium",
          community_fit_score: 0.82,
          recommended_approach: null,
          spam_risk: "medium",
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.communities[0]?.fit).toBe(0.82);
  });
});

describe("toGrowthViewProps — budget_sensitivity and technical_maturity display", () => {
  it('maps budget_sensitivity "low" → "Low"', () => {
    const section = makeMinimalSection({
      pricing_pain_leads: [
        {
          title: "Seat limit pain",
          pricing_issue: "Per-seat too expensive",
          plan_limitation: null,
          team_size_hint: "5–20",
          budget_sensitivity: "low",
          alternative_interest: null,
          suggested_pricing_angle: null,
          source_url: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.pricingLeads[0]?.budgetSensitivity).toBe("Low");
  });

  it('maps budget_sensitivity "high" → "High" in pricing leads', () => {
    const section = makeMinimalSection({
      pricing_pain_leads: [
        {
          title: "Enterprise shock",
          pricing_issue: "$42k quote",
          plan_limitation: null,
          team_size_hint: "120+",
          budget_sensitivity: "high",
          alternative_interest: "researching",
          suggested_pricing_angle: "Cost comparison",
          source_url: null,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.pricingLeads[0]?.budgetSensitivity).toBe("High");
  });

  it("maps technical_maturity in segment hints", () => {
    const section = makeMinimalSection({
      segment_hints: [
        {
          role_hint: "Engineer",
          company_or_team_size_hint: "50",
          use_case: "Dev tooling",
          industry: "SaaS",
          urgency: "medium",
          budget_sensitivity: "medium",
          technical_maturity: "high",
          confidence: CONFIDENCE,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.segmentHints[0]?.technicalMaturity).toBe("High");
    expect(props.segmentHints[0]?.budgetSensitivity).toBe("Medium");
  });
});

describe("toGrowthViewProps — reply angles", () => {
  it("preserves related_conversation_id", () => {
    const section = makeMinimalSection({
      suggested_reply_angles: [
        {
          related_conversation_id: "sif_001",
          context_summary: "User migrating off Notion",
          what_to_acknowledge: "Pricing frustration",
          what_not_to_say: "Don't name-drop",
          helpful_reply_angle: "Share transparent pricing",
          soft_cta_suggestion: "Link to pricing FAQ",
          spam_risk: "low",
          confidence: CONFIDENCE,
          evidence_refs: EMPTY_EVIDENCE,
        },
      ],
    });
    const props = toGrowthViewProps(section);
    expect(props.replyAngles[0]?.relatedConversationId).toBe("sif_001");
  });
});

describe("toGrowthViewProps — passthrough fields", () => {
  it("passes highest_opportunity_summary through", () => {
    const section = makeMinimalSection({
      highest_opportunity_summary: "3 hot threads today",
    });
    const props = toGrowthViewProps(section);
    expect(props.highestOpportunitySummary).toBe("3 hot threads today");
  });

  it("passes null highest_opportunity_summary", () => {
    const section = makeMinimalSection({ highest_opportunity_summary: null });
    const props = toGrowthViewProps(section);
    expect(props.highestOpportunitySummary).toBeNull();
  });

  it("passes switch_intent_score.score unchanged (already 0–100)", () => {
    const section = makeMinimalSection();
    const props = toGrowthViewProps(section);
    expect(props.switchIntentScore.score).toBe(72);
  });

  it("passes spam_risk_notes", () => {
    const section = makeMinimalSection({
      spam_risk_notes: "r/SaaS has strict self-promo rules",
    });
    const props = toGrowthViewProps(section);
    expect(props.spamRiskNotes).toBe("r/SaaS has strict self-promo rules");
  });
});
