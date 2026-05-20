import pino from "pino";
import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { getAccessToken, type RedditAuthConfig } from "./auth";
import { searchPosts } from "./search";
import { getComments, type RawRedditComment } from "./comments";
import { normalizePost } from "./normalize";

const log = pino({ name: "reddit-scraper" });

const SEARCH_TEMPLATES = [
  (name: string) => name,
  (name: string) => `${name} complaints`,
  (name: string) => `${name} alternatives`,
  (name: string) => `${name} vs`,
  (name: string) => `${name} pricing`,
  (name: string) => `${name} switching`,
  (name: string) => `${name} review`,
  (name: string) => `using ${name}`,
  (name: string) => `${name} experience`,
  (name: string) => `${name} problems`,
];

const MAX_SEARCH_TERMS = process.env["REDDIT_MAX_TERMS"] ? parseInt(process.env["REDDIT_MAX_TERMS"], 10) : SEARCH_TEMPLATES.length;
const MAX_POSTS_PER_TERM = process.env["REDDIT_MAX_POSTS_PER_TERM"] ? parseInt(process.env["REDDIT_MAX_POSTS_PER_TERM"], 10) : 50;
const MAX_COMMENTS_PER_POST = 10;
const MAX_TOTAL_POSTS = MAX_SEARCH_TERMS * MAX_POSTS_PER_TERM;

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
    const t0 = Date.now();
    const terms = SEARCH_TEMPLATES.slice(0, MAX_SEARCH_TERMS).map((fn) => fn(query.competitor));
    log.info({ competitor: query.competitor, category: query.category, termCount: terms.length, maxPostsPerTerm: MAX_POSTS_PER_TERM, terms }, "Reddit scrape starting");

    // Validate token is accessible before starting
    log.info("Authenticating with Reddit OAuth");
    await getAccessToken(this.config).catch((err) => {
      throw new ScraperError("reddit", "OAuth token fetch failed", err);
    });
    log.info("Reddit OAuth ready");

    const seenIds = new Set<string>();
    const posts: NormalizedPost[] = [];

    for (const [termIdx, term] of terms.entries()) {
      if (posts.length >= MAX_TOTAL_POSTS) {
        log.info({ totalPosts: posts.length, max: MAX_TOTAL_POSTS }, "Reached max posts; stopping early");
        break;
      }

      log.info({ term, termIdx: termIdx + 1, totalTerms: terms.length, postsAccumulated: posts.length }, "Searching term");
      let raw;
      try {
        raw = await searchPosts(term, this.config, {
          limit: Math.min(MAX_POSTS_PER_TERM, MAX_TOTAL_POSTS - posts.length),
        });
      } catch (err) {
        log.warn({ term, err: err instanceof Error ? err.message : String(err) }, "searchPosts failed for term; skipping");
        continue;
      }

      const newInTerm = raw.filter((p) => !seenIds.has(p.id));
      log.info({ term, rawCount: raw.length, newCount: newInTerm.length, duplicates: raw.length - newInTerm.length }, "Search results");

      for (const rawPost of raw) {
        if (seenIds.has(rawPost.id)) continue;
        seenIds.add(rawPost.id);

        let comments: RawRedditComment[] = [];
        try {
          comments = await getComments(rawPost.id, this.config, MAX_COMMENTS_PER_POST);
        } catch (err) {
          log.warn({ postId: rawPost.id, subreddit: rawPost.subreddit, err: err instanceof Error ? err.message : String(err) }, "getComments failed; using post body only");
        }

        posts.push(normalizePost(rawPost, comments));
        log.debug({ postId: rawPost.id, subreddit: rawPost.subreddit, score: rawPost.score, comments: comments.length, totalSoFar: posts.length }, "Post collected");

        if (posts.length >= MAX_TOTAL_POSTS) break;
      }

      log.info({ term, postsAfterTerm: posts.length }, "Term done");
    }

    log.info({ competitor: query.competitor, totalPosts: posts.length, uniqueSubreddits: [...new Set(posts.map(p => (p.raw as any)?.subreddit).filter(Boolean))].length, durationMs: Date.now() - t0 }, "Reddit scrape complete");
    return posts;
  }
}
