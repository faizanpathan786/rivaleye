import type { NormalizedPost } from "../types";
import type { RawPHPost, RawPHComment } from "./client";

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeDate(s: string): Date {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function normalizeProductHuntPayload(posts: RawPHPost[]): NormalizedPost[] {
  const out: NormalizedPost[] = [];
  for (const post of posts) {
    out.push(normalizePost(post));
    for (const comment of post.comments ?? []) {
      out.push(normalizeComment(post, comment));
    }
  }
  return out;
}

function normalizePost(post: RawPHPost): NormalizedPost {
  return {
    platform: "producthunt",
    externalId: `producthunt:post:${post.id}`,
    url: post.url,
    author: post.user.username || null,
    title: post.name,
    body: `${post.tagline}\n\n${post.description ?? ""}`.trim(),
    score: Number.isNaN(post.votesCount) ? null : post.votesCount,
    numComments: Number.isNaN(post.commentsCount) ? null : post.commentsCount,
    createdAt: safeDate(post.createdAt),
    raw: { post },
  };
}

function normalizeComment(post: RawPHPost, comment: RawPHComment): NormalizedPost {
  return {
    platform: "producthunt",
    externalId: `producthunt:comment:${comment.id}`,
    url: comment.url ?? post.url,
    author: comment.user.username || null,
    title: null,
    body: stripHtml(comment.body),
    score: Number.isNaN(comment.votesCount) ? null : comment.votesCount,
    numComments: null,
    createdAt: safeDate(comment.createdAt),
    raw: { comment },
  };
}
