import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class PlayStoreScraper implements Scraper {
  readonly platform = "playstore" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — google-play-scraper npm lib",
    );
  }
}
