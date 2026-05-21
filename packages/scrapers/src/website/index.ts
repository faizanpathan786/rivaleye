import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { crawlWebsite } from "./client";
import { normalizeWebsitePages } from "./normalize";

export class WebsiteScraper implements Scraper {
  readonly platform = "website" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    if (!query.websiteUrl) {
      throw new ScraperError("website", "websiteUrl is required for the website scraper");
    }
    try {
      const pages = await crawlWebsite(query.websiteUrl);
      const posts = normalizeWebsitePages(pages);
      if (posts.length === 0) {
        throw new ScraperError("website", "all crawled pages failed or contained no usable content");
      }
      return posts;
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("website", "crawl failed", err);
    }
  }
}
