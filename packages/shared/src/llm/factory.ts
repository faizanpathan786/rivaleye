import type { LlmClient } from "./types";
import { OpenRouterClient } from "./openrouter";
import { MockLlmClient } from "./mock";
import { CostTrackingLlmClient } from "./cost";
import { LLM_MODEL, readOpenRouterApiKey } from "./config";

export type LlmProvider = "openrouter" | "mock";

export function getLlmProvider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase();
  return p === "mock" ? "mock" : "openrouter";
}

/**
 * Construct the active LLM client from LLM_PROVIDER (read at call time so tests
 * and workers can switch providers without a rebuild). "mock" returns the
 * deterministic zero-cost provider; anything else uses OpenRouter. Every client
 * is wrapped in CostTrackingLlmClient so usage is attributed + budget-enforced
 * regardless of provider (mock records $0, keeping load-test accounting honest).
 */
export function createLlmClient(opts?: { model?: string }): LlmClient {
  const provider = getLlmProvider();
  const inner =
    provider === "mock"
      ? new MockLlmClient({ model: opts?.model })
      : new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: opts?.model ?? LLM_MODEL });
  return new CostTrackingLlmClient(inner, provider);
}
