import pino from "pino";
import gplay from "google-play-scraper";
import type { IAppItem, IReviewsItem } from "google-play-scraper";
import { ScraperError } from "../types";

export type RawPlayStoreApp = IAppItem;
export type RawPlayStoreReview = IReviewsItem;

const log = pino({ name: "playstore-scraper" });
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

/**
 * Derive candidate app IDs from a competitor name to use as fallback when
 * gplay.search() is unavailable (Google blocks scraping from some IPs).
 *
 * Covers common patterns: notion.id, com.slack, com.asana.android, etc.
 */
function candidateAppIds(name: string): string[] {
  const n = name.toLowerCase().replace(/\s+/g, "");
  const nTitle = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase().replace(/\s+/g, "");
  return [
    `${n}.id`,
    `com.${n}`,
    `com.${nTitle}`,
    `com.${n}.android`,
    `com.${n}app`,
    `${n}.android`,
  ];
}

/**
 * Direct lookup by Google Play package id. Skips name-based search entirely
 * so we never match a lookalike app when Sonar discovery has handed us the
 * exact identifier. Tries each storefront because some apps are region-
 * locked (e.g. India-only). Returns { app, country } on hit so reviews fetch
 * from the correct storefront.
 */
export async function lookupApp(
  appId: string,
): Promise<{ app: RawPlayStoreApp; country: string } | null> {
  for (const country of SEARCH_COUNTRIES) {
    try {
      const app = (await gplay.app({ appId, lang: "en", country })) as RawPlayStoreApp;
      if (app) return { app, country };
    } catch {
      // Not available in this storefront — try next.
    }
  }
  return null;
}

export async function searchApps(term: string, limit: number): Promise<{ apps: RawPlayStoreApp[]; country: string }> {
  try {
    // Try multiple storefronts — app may only be listed in specific regions (e.g., India).
    for (const country of SEARCH_COUNTRIES) {
      const results = await gplay.search({ term, num: Math.max(limit * 2, 10), lang: "en", country });
      const matched = results.filter((r) => appMatchesCompetitor(r.title, term));
      if (matched.length > 0) return { apps: matched.slice(0, limit), country };
    }

    // gplay.search() can return 0 when Google blocks scraping from the current IP.
    // Fall back to direct app ID guessing so we still get reviews when we can derive the ID.
    log.warn({ term }, "gplay.search() returned 0 results; trying heuristic app ID fallback");
    for (const appId of candidateAppIds(term)) {
      try {
        const app = await gplay.app({ appId }) as RawPlayStoreApp;
        if (appMatchesCompetitor(app.title, term)) {
          log.info({ term, appId, title: app.title }, "Found app via heuristic ID");
          return { apps: [app], country: "us" };
        }
      } catch {
        // not found — try next pattern
      }
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
