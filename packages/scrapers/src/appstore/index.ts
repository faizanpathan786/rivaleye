import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class AppStoreScraper implements Scraper {
  readonly platform = "appstore" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — iTunes RSS reviews feed (free, official)",
    );
  }
}
