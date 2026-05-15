import type { RedditPost, RedditComment, NormalizedPost, NormalizedComment } from "./types.js";

export function normalizePost(post: RedditPost): NormalizedPost {
  const content = post.selftext?.trim() || post.title;

  return {
    externalId: `reddit_post_${post.id}`,
    title: post.title,
    content,
    author: post.author,
    subreddit: post.subreddit,
    score: post.score,
    numComments: post.num_comments,
    url: `https://reddit.com${post.permalink}`,
    postedAt: new Date(post.created_utc * 1000),
    postType: "post",
  };
}

export function normalizeComment(
  comment: RedditComment,
  subreddit: string,
): NormalizedComment {
  return {
    externalId: `reddit_comment_${comment.id}`,
    content: comment.body,
    author: comment.author,
    subreddit: comment.subreddit || subreddit,
    score: comment.score,
    numComments: 0,
    url: `https://reddit.com${comment.permalink}`,
    postedAt: new Date(comment.created_utc * 1000),
    postType: "comment",
  };
}
