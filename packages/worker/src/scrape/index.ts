import { serve } from "inngest/bun";
import { inngest } from "../inngest/client.js";
import { scrapeFetch } from "./fetch.js";
import { getPipelineEngine } from "../config.js";

const port = Number(process.env.WORKER_SCRAPE_PORT ?? 3100);
const engine = getPipelineEngine();

if (engine === "postgres") {
  console.log("[worker-scrape] Starting in postgres mode (pg-runner polling)");
  // Will import pg-runner later in Task 9
  // startPostgresRunner("source");
} else {
  console.log("[worker-scrape] Starting in inngest mode (scrape.fetch events)");
}

const handler = serve({ client: inngest, functions: [scrapeFetch] });

Bun.serve({
  port,
  fetch: handler,
});

console.log(`[worker-scrape] listening on :${port}`);
