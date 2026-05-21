import type { NormalizedPost } from "../types";
import type { RawRedditPost } from "./search";
import type { RawRedditComment } from "./comments";

export function normalizePost(
  post: RawRedditPost,
  comments: RawRedditComment[],
): NormalizedPost {
  const commentText = comments
    .slice(0, 10)
    .map((c) => c.body)
    .join("\n\n---\n\n");

  const body = [post.selftext, commentText].filter(Boolean).join("\n\n---\n\n");

  return {
    platform: "reddit",
    externalId: `reddit:${post.id}`,
    url: `https://www.reddit.com${post.permalink}`,
    author: post.author === "[deleted]" ? null : post.author,
    title: post.title || null,
    body: body || post.title,
    score: post.score,
    numComments: post.num_comments,
    createdAt: new Date(post.created_utc * 1000),
    raw: { post, comments },
  };
}
