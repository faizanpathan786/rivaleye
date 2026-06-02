import { serve } from "inngest/bun";
import { inngest } from "../inngest/client.js";
import { scrapeFetch } from "./fetch.js";
import { getPipelineEngine } from "../config.js";
import { mainScrapeOnly } from "../pg-runner/index.js";

const port = Number(process.env.WORKER_SCRAPE_PORT ?? 4001);
const engine = getPipelineEngine();

if (engine === "postgres") {
  console.log("[worker-scrape] Starting in postgres mode (pg-runner scrape-only polling)");
  mainScrapeOnly().catch(err => console.error("[worker-scrape] Fatal error:", err));
} else {
  console.log("[worker-scrape] Starting in inngest mode (scrape.fetch events)");
  const handler = serve({ client: inngest, functions: [scrapeFetch] });
  const server = Bun.serve({ port, fetch: handler });
  console.log(`[worker-scrape] listening on :${server.port}`);
}
