import pino from "pino";
import { redditGet } from "./client";
import type { RedditAuthConfig } from "./auth";

const log = pino({ name: "reddit-search" });

export interface RawRedditPost {
  id: string;
  name: string;
  title: string;
  selftext: string;
  author: string | null;
  subreddit: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  url: string;
}

interface RedditListing {
  data: {
    children: Array<{ data: RawRedditPost }>;
    after: string | null;
  };
}

export async function searchPosts(
  term: string,
  config: RedditAuthConfig,
  opts: { sort?: string; time?: string; limit?: number } = {},
): Promise<RawRedditPost[]> {
  const { sort = "relevance", time = "year", limit = 50 } = opts;
  const t0 = Date.now();
  log.info({ term, sort, time, limit }, "Searching Reddit posts");
  const listing = await redditGet<RedditListing>(
    "/search",
    { q: term, type: "link", sort, t: time, limit },
    config,
  );
  const results = listing.data.children
    .map((c) => c.data)
    .filter((p) => p.author && p.author !== "[deleted]" && p.author.trim().length > 0);
  log.info({ term, returned: results.length, durationMs: Date.now() - t0 }, "Search complete");
  return results;
}
