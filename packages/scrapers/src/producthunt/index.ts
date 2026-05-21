import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { fetchComments, fetchProductPost } from "./client";
import { normalizeProductHuntPayload } from "./normalize";

export class ProductHuntScraper implements Scraper {
  readonly platform = "producthunt" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    const token = process.env["PRODUCTHUNT_TOKEN"];
    if (!token) throw new ScraperError(this.platform, "PRODUCTHUNT_TOKEN env var is not set");

    try {
      const post = await fetchProductPost(token, query.competitor);
      if (!post) return [];

      const comments = await fetchComments(token, post.id);
      return normalizeProductHuntPayload([{ ...post, comments }]);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError(this.platform, "fetch failed", err);
    }
  }
}
