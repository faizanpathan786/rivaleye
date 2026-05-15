export interface RedditClientConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  body: string;
  url: string;
  score: number;
  numComments: number;
  createdAt: Date;
}

export interface RedditComment {
  id: string;
  postId: string;
  body: string;
  score: number;
  createdAt: Date;
}

export class RedditClient {
  constructor(_config: RedditClientConfig) {}

  async searchPosts(_query: string): Promise<RedditPost[]> {
    throw new Error("not implemented — port from archive/legacy-v1");
  }

  async fetchComments(_postId: string): Promise<RedditComment[]> {
    throw new Error("not implemented — port from archive/legacy-v1");
  }
}
