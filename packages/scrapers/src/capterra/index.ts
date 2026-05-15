import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class CapterraScraper implements Scraper {
  readonly platform = "capterra" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — buy: Apify capterra-reviews actor",
    );
  }
}
