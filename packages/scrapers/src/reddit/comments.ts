import pino from "pino";
import { redditGet } from "./client";
import type { RedditAuthConfig } from "./auth";

const log = pino({ name: "reddit-comments" });

export interface RawRedditComment {
  id: string;
  body: string;
  author: string | null;
  score: number;
  permalink: string;
  created_utc: number;
}

interface CommentListing {
  data: {
    children: Array<{ kind: string; data: RawRedditComment & { replies?: CommentListing | "" } }>;
  };
}

export async function getComments(
  postId: string,
  config: RedditAuthConfig,
  maxComments = 10,
): Promise<RawRedditComment[]> {
  const t0 = Date.now();
  log.debug({ postId, maxComments }, "Fetching comments");
  const [, commentsListing] = await redditGet<[unknown, CommentListing]>(
    `/comments/${postId}`,
    { depth: 2, limit: maxComments },
    config,
  );

  const results: RawRedditComment[] = [];
  for (const child of commentsListing.data.children) {
    if (child.kind !== "t1") continue;
    const c = child.data;
    if (!c.body || c.body === "[deleted]" || c.body === "[removed]") continue;
    if (c.author === "AutoModerator") continue;
    results.push(c);
    if (results.length >= maxComments) break;
  }
  log.debug({ postId, fetched: results.length, durationMs: Date.now() - t0 }, "Comments fetched");
  return results;
}
