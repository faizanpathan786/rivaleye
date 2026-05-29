import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchReviews, lookupApp, searchApps } from "./client";
import type { RawPlayStoreApp, RawPlayStoreReview } from "./client";
import { normalizePlayStorePayload } from "./normalize";

const DEFAULT_APP_LIMIT = 3;
const DEFAULT_REVIEW_NUM = 200;
const DEFAULT_COUNTRY = "us";

export class PlayStoreScraper implements Scraper {
  readonly platform = "playstore" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      let apps: RawPlayStoreApp[];
      let country: string;
      if (query.playStoreAppId) {
        // Sonar discovery handed us the exact package id — skip name search.
        const app = await lookupApp(query.playStoreAppId, DEFAULT_COUNTRY);
        if (!app) {
          throw new ScraperError(
            "playstore",
            `lookup failed for playStoreAppId=${query.playStoreAppId}`,
          );
        }
        apps = [app];
        country = DEFAULT_COUNTRY;
      } else {
        const result = await searchApps(query.competitor, query.limit ?? DEFAULT_APP_LIMIT);
        apps = result.apps;
        country = result.country;
      }
      const reviewsByAppId: Record<string, RawPlayStoreReview[]> = {};
      await Promise.all(
        apps.map(async (a) => {
          reviewsByAppId[a.appId] = await fetchReviews(a.appId, DEFAULT_REVIEW_NUM, country);
        }),
      );
      return normalizePlayStorePayload(apps, reviewsByAppId);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("playstore", "fetch failed", err);
    }
  }
}
