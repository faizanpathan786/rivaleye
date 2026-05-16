import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { getAccessToken, type RedditAuthConfig } from "./auth";
import { searchPosts } from "./search";
import { getComments, type RawRedditComment } from "./comments";
import { normalizePost } from "./normalize";

const SEARCH_TEMPLATES = [
  (name: string) => `${name} complaints`,
  (name: string) => `${name} alternatives`,
  (name: string) => `${name} vs`,
  (name: string) => `${name} pricing`,
  (name: string) => `${name} switching`,
  (name: string) => `${name} review`,
];

const MAX_POSTS_PER_TERM = 50;
const MAX_COMMENTS_PER_POST = 10;
const MAX_TOTAL_POSTS = 500;

export class RedditScraper implements Scraper {
  readonly platform = "reddit" as const;

  private readonly config: RedditAuthConfig;

  constructor() {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const userAgent = process.env.REDDIT_USER_AGENT;
    if (!clientId || !clientSecret || !userAgent) {
      throw new ScraperError(
        "reddit",
        "REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT are required",
      );
    }
    this.config = { clientId, clientSecret, userAgent };
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    // Validate token is accessible before starting
    await getAccessToken(this.config).catch((err) => {
      throw new ScraperError("reddit", "OAuth token fetch failed", err);
    });

    const terms = SEARCH_TEMPLATES.map((fn) => fn(query.competitor));
    const seenIds = new Set<string>();
    const posts: NormalizedPost[] = [];

    for (const term of terms) {
      if (posts.length >= MAX_TOTAL_POSTS) break;
      let raw;
      try {
        raw = await searchPosts(term, this.config, {
          limit: Math.min(MAX_POSTS_PER_TERM, MAX_TOTAL_POSTS - posts.length),
        });
      } catch (err) {
        console.warn(`[reddit] searchPosts skipped for term="${term}" competitor="${query.competitor}":`, err);
        continue;
      }

      for (const rawPost of raw) {
        if (seenIds.has(rawPost.id)) continue;
        seenIds.add(rawPost.id);

        let comments: RawRedditComment[] = [];
        try {
          comments = await getComments(rawPost.id, this.config, MAX_COMMENTS_PER_POST);
        } catch (err) {
          console.warn(`[reddit] getComments skipped for postId="${rawPost.id}" subreddit="${rawPost.subreddit}":`, err);
        }

        posts.push(normalizePost(rawPost, comments));
        if (posts.length >= MAX_TOTAL_POSTS) break;
      }
    }

    return posts;
  }
}
