import { describe, expect, it } from "bun:test";
import { runStageBSummarize } from "./stage-b-summarize";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageBSummarize (appstore)", () => {
  it("invokes the LLM with the appstore summarize prompt and returns a PlatformBrief", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          platform: "appstore",
          headline: "Sync failures dominate negative App Store feedback for Notion.",
          top_themes: [
            { theme: "sync reliability", weight: 0.6 },
            { theme: "performance", weight: 0.4 },
          ],
          sentiment: { positive: 0.2, neutral: 0.3, negative: 0.5 },
          most_quoted_competitors: [],
          evidence_coverage: 0.8,
        },
        raw: "{}",
        usage: { promptTokens: 20, completionTokens: 8 },
        model: "test-model",
      }),
    } as unknown as OpenRouterClient;

    const res = await runStageBSummarize({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: "founders",
        goal: "find_user_pain",
      },
      platform: "appstore",
      extract: {
        complaints: [{ text: "sync breaks daily", severity: 0.8, evidence_ids: ["r1"] }],
        features_requested: [],
        pricing_signals: [],
        switching_signals: [],
        voice_phrases: { positive: [], negative: ["sync breaks"] },
        notable_quotes: [],
      },
    });

    expect(res.brief.platform).toBe("appstore");
    expect(res.usage.promptTokens).toBe(20);
    expect(res.model).toBe("test-model");
  });
});
