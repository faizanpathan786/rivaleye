import { describe, expect, it, test } from "bun:test";
import { runStageCMerge } from "./stage-c-merge";
import { buildMerge } from "../prompts/cross/merge";
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

describe("buildMerge", () => {
  test("system prompt requires all evidence_ids to be included", () => {
    const result = buildMerge({
      ctx: {
        reportId: "r1",
        competitor: "Twilio",
        category: "Messaging",
        audience: null,
        goal: "find pain",
      },
      briefs: [],
      extracts: [],
    });
    expect(result.system).toContain("evidence_ids");
    expect(result.system).toContain("do not truncate");
  });

  test("system prompt includes both complaint and feature evidence_ids rules", () => {
    const result = buildMerge({
      ctx: {
        reportId: "r1",
        competitor: "Twilio",
        category: "Messaging",
        audience: null,
        goal: "find pain",
      },
      briefs: [],
      extracts: [],
    });
    expect(result.system).toContain("complaint_clusters[].evidence_ids");
    expect(result.system).toContain("feature_clusters[].evidence_ids");
  });
});
