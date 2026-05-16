import { describe, expect, it, mock } from "bun:test";
import { z } from "zod";
import { OpenRouterClient } from "./openrouter";
import { LlmJsonParseError, LlmSchemaError } from "./errors";

const schema = z.object({ greeting: z.string() });

describe("OpenRouterClient", () => {
  it("parses JSON content into the provided Zod schema", async () => {
    const client = new OpenRouterClient({
      apiKey: "test",
      model: "test-model",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"greeting":"hi"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 4 },
        }),
        text: async () => "",
      } as unknown as Response),
    });
    const res = await client.complete({ system: "s", user: "u", schema });
    expect(res.parsed).toEqual({ greeting: "hi" });
    expect(res.usage).toEqual({ promptTokens: 10, completionTokens: 4 });
  });

  it("retries once on malformed JSON, then throws LlmJsonParseError", async () => {
    let calls = 0;
    const client = new OpenRouterClient({
      apiKey: "test",
      model: "test-model",
      fetcher: async () => {
        calls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "definitely not json" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          text: async () => "",
        } as unknown as Response;
      },
    });
    await expect(
      client.complete({ system: "s", user: "u", schema }),
    ).rejects.toBeInstanceOf(LlmJsonParseError);
    expect(calls).toBe(2);
  });

  it("throws LlmSchemaError when JSON parses but schema rejects", async () => {
    const client = new OpenRouterClient({
      apiKey: "test",
      model: "test-model",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"unexpected":1}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        text: async () => "",
      } as unknown as Response),
    });
    await expect(
      client.complete({ system: "s", user: "u", schema }),
    ).rejects.toBeInstanceOf(LlmSchemaError);
  });
});
