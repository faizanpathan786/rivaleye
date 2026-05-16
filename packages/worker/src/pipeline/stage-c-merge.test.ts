import { describe, expect, it } from "bun:test";
import { runStageCMerge } from "./stage-c-merge";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageCMerge", () => {
  it("invokes the LLM with the merge prompt and returns MergedClusters", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          complaint_clusters: [],
          feature_clusters: [],
          pricing_clusters: [],
          switching_clusters: [],
          voice_top: { positive: [], negative: [] },
          cross_platform_themes: [],
        },
        raw: "{}",
        usage: { promptTokens: 30, completionTokens: 12 },
        model: "test-model",
      }),
    } as unknown as OpenRouterClient;

    const res = await runStageCMerge({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: "founders",
        goal: "find_user_pain",
      },
      briefs: [],
      extracts: [],
    });

    expect(res.merged.complaint_clusters).toEqual([]);
    expect(res.usage.promptTokens).toBe(30);
    expect(res.model).toBe("test-model");
  });
});
