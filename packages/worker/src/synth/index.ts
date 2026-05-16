import { serve } from "inngest/bun";
import { inngest } from "../inngest/client";
import { synthRun } from "./run";

const port = Number(process.env.WORKER_SYNTH_PORT ?? 3102);

Bun.serve({
  port,
  fetch: serve({ client: inngest, functions: [synthRun] }),
});

console.log(`[worker-synth] listening on :${port}`);
