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

export async function searchApps(
  term: string,
  country: string,
  limit: number,
): Promise<RawAppStoreApp[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=${limit}&lang=en_us`;
  const res = await fetch(url);
  if (!res.ok) throw new ScraperError("appstore", `search HTTP ${res.status}`);
  const data = (await res.json()) as { results: RawAppStoreApp[] };
  return data.results;
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
    if (!res.ok) break;
    const data = (await res.json()) as RawAppStoreReviewsFeed;
    const entries = data.feed?.entry ?? [];
    const reviewEntries = entries.filter((e) => !!e["im:rating"]);
    if (reviewEntries.length === 0) break;
    out.push(...reviewEntries);
  }
  return out;
}
