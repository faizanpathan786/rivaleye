import { describe, expect, it } from "bun:test";
import { runStageCMerge } from "./stage-c-merge";
import { emptyStageAExtract } from "./signal-adapters";
import { mergedClustersSchema } from "../prompts/shared";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageCMerge", () => {
  it("returns both mergedSignals and a legacy-valid merged, and enriches cluster stats", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          love_clusters: [],
          pain_clusters: [{
            id: "pain-sync", title: "Sync breaks", summary: "Sync fails daily.",
            signal_type: "pain", strength_or_severity: 0.8, evidence_ids: ["reddit:1"],
            representative_quotes: [{ author: "u/x", text: "sync broke", evidence_id: "reddit:1" }],
            related_signal_ids: [], role_relevance: ["product"],
            affected_segment: null, opportunity_implication: null,
          }],
          gap_clusters: [], switch_clusters: [], pricing_clusters: [],
          feature_clusters: [], positioning_clusters: [],
          voice_top: { positive: [], negative: [] }, cross_platform_themes: [],
        },
        raw: "{}",
        usage: { promptTokens: 40, completionTokens: 20 },
        model: "test-model",
      }),
    } as unknown as OpenRouterClient;

    const redditExtract = emptyStageAExtract();
    redditExtract.pain_signals = [{
      title: "Sync breaks", summary: "Sync fails.", sentiment: -0.8, strength_or_severity: 0.8,
      evidence_ids: ["reddit:1"], representative_quotes: [], related_features: [], user_segment: null,
    }];

    const res = await runStageCMerge({
      llm: fakeLlm,
      ctx: { reportId: "r1", competitor: "Notion", category: "productivity", audience: null, goal: "find_user_pain" },
      briefs: [],
      signalExtracts: [{ platform: "reddit", extract: redditExtract }],
    });

    expect(res.mergedSignals.pain_clusters[0]?.frequency).toBe(1);
    expect(res.mergedSignals.pain_clusters[0]?.platforms).toEqual(["reddit"]);
    expect(res.merged.complaint_clusters[0]?.title).toBe("Sync breaks");
    expect(() => mergedClustersSchema.parse(res.merged)).not.toThrow();
    expect(res.usage.promptTokens).toBe(40);
  });
});
