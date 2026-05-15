import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class LinkedInScraper implements Scraper {
  readonly platform = "linkedin" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — buy: Apify linkedin-post-search or Phantombuster; ToS hostile, never DIY",
    );
  }
}
