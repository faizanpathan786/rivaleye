import { ScraperError } from "../types";

export interface RawAppStoreApp {
  trackId: number;
  bundleId: string;
  trackName: string;
  artistName: string;
  version: string;
  averageUserRating?: number;
  userRatingCount?: number;
  averageUserRatingForCurrentVersion?: number;
  userRatingCountForCurrentVersion?: number;
  description: string;
  releaseNotes?: string;
  primaryGenreName: string;
  trackViewUrl: string;
  releaseDate: string;
  currentVersionReleaseDate: string;
}

export interface RawAppStoreReview {
  id: { label: string };
  author: { name: { label: string } };
  "im:rating": { label: string };
  "im:version"?: { label: string };
  title: { label: string };
  content: { label: string };
  updated: { label: string };
}

export interface RawAppStoreReviewsFeed {
  feed?: { entry?: RawAppStoreReview[] };
}

function appMatchesCompetitor(appName: string, competitor: string): boolean {
  const t = appName.toLowerCase().trim();
  const c = competitor.toLowerCase().trim();
  if (t === c) return true;
  // Standard separators (hyphen, colon, pipe, em-dash, en-dash)
  if (t.startsWith(`${c} - `) || t.startsWith(`${c}: `) || t.startsWith(`${c} | `)) return true;
  if (t.startsWith(`${c} – `) || t.startsWith(`${c} — `)) return true;
  if (t === `${c} app` || t === `${c} - app`) return true;
  // Broad fallback: title starts with the competitor name followed by a non-letter
  const rest = t.slice(c.length);
  if (rest === "" || (rest.length > 0 && !/^[a-z0-9]/.test(rest))) return true;
  return false;
}

const SEARCH_COUNTRIES = ["us", "in", "gb"];

/**
 * Direct lookup by numeric Apple trackId. Skips name-based search entirely so
 * we never match the wrong app when Sonar discovery has handed us the exact
 * identifier. Returns null if the trackId is unknown.
 */
export async function lookupApp(trackId: string): Promise<RawAppStoreApp | null> {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&entity=software`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results: RawAppStoreApp[] };
  return data.results[0] ?? null;
}

export async function searchApps(
  term: string,
  _defaultCountry: string,
  limit: number,
): Promise<{ apps: RawAppStoreApp[]; country: string }> {
  // Try multiple storefronts — some apps only appear in regional stores.
  for (const country of SEARCH_COUNTRIES) {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=25&lang=en_us`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = (await res.json()) as { results: RawAppStoreApp[] };
    const matched = data.results.filter((a) => appMatchesCompetitor(a.trackName, term));
    if (matched.length > 0) return { apps: matched.slice(0, limit), country };
  }
  return { apps: [], country: "us" };
}

export async function fetchReviews(
  appId: number,
  country: string,
  pages: number,
): Promise<RawAppStoreReview[]> {
  const out: RawAppStoreReview[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://itunes.apple.com/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json?l=en&cc=${country}`;
    const res = await fetch(url);
    if (res.status === 404) break;
    if (!res.ok) throw new ScraperError("appstore", `reviews HTTP ${res.status} (page ${page})`);
    const data = (await res.json()) as RawAppStoreReviewsFeed;
    const entries = data.feed?.entry ?? [];
    const reviewEntries = entries.filter((e) => !!e["im:rating"]);
    if (reviewEntries.length === 0) break;
    out.push(...reviewEntries);
  }
  return out;
}
