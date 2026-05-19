import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { stageA } from "./stage-a";
import { stageB } from "./stage-b";
import { getPipelineEngine } from "../config";

const port = Number(process.env.WORKER_LLM_PORT ?? 3101);
const engine = getPipelineEngine();

if (engine === "postgres") {
  console.log("[worker-llm] Starting in postgres mode (pg-runner polling)");
  // Will import pg-runner later in Task 9
  // startPostgresRunner("llm");
} else {
  console.log("[worker-llm] Starting in inngest mode (llm.stage-a/stage-b events)");
}

const handler = serve({ client: inngest, functions: [stageA, stageB] });

Bun.serve({
  port,
  fetch: handler,
});

console.log(`[worker-llm] listening on :${port}`);
