import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { synthRun } from "./run";
import { getPipelineEngine } from "../config";
import { mainSynthOnly } from "../pg-runner/index.js";

const port = Number(process.env.WORKER_SYNTH_PORT ?? 4003);
const engine = getPipelineEngine();

if (engine === "postgres") {
  console.log("[worker-synth] Starting in postgres mode (pg-runner synth-only polling)");
  mainSynthOnly().catch(err => console.error("[worker-synth] Fatal error:", err));
} else {
  console.log("[worker-synth] Starting in inngest mode (synth.run events)");
  const server = Bun.serve({
    port,
    fetch: serve({ client: inngest, functions: [synthRun] }),
  });
  console.log(`[worker-synth] listening on :${server.port}`);
}
