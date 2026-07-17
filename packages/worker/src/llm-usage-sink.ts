import { setLlmUsageSink } from "@rivaleye/shared";
import { db } from "./db";
import { llm_usage } from "../../api/src/db/schema/ops.js";

/**
 * Register the llm_usage persistence sink once at worker boot. Every LLM call
 * (through CostTrackingLlmClient) is recorded here for per-scan cost visibility
 * and the /metrics cost gauges. Insert failures are swallowed upstream so cost
 * logging can never break a scan.
 */
let registered = false;
export function registerLlmUsageSink(): void {
  if (registered) return;
  registered = true;
  setLlmUsageSink(async (r) => {
    await db.insert(llm_usage).values({
      report_id: r.reportId,
      tag: r.tag,
      model: r.model,
      provider: r.provider,
      prompt_tokens: r.promptTokens,
      completion_tokens: r.completionTokens,
      est_cost_usd: r.estCostUsd.toFixed(6),
      latency_ms: r.latencyMs,
    });
  });
}
