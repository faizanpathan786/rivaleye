import { describe, expect, it } from "bun:test";
import {
  platformExtractSchema,
  platformBriefSchema,
  mergedClustersSchema,
  synthOutputSchema,
} from "./shared";

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
