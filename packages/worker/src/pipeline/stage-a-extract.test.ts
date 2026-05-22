import { describe, expect, it } from "bun:test";
import { runStageAExtract } from "./stage-a-extract";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageAExtract (appstore)", () => {
  it("invokes the LLM with the appstore prompt and returns the parsed Stage A extract", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          love_signals: [
            {
              title: "Clean UI",
              summary: "Users praise the interface.",
              sentiment: 0.8,
              strength_or_severity: 0.7,
              evidence_ids: ["a1"],
              representative_quotes: [],
              related_features: [],
              user_segment: null,
            },
          ],
          pain_signals: [
            {
              title: "Sync breaks",
              summary: "sync breaks daily",
              sentiment: -0.8,
              strength_or_severity: 0.8,
              evidence_ids: ["a2"],
              representative_quotes: [],
              related_features: [],
              user_segment: null,
            },
          ],
          gap_signals: [],
          switch_signals: [],
          pricing_signals: [],
          feature_signals: [],
          voice_phrases: { positive: [], negative: ["sync breaks"] },
          evidence_quotes: [],
        },
        raw: "{}",
        usage: { promptTokens: 10, completionTokens: 5 },
        model: "test",
      }),
    } as unknown as OpenRouterClient;

    const result = await runStageAExtract({
      llm: fakeLlm,
      ctx: {
        reportId: "r1",
        competitor: "Notion",
        category: "productivity",
        audience: "founders",
        goal: "find_user_pain",
      },
      platform: "appstore",
      posts: [
        {
          externalId: "appstore:1:r1",
          title: "broken",
          body: "sync breaks daily",
          score: 1,
          numComments: null,
          author: "u",
          url: "u",
          platform: "appstore",
          createdAt: new Date(),
          raw: {},
        },
      ],
    });
    expect(result.extract.love_signals.length).toBe(1);
    expect(result.extract.pain_signals.length).toBe(1);
    expect(result.usage.promptTokens).toBe(10);
  });
});
