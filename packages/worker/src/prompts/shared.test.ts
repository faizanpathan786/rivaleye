import { describe, expect, it } from "bun:test";
import {
  platformExtractSchema,
  platformBriefSchema,
  mergedClustersSchema,
  synthOutputSchema,
} from "./shared";
import { stageAExtractSchema } from "./shared";

describe("canonical pipeline schemas", () => {
  it("accepts a minimal valid PlatformExtract", () => {
    expect(
      platformExtractSchema.safeParse({
        complaints: [],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [],
        voice_phrases: { positive: [], negative: [] },
        notable_quotes: [],
      }).success,
    ).toBe(true);
  });

  it("rejects PlatformExtract with wrong direction enum", () => {
    expect(
      platformExtractSchema.safeParse({
        complaints: [],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [
          { direction: "sideways", competitor: "x", evidence_ids: ["a"] },
        ],
        voice_phrases: { positive: [], negative: [] },
        notable_quotes: [],
      }).success,
    ).toBe(false);
  });

  it("accepts a minimal valid PlatformBrief", () => {
    expect(
      platformBriefSchema.safeParse({
        platform: "appstore",
        headline: "users hate the latest update",
        top_themes: [],
        sentiment: { positive: 0.2, neutral: 0.3, negative: 0.5 },
        most_quoted_competitors: [],
        evidence_coverage: 0,
      }).success,
    ).toBe(true);
  });

  it("accepts a minimal valid MergedClusters", () => {
    expect(
      mergedClustersSchema.safeParse({
        complaint_clusters: [],
        feature_clusters: [],
        pricing_clusters: [],
        switching_clusters: [],
        voice_top: { positive: [], negative: [] },
        cross_platform_themes: [],
      }).success,
    ).toBe(true);
  });

  it("accepts a minimal valid SynthOutput", () => {
    expect(
      synthOutputSchema.safeParse({
        complaints: [],
        feature_gaps: [],
        pricing_tiers: [],
        pricing_quotes: [],
        switching: [],
        quotes: [],
        voice_words: [],
        positioning: [],
        actions: [],
        leads: [],
        opportunities: [],
        threads: [],
        report_meta: {
          sentiment_overall: 0,
          sentiment_positive: 0,
          sentiment_neutral: 0,
          sentiment_negative: 0,
          sentiment_trend: "flat",
          voice_summary: null,
          voice_phrases: [],
          pricing_blended: null,
          pricing_pain_score: null,
          switching_net_signal: null,
          switching_reasons_out: [],
        },
      }).success,
    ).toBe(true);
  });
});

describe("stageAExtractSchema", () => {
  it("parses a full valid Stage A extract", () => {
    const parsed = stageAExtractSchema.parse({
      love_signals: [
        {
          title: "Fast onboarding",
          summary: "Users praise reaching first value in minutes.",
          sentiment: 0.8,
          strength_or_severity: 0.7,
          evidence_ids: ["reddit:1"],
          representative_quotes: [
            { author: "u/matt", text: "running before my coffee cooled", evidence_id: "reddit:1" },
          ],
          related_features: ["setup wizard"],
          user_segment: "solo devs",
        },
      ],
      pain_signals: [],
      gap_signals: [],
      switch_signals: [
        {
          title: "Eyeing Plivo",
          summary: "A user is pricing out Plivo.",
          sentiment: -0.4,
          strength_or_severity: 0.6,
          evidence_ids: ["reddit:2"],
          representative_quotes: [],
          related_features: [],
          user_segment: null,
          direction: "outbound",
          alternatives_mentioned: ["Plivo"],
        },
      ],
      pricing_signals: [
        {
          title: "Surprise surcharges",
          summary: "Carrier fees not shown upfront.",
          sentiment: -0.6,
          strength_or_severity: 0.8,
          evidence_ids: ["reddit:3"],
          representative_quotes: [],
          related_features: [],
          user_segment: null,
          tier_label: "Pay-as-you-go",
          quoted_price: "$0.0079/msg",
        },
      ],
      feature_signals: [
        {
          title: "Messaging API",
          summary: "Users discuss the messaging API quality.",
          sentiment: 0.2,
          strength_or_severity: 0.5,
          evidence_ids: ["reddit:4"],
          representative_quotes: [],
          related_features: [],
          user_segment: null,
          feature_name: "Messaging API",
          perception: "mixed",
        },
      ],
      voice_phrases: { positive: ["just works"], negative: ["too expensive"] },
      evidence_quotes: [
        {
          author: "u/matt",
          text: "running before my coffee cooled",
          evidence_id: "reddit:1",
          signal_type: "love",
          sentiment: 0.8,
        },
      ],
    });
    expect(parsed.love_signals.length).toBe(1);
    expect(parsed.switch_signals[0]?.direction).toBe("outbound");
    expect(parsed.pricing_signals[0]?.quoted_price).toBe("$0.0079/msg");
  });

  it("fills array defaults when signal groups are omitted", () => {
    const parsed = stageAExtractSchema.parse({
      pain_signals: [],
      voice_phrases: { positive: [], negative: [] },
    });
    expect(parsed.love_signals).toEqual([]);
    expect(parsed.feature_signals).toEqual([]);
    expect(parsed.positioning_signals).toEqual([]);
    expect(parsed.evidence_quotes).toEqual([]);
  });

  it("rejects sentiment outside -1..1", () => {
    expect(() =>
      stageAExtractSchema.parse({
        love_signals: [
          {
            title: "x",
            summary: "y",
            sentiment: 2,
            strength_or_severity: 0.5,
          },
        ],
        voice_phrases: { positive: [], negative: [] },
      }),
    ).toThrow();
  });
});
