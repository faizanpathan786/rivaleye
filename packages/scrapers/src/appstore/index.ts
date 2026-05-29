import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import {
  fetchReviews,
  lookupApp,
  searchApps,
  type RawAppStoreApp,
  type RawAppStoreReviewsFeed,
} from "./client";
import { normalizeAppStorePayload } from "./normalize";

const DEFAULT_APP_LIMIT = 5;
const DEFAULT_REVIEW_PAGES = 5;
const DEFAULT_COUNTRY = "us";

export class AppStoreScraper implements Scraper {
  readonly platform = "appstore" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      let apps: RawAppStoreApp[];
      let country: string;
      if (query.appStoreId) {
        // Sonar discovery handed us the exact trackId — skip name search.
        const found = await lookupApp(query.appStoreId);
        if (!found) {
          throw new ScraperError(
            "appstore",
            `lookup failed for appStoreId=${query.appStoreId} (no storefront returned a match)`,
          );
        }
        apps = [found.app];
        country = found.country;
      } else {
        const result = await searchApps(
          query.competitor,
          DEFAULT_COUNTRY,
          query.limit ?? DEFAULT_APP_LIMIT,
        );
        apps = result.apps;
        country = result.country;
      }
      const reviewsByAppId: Record<string, RawAppStoreReviewsFeed> = {};
      await Promise.all(
        apps.map(async (a) => {
          const entries = await fetchReviews(a.trackId, country, DEFAULT_REVIEW_PAGES);
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
