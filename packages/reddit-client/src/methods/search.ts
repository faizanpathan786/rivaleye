import type { RedditHttpClient } from "../client.js";
import type {
  RedditListing,
  RedditPost,
  NormalizedPost,
  SearchOptions,
} from "../types.js";
import { normalizePost } from "../normalize.js";

export async function searchPosts(
  client: RedditHttpClient,
  query: string,
  options: SearchOptions = {},
): Promise<NormalizedPost[]> {
  const { limit = 50, after, sort = "relevance", time = "year" } = options;

  const params: Record<string, string | number> = {
    q: query,
    type: "link",
    sort,
    t: time,
    limit: Math.min(limit, 100),
  };

  if (after) params["after"] = after;

  const data = await client.get<RedditListing<RedditPost>>("/search", params);

  return data.data.children
    .filter((child) => child.kind === "t3" && child.data.author !== "[deleted]")
    .map((child) => normalizePost(child.data));
}
