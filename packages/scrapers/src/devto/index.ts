import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { getArticlesByTag, getComments, getTopArticlesByTag, searchArticles, searchTags } from "./client";
import type { DevToArticleWithComments } from "./normalize";
import { normalizeDevToPayload } from "./normalize";

const DEFAULT_PER_PAGE = 20;
const COMMENT_FETCH_LIMIT = 5;

export class DevToScraper implements Scraper {
  readonly platform = "devto" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const matchingTags = await searchTags(query.competitor);
      const tag = matchingTags[0]?.name;

      const perPage = query.limit ?? DEFAULT_PER_PAGE;
      let recentArticles: Awaited<ReturnType<typeof getArticlesByTag>> = [];
      let topArticles: Awaited<ReturnType<typeof getTopArticlesByTag>> = [];

      if (tag) {
        [recentArticles, topArticles] = await Promise.all([
          getArticlesByTag(tag, perPage).catch(() => []),
          getTopArticlesByTag(tag, perPage).catch(() => []),
        ]);
      } else {
        recentArticles = await searchArticles(query.competitor, perPage * 5);
      }

      const seenIds = new Set<number>();
      const allArticles = [...recentArticles, ...topArticles].filter((a) => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });

      const enriched: DevToArticleWithComments[] = await Promise.all(
        allArticles.slice(0, COMMENT_FETCH_LIMIT).map(async (article) => {
          const comments = await getComments(article.id).catch(() => []);
          return { ...article, comments };
        }),
      );
      const rest: DevToArticleWithComments[] = allArticles.slice(COMMENT_FETCH_LIMIT).map((a) => ({
        ...a,
        comments: [],
      }));

      return normalizeDevToPayload([...enriched, ...rest]);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("devto", "fetch failed", err);
    }
  }
}
