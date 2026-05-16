import type { NormalizedPost } from "../types";
import type { DevToArticle, DevToComment } from "./client";

const MAX_BODY_LENGTH = 5000;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export interface DevToArticleWithComments extends DevToArticle {
  comments?: DevToComment[];
}

export function normalizeDevToPayload(articles: DevToArticleWithComments[]): NormalizedPost[] {
  const out: NormalizedPost[] = [];
  for (const article of articles) {
    out.push(normalizeArticle(article));
    for (const comment of article.comments ?? []) {
      out.push(...normalizeComment(comment, article.url));
    }
  }
  return out;
}

function normalizeArticle(article: DevToArticleWithComments): NormalizedPost {
  const rawDate = new Date(article.published_at);
  const createdAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const rawScore = article.public_reactions_count;
  const score = Number.isNaN(rawScore) ? 0 : rawScore;
  const rawNumComments = article.comments_count;
  const numComments = Number.isNaN(rawNumComments) ? null : rawNumComments;
  const body = `${article.description}\n\n${article.body_markdown ?? ""}`.slice(
    0,
    MAX_BODY_LENGTH,
  );
  return {
    platform: "devto",
    externalId: `devto:article:${article.id}`,
    url: article.url,
    author: article.user.username || null,
    title: article.title,
    body,
    score,
    numComments,
    createdAt,
    raw: article,
  };
}

function normalizeComment(
  comment: DevToComment,
  articleUrl: string,
): NormalizedPost[] {
  const rawDate = new Date(comment.created_at);
  const createdAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const body = stripHtml(comment.body_html);
  const post: NormalizedPost = {
    platform: "devto",
    externalId: `devto:comment:${comment.id_code}`,
    url: articleUrl,
    author: comment.user.username || null,
    title: null,
    body,
    score: null,
    numComments: null,
    createdAt,
    raw: comment,
  };
  const childPosts = comment.children.flatMap((child) => normalizeComment(child, articleUrl));
  return [post, ...childPosts];
}
