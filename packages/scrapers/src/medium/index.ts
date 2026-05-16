import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchMediumFeed } from "./client";
import { normalizeMediumPayload } from "./normalize";

export class MediumScraper implements Scraper {
  readonly platform = "medium" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    const tagSlug = query.competitor.toLowerCase().replace(/\s+/g, "-");
    try {
      const items = await fetchMediumFeed(tagSlug);
      return normalizeMediumPayload(items);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError(this.platform, "fetch failed", err);
    }
  }
}
