import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class TrustpilotScraper implements Scraper {
  readonly platform = "trustpilot" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — buy: Trustpilot API or Apify actor",
    );
  }
}
