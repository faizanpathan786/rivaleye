import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { findBusiness, getReviews } from "./client";
import { normalizeTrustpilotPayload } from "./normalize";

const DEFAULT_REVIEW_PAGES = 5;

export class TrustpilotScraper implements Scraper {
  readonly platform = "trustpilot" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    const apiKey = process.env["TRUSTPILOT_API_KEY"];
    if (!apiKey)
      throw new ScraperError(this.platform, "TRUSTPILOT_API_KEY env var is not set");

    try {
      const business = await findBusiness(apiKey, query.competitor);
      if (!business) return [];

      const reviews = await getReviews(
        apiKey,
        business.id,
        DEFAULT_REVIEW_PAGES,
      );
      return normalizeTrustpilotPayload(business, reviews);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError(this.platform, "fetch failed", err);
    }
  }
}
