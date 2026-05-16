import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { algoliaSearch, algoliaSearchByDate } from "./client";
import { normalizeHackernewsPayload } from "./normalize";

const DEFAULT_HITS_PER_PAGE = 50;

export class HackerNewsScraper implements Scraper {
  readonly platform = "hackernews" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const limit = query.limit ?? DEFAULT_HITS_PER_PAGE;
      const [storiesByRelevance, storiesByDate, commentsByDate] = await Promise.all([
        algoliaSearch(query.competitor, "story", limit),
        algoliaSearchByDate(query.competitor, "story", limit),
        algoliaSearchByDate(query.competitor, "comment", limit),
      ]);

      const seenIds = new Set<string>();
      const allHits = [
        ...storiesByRelevance.hits,
        ...storiesByDate.hits,
        ...commentsByDate.hits,
      ].filter((hit) => {
        if (seenIds.has(hit.objectID)) return false;
        seenIds.add(hit.objectID);
        return true;
      });

      return normalizeHackernewsPayload(allHits);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("hackernews", "fetch failed", err);
    }
  }
}
