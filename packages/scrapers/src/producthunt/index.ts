import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchComments, fetchPosts, findTopicSlug } from "./client";
import { normalizeProductHuntPayload } from "./normalize";

const DEFAULT_POST_LIMIT = 20;
const TOP_POSTS_FOR_COMMENTS = 10;

export class ProductHuntScraper implements Scraper {
  readonly platform = "producthunt" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    const token = process.env["PRODUCTHUNT_TOKEN"];
    if (!token) throw new ScraperError(this.platform, "PRODUCTHUNT_TOKEN env var is not set");

    try {
      const slug = await findTopicSlug(token, query.competitor);
      if (!slug) return [];

      const posts = await fetchPosts(token, slug, query.limit ?? DEFAULT_POST_LIMIT);

      await Promise.all(
        posts.slice(0, TOP_POSTS_FOR_COMMENTS).map(async (post, i) => {
          const comments = await fetchComments(token, post.id);
          posts[i] = { ...post, comments };
        }),
      );

      return normalizeProductHuntPayload(posts);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError(this.platform, "fetch failed", err);
    }
  }
}
