import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchReviews, searchApps } from "./client";
import type { RawPlayStoreReview } from "./client";
import { normalizePlayStorePayload } from "./normalize";

const DEFAULT_APP_LIMIT = 5;
const DEFAULT_REVIEW_NUM = 100;

export class PlayStoreScraper implements Scraper {
  readonly platform = "playstore" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const apps = await searchApps(query.competitor, query.limit ?? DEFAULT_APP_LIMIT);
      const reviewsByAppId: Record<string, RawPlayStoreReview[]> = {};
      await Promise.all(
        apps.map(async (a) => {
          reviewsByAppId[a.appId] = await fetchReviews(a.appId, DEFAULT_REVIEW_NUM);
        }),
      );
      return normalizePlayStorePayload(apps, reviewsByAppId);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("playstore", "fetch failed", err);
    }
  }
}
