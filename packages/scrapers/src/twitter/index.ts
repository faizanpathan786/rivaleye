import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class TwitterScraper implements Scraper {
  readonly platform = "twitter" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — official X API Basic tier ($200/mo) or Apify twitter-scraper",
    );
  }
}
