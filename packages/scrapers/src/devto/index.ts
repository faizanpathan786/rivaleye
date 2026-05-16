import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { getArticlesByTag, getComments, getTopArticlesByTag, searchTags } from "./client";
import type { DevToArticleWithComments } from "./normalize";
import { normalizeDevToPayload } from "./normalize";

const DEFAULT_PER_PAGE = 20;
const COMMENT_FETCH_LIMIT = 5;

export class DevToScraper implements Scraper {
  readonly platform = "devto" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const matchingTags = await searchTags(query.competitor);
      const tag = matchingTags[0]?.name ?? query.competitor;

      const perPage = query.limit ?? DEFAULT_PER_PAGE;
      const [recentArticles, topArticles] = await Promise.all([
        getArticlesByTag(tag, perPage).catch(() => [] as Awaited<ReturnType<typeof getArticlesByTag>>),
        getTopArticlesByTag(tag, perPage).catch(
          () => [] as Awaited<ReturnType<typeof getTopArticlesByTag>>,
        ),
      ]);

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
