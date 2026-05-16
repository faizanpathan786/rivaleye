import gplay from "google-play-scraper";
import type { IAppItem, IReviewsItem } from "google-play-scraper";
import { ScraperError } from "../types";

export type RawPlayStoreApp = IAppItem;
export type RawPlayStoreReview = IReviewsItem;

const SORT_NEWEST = 2 as const;

export async function searchApps(term: string, limit: number): Promise<RawPlayStoreApp[]> {
  try {
    const results = await gplay.search({ term, num: limit, lang: "en", country: "us" });
    return results;
  } catch (err) {
    throw new ScraperError("playstore", "search failed", err);
  }
}

export async function fetchReviews(appId: string, num: number): Promise<RawPlayStoreReview[]> {
  try {
    const result = await gplay.reviews({ appId, lang: "en", country: "us", num, sort: SORT_NEWEST });
    return result.data;
  } catch (err) {
    throw new ScraperError("playstore", `reviews failed for ${appId}`, err);
  }
}
