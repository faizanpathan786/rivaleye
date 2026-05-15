import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class G2Scraper implements Scraper {
  readonly platform = "g2" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — buy: Apify g2-scraper actor; do not roll our own HTML scrape",
    );
  }
}
