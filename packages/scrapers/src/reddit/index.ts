import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class RedditScraper implements Scraper {
  readonly platform = "reddit" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — port from archive/legacy-v1 (OAuth + search + normalize)",
    );
  }
}
