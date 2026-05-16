import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { stageA } from "./stage-a";
import { stageB } from "./stage-b";

const port = Number(process.env.WORKER_LLM_PORT ?? 3101);

const handler = serve({ client: inngest, functions: [stageA, stageB] });

Bun.serve({
  port,
  fetch: handler,
});

console.log(`[worker-llm] listening on :${port}`);
