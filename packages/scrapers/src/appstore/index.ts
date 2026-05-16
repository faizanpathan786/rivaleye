import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchReviews, searchApps, type RawAppStoreReviewsFeed } from "./client";
import { normalizeAppStorePayload } from "./normalize";

const DEFAULT_APP_LIMIT = 5;
const DEFAULT_REVIEW_PAGES = 10;
const DEFAULT_COUNTRY = "us";

export class AppStoreScraper implements Scraper {
  readonly platform = "appstore" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const apps = await searchApps(
        query.competitor,
        DEFAULT_COUNTRY,
        query.limit ?? DEFAULT_APP_LIMIT,
      );
      const reviewsByAppId: Record<string, RawAppStoreReviewsFeed> = {};
      await Promise.all(
        apps.map(async (a) => {
          const entries = await fetchReviews(a.trackId, DEFAULT_COUNTRY, DEFAULT_REVIEW_PAGES);
          reviewsByAppId[String(a.trackId)] = { feed: { entry: entries } };
        }),
      );
      return normalizeAppStorePayload(apps, reviewsByAppId);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("appstore", "fetch failed", err);
    }
  }
}
