import pino from "pino";
import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { getAccessToken, type RedditAuthConfig } from "./auth";
import { searchPosts } from "./search";
import { getComments, type RawRedditComment } from "./comments";
import { normalizePost } from "./normalize";

const log = pino({ name: "reddit-scraper" });

// Wrap multi-word names in quotes for exact-phrase Reddit search.
// Single-word names are searched bare (quotes don't help single tokens).
function phrase(name: string): string {
  return name.includes(" ") ? `"${name}"` : name;
}

const SEARCH_TEMPLATES = [
  (name: string) => phrase(name),
  (name: string) => `${phrase(name)} complaints`,
  (name: string) => `${phrase(name)} alternatives`,
  (name: string) => `${phrase(name)} vs`,
  (name: string) => `${phrase(name)} review`,
  (name: string) => `${phrase(name)} experience`,
  (name: string) => `${phrase(name)} problems`,
  (name: string) => `using ${phrase(name)}`,
];

const MAX_SEARCH_TERMS = process.env["REDDIT_MAX_TERMS"] ? parseInt(process.env["REDDIT_MAX_TERMS"], 10) : 5;
const MAX_POSTS_PER_TERM = process.env["REDDIT_MAX_POSTS_PER_TERM"] ? parseInt(process.env["REDDIT_MAX_POSTS_PER_TERM"], 10) : 25;
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

    // Relevance filter: keep only posts that mention the competitor name
    // somewhere in their title or body (case-insensitive). This removes false
    // positives where "varsity", "zerodha", etc. match unrelated subreddits.
    const competitorLower = query.competitor.toLowerCase();
    const relevant = posts.filter((p) => {
      const text = `${p.title ?? ""} ${p.body}`.toLowerCase();
      return text.includes(competitorLower);
    });
    const filtered = posts.length - relevant.length;
    log.info({
      competitor: query.competitor,
      totalPosts: posts.length,
      relevantPosts: relevant.length,
      filteredOut: filtered,
      uniqueSubreddits: [...new Set(relevant.map(p => (p.raw as any)?.subreddit).filter(Boolean))].length,
      durationMs: Date.now() - t0,
    }, "Reddit scrape complete");
    return relevant;
  }
}
