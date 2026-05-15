import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export class ProductHuntScraper implements Scraper {
  readonly platform = "producthunt" as const;

  async fetch(_query: ScrapeQuery): Promise<NormalizedPost[]> {
    throw new ScraperError(
      this.platform,
      "not implemented — Product Hunt GraphQL API (free, rate-limited)",
    );
  }
}
