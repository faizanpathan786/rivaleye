import { describe, expect, it } from "bun:test";
import { runStageDSynth } from "./stage-d-synth";
import { PipelineError } from "./errors";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { SynthOutput } from "../prompts/shared";

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
  };
}

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
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });
});
