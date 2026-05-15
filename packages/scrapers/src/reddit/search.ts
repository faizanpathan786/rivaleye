import { redditGet } from "./client";
import type { RedditAuthConfig } from "./auth";

export interface RawRedditPost {
  id: string;
  name: string;
  title: string;
  selftext: string;
  author: string;
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
  const listing = await redditGet<RedditListing>(
    "/search",
    { q: term, type: "link", sort, t: time, limit },
    config,
  );
  return listing.data.children
    .map((c) => c.data)
    .filter((p) => p.author !== "[deleted]");
}
