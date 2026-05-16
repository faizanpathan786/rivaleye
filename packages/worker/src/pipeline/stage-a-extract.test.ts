import { describe, expect, it } from "bun:test";
import { runStageAExtract } from "./stage-a-extract";
import type { OpenRouterClient } from "@rivaleye/shared";

describe("runStageAExtract (appstore)", () => {
  it("invokes the LLM with the appstore prompt and returns the parsed extract", async () => {
    const fakeLlm = {
      complete: async () => ({
        parsed: {
          complaints: [
            { text: "sync breaks daily", severity: 0.8, evidence_ids: ["r1"] },
          ],
          features_requested: [],
          pricing_signals: [],
          switching_signals: [],
          voice_phrases: { positive: [], negative: ["sync breaks"] },
          notable_quotes: [],
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
    expect(result.extract.complaints.length).toBe(1);
    expect(result.usage.promptTokens).toBe(10);
  });
});
