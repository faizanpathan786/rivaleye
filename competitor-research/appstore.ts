/**
 * App Store Scraper
 * Uses Apple's public iTunes Search API + RSS review feed (no API key required)
 *
 * Usage: ts-node appstore.ts "<search term>" [countryCode] [limit]
 * Example: ts-node appstore.ts "spotify" us 10
 */

const SEARCH_TERM = process.argv[2] || "spotify";
const COUNTRY = process.argv[3] || "us";
const LIMIT = parseInt(process.argv[4] || "5", 10);

interface AppResult {
  appId: number;
  bundleId: string;
  name: string;
  developer: string;
  developerId: string;
  developerUrl: string;
  developerWebsite: string;
  icon: string;
  url: string;
  price: number;
  currency: string;
  free: boolean;
  description: string;
  releaseNotes: string;
  version: string;
  primaryGenre: string;
  genres: string[];
  rating: number;
  ratingsCount: number;
  currentVersionRating: number;
  currentVersionRatingsCount: number;
  minimumOsVersion: string;
  fileSizeMB: string;
  languages: string[];
  contentRating: string;
  screenshots: string[];
  ipadScreenshots: string[];
  appletvScreenshots: string[];
  releaseDate: string;
  updatedDate: string;
  supportedDevices: string[];
}

interface Review {
  id: string;
  author: string;
  authorUrl: string;
  version: string;
  rating: number;
  title: string;
  body: string;
  updated: string;
  voteSum: string;
  voteCount: string;
}

interface AppStoreResult {
  searchTerm: string;
  country: string;
  fetchedAt: string;
  apps: AppResult[];
}

async function searchApps(term: string, country: string, limit: number): Promise<AppResult[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${country}&entity=software&limit=${limit}&lang=en_us`;
  const res = await fetch(url);
  const data = await res.json() as { results: Record<string, unknown>[] };

  return data.results.map((r) => ({
    appId: r.trackId as number,
    bundleId: r.bundleId as string,
    name: r.trackName as string,
    developer: r.artistName as string,
    developerId: String(r.artistId),
    developerUrl: r.artistViewUrl as string,
    developerWebsite: r.sellerUrl as string || "",
    icon: r.artworkUrl512 as string || r.artworkUrl100 as string,
    url: r.trackViewUrl as string,
    price: r.price as number,
    currency: r.currency as string,
    free: (r.price as number) === 0,
    description: r.description as string,
    releaseNotes: r.releaseNotes as string || "",
    version: r.version as string,
    primaryGenre: r.primaryGenreName as string,
    genres: r.genres as string[] || [],
    rating: r.averageUserRating as number || 0,
    ratingsCount: r.userRatingCount as number || 0,
    currentVersionRating: r.averageUserRatingForCurrentVersion as number || 0,
    currentVersionRatingsCount: r.userRatingCountForCurrentVersion as number || 0,
    minimumOsVersion: r.minimumOsVersion as string,
    fileSizeMB: ((parseInt(r.fileSizeBytes as string, 10) / (1024 * 1024)).toFixed(2)),
    languages: r.languageCodesISO2A as string[] || [],
    contentRating: r.contentAdvisoryRating as string,
    screenshots: r.screenshotUrls as string[] || [],
    ipadScreenshots: r.ipadScreenshotUrls as string[] || [],
    appletvScreenshots: r.appletvScreenshotUrls as string[] || [],
    releaseDate: r.releaseDate as string,
    updatedDate: r.currentVersionReleaseDate as string,
    supportedDevices: r.supportedDevices as string[] || [],
  }));
}

async function getReviews(appId: number, country: string, pages = 10): Promise<Review[]> {
  const reviews: Review[] = [];

  for (let page = 1; page <= pages; page++) {
    const url = `https://itunes.apple.com/rss/customerreviews/page=${page}/id=${appId}/sortBy=mostRecent/json?l=en&cc=${country}`;
    try {
      const res = await fetch(url);
      const data = await res.json() as { feed?: { entry?: Record<string, unknown>[] } };

      const entries = data.feed?.entry;
      if (!entries || entries.length === 0) break;

      for (const entry of entries) {
        const e = entry as Record<string, { label?: string; attributes?: Record<string, string> }>;
        if (!e["im:rating"]) continue;
        reviews.push({
          id: e.id?.label || "",
          author: e.author ? (e.author as unknown as { name: { label: string } }).name.label : "",
          authorUrl: e.author ? (e.author as unknown as { uri: { label: string } }).uri.label : "",
          version: e["im:version"]?.label || "",
          rating: parseInt(e["im:rating"]?.label || "0", 10),
          title: e.title?.label || "",
          body: e.content?.label || "",
          updated: e.updated?.label || "",
          voteSum: e["im:voteSum"]?.label || "0",
          voteCount: e["im:voteCount"]?.label || "0",
        });
      }
    } catch {
      break;
    }
  }

  return reviews;
}

async function main() {
  console.error(`Searching App Store for: "${SEARCH_TERM}" (${COUNTRY}, limit=${LIMIT})`);

  const apps = await searchApps(SEARCH_TERM, COUNTRY, LIMIT);
  console.error(`Found ${apps.length} apps. Fetching reviews...`);

  const enriched = await Promise.all(
    apps.map(async (app) => {
      const reviews = await getReviews(app.appId, COUNTRY);
      return { ...app, reviews };
    })
  );

  const output: AppStoreResult & { apps: (AppResult & { reviews: Review[] })[] } = {
    searchTerm: SEARCH_TERM,
    country: COUNTRY,
    fetchedAt: new Date().toISOString(),
    apps: enriched,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
