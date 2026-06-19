import { describe, expect, it } from "bun:test";
import { runStageDSynth, enrichSynthOutput } from "./stage-d-synth";
import { PipelineError } from "./errors";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { MergedClusters, PlatformBrief, PlatformExtract, SynthOutput } from "../prompts/shared";

function emptySynth(): SynthOutput {
  return {
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
      sentiment_positive: 0.33,
      sentiment_neutral: 0.34,
      sentiment_negative: 0.33,
      sentiment_trend: "flat",
      voice_summary: null,
      voice_phrases: [],
      pricing_blended: null,
      pricing_pain_score: null,
      switching_net_signal: null,
      switching_reasons_out: [],
    },
    executive_brief: "Test brief for empty synth.",
  };
}

function baseSynth(): SynthOutput {
  return {
    complaints: [
      {
        external_id: "c1",
        title: "Hidden fees",
        tag: null,
        mentions: 0,
        delta: null,
        severity: 0.8,
        summary: null,
        threads: 0,
        sample: null,
        sample_author: null,
      },
    ],
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
    executive_brief: "Test brief for base synth.",
  };
}

const merged: MergedClusters = {
  complaint_clusters: [
    {
      title: "Hidden fees",
      summary: "fees",
      severity: 0.8,
      platforms: ["reddit"],
      evidence_ids: ["r:1", "r:2", "r:3"],
      sample_quote: null,
    },
  ],
  feature_clusters: [],
  pricing_clusters: [],
  switching_clusters: [],
  voice_top: { positive: [], negative: [] },
  cross_platform_themes: [],
};

const emptyBriefs: PlatformBrief[] = [];
const emptyExtracts: PlatformExtract[] = [];

describe("runStageDSynth", () => {
  it("returns synth output and usage from the LLM", async () => {
    const fakeParsed = emptySynth();
    const fakeLlm = {
      complete: async () => ({
        parsed: fakeParsed,
        raw: "{}",
        usage: { promptTokens: 100, completionTokens: 500 },
        model: "deepseek/deepseek-chat",
      }),
    } as unknown as OpenRouterClient;

    const res = await runStageDSynth({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: "founders",
        goal: "find_user_pain",
      },
      merged: {
        complaint_clusters: [],
        feature_clusters: [],
        pricing_clusters: [],
        switching_clusters: [],
        voice_top: { positive: [], negative: [] },
        cross_platform_themes: [],
      },
      briefs: [],
      extracts: [],
    });

    expect(res.synth.report_meta.sentiment_trend).toBe("flat");
    expect(res.usage.promptTokens).toBe(100);
    expect(res.model).toBe("deepseek/deepseek-chat");
  });

  it("wraps LLM errors in PipelineError(D)", async () => {
    const fakeLlm = {
      complete: async () => {
        throw new Error("upstream timeout");
      },
    } as unknown as OpenRouterClient;

    await expect(
      runStageDSynth({
        llm: fakeLlm,
        ctx: {
          reportId: "r2",
          competitor: "Linear",
          category: "project management",
          audience: null,
          goal: "find_user_pain",
        },
        merged: {
          complaint_clusters: [],
          feature_clusters: [],
          pricing_clusters: [],
          switching_clusters: [],
          voice_top: { positive: [], negative: [] },
          cross_platform_themes: [],
        },
        briefs: [],
        extracts: [],
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});

describe("enrichSynthOutput", () => {
  it("derives mentions from cluster evidence_ids count", () => {
    const synth = baseSynth();
    const result = enrichSynthOutput(synth, merged, emptyBriefs, emptyExtracts);
    expect(result.complaints[0]?.mentions).toBe(3);
  });

  it("maps notable_quotes from extracts to quotes array", () => {
    const synth = baseSynth();
    const extracts: PlatformExtract[] = [
      {
        complaints: [],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [],
        voice_phrases: { positive: [], negative: [] },
        notable_quotes: [
          { author: "alice", text: "This product overcharges!", evidence_id: "r:1" },
        ],
      },
    ];
    const result = enrichSynthOutput(synth, merged, emptyBriefs, extracts);
    expect(result.quotes[0]?.text).toBe("This product overcharges!");
    expect(result.quotes[0]?.who).toBe("alice");
  });

  it("computes sentiment_overall from platform briefs", () => {
    const synth = baseSynth();
    const briefs: PlatformBrief[] = [
      {
        platform: "reddit",
        headline: "Mixed reception",
        top_themes: [],
        sentiment: { positive: 0.1, neutral: 0.2, negative: 0.7 },
        most_quoted_competitors: [],
        evidence_coverage: 0.5,
      },
    ];
    const result = enrichSynthOutput(synth, merged, briefs, emptyExtracts);
    expect(result.report_meta.sentiment_overall).toBeCloseTo(-0.6, 5);
  });

  it("always derives mentions from evidence even if LLM set them", () => {
    const synth = baseSynth();
    synth.complaints[0]!.mentions = 99;
    const result = enrichSynthOutput(synth, merged, emptyBriefs, emptyExtracts);
    expect(result.complaints[0]?.mentions).toBe(3);
  });

  it("handles empty extracts gracefully", () => {
    const synth = baseSynth();
    const result = enrichSynthOutput(synth, merged, emptyBriefs, emptyExtracts);
    expect(result.quotes).toEqual([]);
  });
});
