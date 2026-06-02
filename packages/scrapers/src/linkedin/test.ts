// Quick test — run with: bun --env-file=.env packages/scrapers/src/linkedin/test.ts
import { LinkedInScraper } from "./index";

const scraper = new LinkedInScraper();
console.log("Scraping LinkedIn for ClickUp...");
const posts = await scraper.fetch({ competitor: "clickup", category: "project management", limit: 5 });
console.log(`Got ${posts.length} posts`);
posts.forEach((p, i) => console.log(`[${i}]`, p.body.slice(0, 120)));
