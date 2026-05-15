import { getScraper } from "@rivaleye/scrapers";
import type { ScrapePlatformJob } from "../queue";

export async function handleScrapePlatform(data: ScrapePlatformJob) {
  const scraper = getScraper(data.platform);
  const posts = await scraper.fetch({
    competitor: data.competitor,
    category: data.category,
    keywords: data.keywords,
  });
  // TODO: persist posts to db (mentions table) keyed on reportId+platform
  return { count: posts.length };
}
