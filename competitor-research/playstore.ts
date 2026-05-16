/**
 * Google Play Store Scraper
 * Uses google-play-scraper (unofficial, no API key required)
 *
 * Usage: ts-node playstore.ts "<search term>" [limit]
 * Example: ts-node playstore.ts "spotify" 5
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import gplay from "google-play-scraper";

const SEARCH_TERM = process.argv[2] || "spotify";
const LIMIT = parseInt(process.argv[3] || "5", 10);

async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function scrapeApp(appId: string): Promise<any> {
  const [metadata, reviewsResult, similar, permissions, datasafety] = await Promise.all([
    safeCall(() => gplay.app({ appId, lang: "en", country: "us" }), null),
    safeCall(
      () => (gplay.reviews({ appId, lang: "en", country: "us", num: 100, sort: gplay.sort.NEWEST }) as unknown) as Promise<{ data: any[]; nextPaginationToken?: string }>,
      { data: [] as any[], nextPaginationToken: undefined }
    ),
    safeCall(() => gplay.similar({ appId, lang: "en", country: "us" }), []),
    safeCall(() => gplay.permissions({ appId, lang: "en" }), []),
    safeCall(() => (gplay as any).datasafety({ appId, lang: "en" }), []),
  ]);

  return {
    metadata,
    reviews: (reviewsResult as any).data ?? [],
    similar,
    permissions,
    datasafety,
  };
}

async function main() {
  console.error(`Searching Play Store for: "${SEARCH_TERM}" (limit=${LIMIT})`);

  const searchResults = await gplay.search({
    term: SEARCH_TERM,
    num: LIMIT,
    lang: "en",
    country: "us",
  });

  console.error(`Found ${searchResults.length} apps. Fetching full details...`);

  const enriched = await Promise.all(
    searchResults.map((r: any) => {
      const appId = r.appId || new URL(r.url).searchParams.get("id") || "";
      return scrapeApp(appId);
    })
  );

  const output = {
    searchTerm: SEARCH_TERM,
    fetchedAt: new Date().toISOString(),
    apps: enriched,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
