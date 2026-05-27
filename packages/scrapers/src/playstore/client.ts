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
  // Standard separators (hyphen, colon, pipe, em-dash, en-dash)
  if (t.startsWith(`${c} - `) || t.startsWith(`${c}: `) || t.startsWith(`${c} | `)) return true;
  if (t.startsWith(`${c} – `) || t.startsWith(`${c} — `)) return true;
  if (t === `${c} app` || t === `${c} - app`) return true;
  // Broad fallback: title starts with the competitor name and is followed by a non-letter
  const rest = t.slice(c.length);
  if (rest === "" || (rest.length > 0 && !/^[a-z0-9]/.test(rest))) return true;
  return false;
}

const SEARCH_COUNTRIES = ["us", "in", "gb"];

export async function searchApps(term: string, limit: number): Promise<{ apps: RawPlayStoreApp[]; country: string }> {
  try {
    // Try multiple storefronts — app may only be listed in specific regions (e.g., India).
    for (const country of SEARCH_COUNTRIES) {
      const results = await gplay.search({ term, num: Math.max(limit * 2, 10), lang: "en", country });
      const matched = results.filter((r) => appMatchesCompetitor(r.title, term));
      if (matched.length > 0) return { apps: matched.slice(0, limit), country };
    }
    return { apps: [], country: "us" };
  } catch (err) {
    throw new ScraperError("playstore", "search failed", err);
  }
}

export async function fetchReviews(appId: string, num: number, country = "us"): Promise<RawPlayStoreReview[]> {
  try {
    const result = await gplay.reviews({ appId, lang: "en", country, num, sort: SORT_NEWEST });
    return result.data;
  } catch (err) {
    throw new ScraperError("playstore", `reviews failed for ${appId}`, err);
  }
}
