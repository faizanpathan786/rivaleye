import type { LlmClient } from "./types";
import { OpenRouterClient } from "./openrouter";
import { MockLlmClient } from "./mock";
import { LLM_MODEL, readOpenRouterApiKey } from "./config";

export type LlmProvider = "openrouter" | "mock";

export function getLlmProvider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();
  return p === "mock" ? "mock" : "openrouter";
}

/**
 * Construct the active LLM client from LLM_PROVIDER (read at call time so tests
 * and workers can switch providers without a rebuild). "mock" returns the
 * deterministic zero-cost provider; anything else uses OpenRouter.
 */
export function createLlmClient(opts?: { model?: string }): LlmClient {
  if (getLlmProvider() === "mock") {
    return new MockLlmClient({ model: opts?.model });
  }
  return new OpenRouterClient({
    apiKey: readOpenRouterApiKey(),
    model: opts?.model ?? LLM_MODEL,
  });
}
