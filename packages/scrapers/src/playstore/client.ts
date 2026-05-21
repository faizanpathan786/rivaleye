import gplay from "google-play-scraper";
import type { IAppItem, IReviewsItem } from "google-play-scraper";
import { ScraperError } from "../types";

export type RawPlayStoreApp = IAppItem;
export type RawPlayStoreReview = IReviewsItem;

const SORT_NEWEST = 2 as const;

function appMatchesCompetitor(appTitle: string, competitor: string): boolean {
  const t = appTitle.toLowerCase().trim();
  const c = competitor.toLowerCase().trim();
  if (t === c) return true;
  if (t.startsWith(`${c} - `) || t.startsWith(`${c}: `) || t.startsWith(`${c} | `)) return true;
  if (t === `${c} app` || t === `${c} - app`) return true;
  return false;
}

export async function searchApps(term: string, limit: number): Promise<RawPlayStoreApp[]> {
  try {
    const results = await gplay.search({ term, num: Math.max(limit * 2, 10), lang: "en", country: "us" });
    const matched = results.filter((r) => appMatchesCompetitor(r.title, term));
    return matched.slice(0, limit);
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
