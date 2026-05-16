import { serve } from "inngest/bun";
import { inngest } from "../inngest/client.js";
import { scrapeFetch } from "./fetch.js";

const port = Number(process.env.WORKER_SCRAPE_PORT ?? 3100);

const handler = serve({ client: inngest, functions: [scrapeFetch] });

Bun.serve({
  port,
  fetch: handler,
});

console.log(`[worker-scrape] listening on :${port}`);
