import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { synthRun } from "./run";
import { getPipelineEngine } from "../config";

const port = Number(process.env.WORKER_SYNTH_PORT ?? 3102);
const engine = getPipelineEngine();

if (engine === "postgres") {
  console.log("[worker-synth] Starting in postgres mode (pg-runner polling)");
  // Will import pg-runner later in Task 9
  // startPostgresRunner("synth");
} else {
  console.log("[worker-synth] Starting in inngest mode (synth.run events)");
}

Bun.serve({
  port,
  fetch: serve({ client: inngest, functions: [synthRun] }),
});

console.log(`[worker-synth] listening on :${port}`);
