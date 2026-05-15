import { RedditAuth } from "./auth.js";
import { RedditHttpClient } from "./client.js";
import { RateLimiter } from "./rate-limiter.js";
import { searchPosts } from "./methods/search.js";
import { getSubredditPosts, getSubredditInfo } from "./methods/subreddit.js";
import { getPostComments } from "./methods/comments.js";
import type { SearchOptions, SubredditPostOptions } from "./types.js";

export class RedditClient {
  private readonly httpClient: RedditHttpClient;
  private readonly rateLimiter: RateLimiter;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    userAgent: string;
  }) {
    const auth = new RedditAuth(config.clientId, config.clientSecret, config.userAgent);
    this.rateLimiter = new RateLimiter();
    this.httpClient = new RedditHttpClient(auth, config.userAgent, this.rateLimiter);
  }

  searchPosts(query: string, options?: SearchOptions) {
    return searchPosts(this.httpClient, query, options);
  }

  getSubredditPosts(subreddit: string, options?: SubredditPostOptions) {
    return getSubredditPosts(this.httpClient, subreddit, options);
  }

  getSubredditInfo(subreddit: string) {
    return getSubredditInfo(this.httpClient, subreddit);
  }

  getPostComments(subreddit: string, postId: string, limit?: number) {
    return getPostComments(this.httpClient, subreddit, postId, limit);
  }

  /** Start the rate limiter drain loop (call once at app startup) */
  start(): NodeJS.Timeout {
    return this.rateLimiter.startDrainLoop();
  }
}

export type { SearchOptions, SubredditPostOptions };
export type { NormalizedPost, NormalizedComment, NormalizedMention, SubredditInfo } from "./types.js";
