// ─── Reddit API Response Types ────────────────────────────────────────────────

export interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  created_utc: number;
  is_self: boolean;
}

export interface RedditComment {
  id: string;
  body: string;
  author: string;
  subreddit: string;
  score: number;
  permalink: string;
  created_utc: number;
  link_id: string;
}

export interface RedditListing<T> {
  kind: "Listing";
  data: {
    after: string | null;
    before: string | null;
    children: Array<{ kind: string; data: T }>;
    dist: number;
  };
}

export interface RedditSubredditInfo {
  id: string;
  display_name: string;
  subscribers: number;
  public_description: string;
  title: string;
}

// ─── Normalized Types (what the client returns) ───────────────────────────────

export interface NormalizedPost {
  externalId: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  postedAt: Date;
  postType: "post";
}

export interface NormalizedComment {
  externalId: string;
  content: string;
  author: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  postedAt: Date;
  postType: "comment";
}

export type NormalizedMention = NormalizedPost | NormalizedComment;

export interface SubredditInfo {
  name: string;
  subscribers: number;
  description: string;
  title: string;
}

export interface SearchOptions {
  limit?: number;
  after?: string;
  sort?: "relevance" | "hot" | "top" | "new" | "comments";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
}

export interface SubredditPostOptions {
  sort?: "hot" | "new" | "top" | "rising";
  limit?: number;
  after?: string;
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
}
