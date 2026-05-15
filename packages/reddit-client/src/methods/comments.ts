import type { RedditHttpClient } from "../client.js";
import type { RedditListing, RedditComment, NormalizedComment } from "../types.js";
import { normalizeComment } from "../normalize.js";

export async function getPostComments(
  client: RedditHttpClient,
  subreddit: string,
  postId: string,
  limit = 100,
): Promise<NormalizedComment[]> {
  // Reddit returns [post_listing, comments_listing]
  const data = await client.get<[unknown, RedditListing<RedditComment>]>(
    `/r/${subreddit}/comments/${postId}`,
    { limit: Math.min(limit, 100), depth: 2 },
  );

  const commentsListing = data[1];

  return commentsListing.data.children
    .filter(
      (child) =>
        child.kind === "t1" &&
        child.data.body &&
        child.data.body !== "[deleted]" &&
        child.data.body !== "[removed]" &&
        child.data.author !== "AutoModerator",
    )
    .map((child) => normalizeComment(child.data, subreddit));
}
