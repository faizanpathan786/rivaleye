import { describe, expect, it, mock } from "bun:test";
import type { OpenRouterClient } from "@rivaleye/shared/llm";
import { expandKeywords } from "./keyword-expander";

const mockKeywords = [
  "notion alternative",
  "notion pricing complaints",
  "notion vs confluence",
  "notion pain points",
];

const mockLlm = {
  complete: mock(async () => ({
    parsed: { keywords: mockKeywords },
    raw: JSON.stringify({ keywords: mockKeywords }),
    usage: { promptTokens: 50, completionTokens: 20 },
    model: "test-model",
  })),
} as unknown as OpenRouterClient;

describe("expandKeywords", () => {
  it("returns the keywords array from the LLM response", async () => {
    const result = await expandKeywords(mockLlm, {
      competitor: "Notion",
      category: "project management software",
      audience: "founders",
      goal: "find_user_pain",
    });
    expect(result).toEqual(mockKeywords);
  });

  it("calls complete once with a system prompt and user message", async () => {
    const callArgs = (mockLlm.complete as ReturnType<typeof mock>).mock.calls[0] as [
      { system: string; user: string },
    ];
    expect(callArgs).toBeDefined();
    const req = callArgs[0];
    expect(typeof req.system).toBe("string");
    expect(req.system.length).toBeGreaterThan(0);
    expect(typeof req.user).toBe("string");
    expect(req.user).toContain("Notion");
    expect(req.user).toContain("founders");
    expect(req.user).toContain("find_user_pain");
  });
});
