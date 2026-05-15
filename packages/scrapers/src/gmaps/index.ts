import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class GoogleMapsScraper implements Scraper {
  readonly platform = "gmaps" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — Google Places API (paid, official) or Apify gmaps-reviews",
    );
  }
}
