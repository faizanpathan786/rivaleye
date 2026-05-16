import { describe, expect, it } from "bun:test";
import { runStageERefine } from "./stage-e-refine";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { MergedClusters, PipelineCtx, SynthOutput } from "../prompts/shared";

const ctx: PipelineCtx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: "founders",
  goal: "find_user_pain",
};

const merged: MergedClusters = {
  complaint_clusters: [],
  feature_clusters: [],
  pricing_clusters: [],
  switching_clusters: [],
  voice_top: { positive: [], negative: [] },
  cross_platform_themes: [],
};

const draft: SynthOutput = {
  complaints: [
    {
      external_id: "c1",
      title: "Sync issues",
      tag: null,
      mentions: 10,
      delta: null,
      severity: 0.8,
      summary: "sync breaks daily",
      threads: 3,
      sample: null,
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
    sentiment_overall: -0.4,
    sentiment_positive: 0.1,
    sentiment_neutral: 0.3,
    sentiment_negative: 0.6,
    sentiment_trend: "flat",
    voice_summary: null,
    voice_phrases: [],
    pricing_blended: null,
    pricing_pain_score: null,
    switching_net_signal: null,
    switching_reasons_out: [],
  },
};

describe("runStageERefine", () => {
  it("happy path — returns parsed refined output with fellBackToDraft=false", async () => {
    const refined: SynthOutput = {
      ...draft,
      complaints: [
        {
          ...draft.complaints[0]!,
          title: "Sync reliability issues",
        },
      ],
    };

    const fakeLlm: OpenRouterClient = {
      complete: async () => ({
        parsed: refined,
        raw: "{}",
        usage: { promptTokens: 20, completionTokens: 10 },
        model: "deepseek/deepseek-chat",
      }),
    } as unknown as OpenRouterClient;

    const result = await runStageERefine({ llm: fakeLlm, ctx, merged, draft });

    expect(result.fellBackToDraft).toBe(false);
    expect(result.refined.complaints[0]!.title).toBe("Sync reliability issues");
    expect(result.usage.promptTokens).toBe(20);
    expect(result.model).toBe("deepseek/deepseek-chat");
  });

  it("fallback — LLM throws → returns input.draft unchanged with fellBackToDraft=true", async () => {
    const fakeLlm: OpenRouterClient = {
      complete: async () => {
        throw new Error("LLM timeout");
      },
    } as unknown as OpenRouterClient;

    const result = await runStageERefine({ llm: fakeLlm, ctx, merged, draft });

    expect(result.fellBackToDraft).toBe(true);
    expect(result.refined).toEqual(draft);
    expect(result.model).toBe("(stage-e-fallback)");
  });
});
