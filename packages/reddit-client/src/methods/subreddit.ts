import type { RedditHttpClient } from "../client.js";
import type {
  RedditListing,
  RedditPost,
  RedditSubredditInfo,
  NormalizedPost,
  SubredditPostOptions,
  SubredditInfo,
} from "../types.js";
import { normalizePost } from "../normalize.js";

export async function getSubredditPosts(
  client: RedditHttpClient,
  subreddit: string,
  options: SubredditPostOptions = {},
): Promise<NormalizedPost[]> {
  const { sort = "hot", limit = 100, after, time = "year" } = options;

  const params: Record<string, string | number> = {
    limit: Math.min(limit, 100),
  };

  if (after) params["after"] = after;
  if (sort === "top") params["t"] = time;

  const data = await client.get<RedditListing<RedditPost>>(
    `/r/${subreddit}/${sort}`,
    params,
  );

  return data.data.children
    .filter((child) => child.kind === "t3" && child.data.author !== "[deleted]")
    .map((child) => normalizePost(child.data));
}

export async function getSubredditInfo(
  client: RedditHttpClient,
  subreddit: string,
): Promise<SubredditInfo> {
  const data = await client.get<{ kind: string; data: RedditSubredditInfo }>(
    `/r/${subreddit}/about`,
  );

  return {
    name: data.data.display_name,
    subscribers: data.data.subscribers,
    description: data.data.public_description,
    title: data.data.title,
  };
}
