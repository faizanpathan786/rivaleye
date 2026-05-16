import type { NormalizedPost } from "../types";
import type { AlgoliaHit } from "./client";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeHackernewsPayload(hits: AlgoliaHit[]): NormalizedPost[] {
  return hits.flatMap((hit) => {
    const isComment = hit.comment_text !== undefined;
    if (isComment) {
      return normalizeComment(hit);
    }
    return normalizeStory(hit);
  });
}

function normalizeStory(hit: AlgoliaHit): NormalizedPost {
  const rawDate = new Date(hit.created_at);
  const createdAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const title = hit.title ?? `HN story ${hit.objectID}`;
  const body = `${title}\n\n${hit.url ?? ""}`.trim();
  const rawScore = hit.points ?? 0;
  const score = Number.isNaN(rawScore) ? 0 : rawScore;
  const rawNumComments = hit.num_comments ?? null;
  const numComments =
    rawNumComments !== null && Number.isNaN(rawNumComments) ? null : rawNumComments;
  return {
    platform: "hackernews",
    externalId: `hackernews:story:${hit.objectID}`,
    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    author: hit.author || null,
    title,
    body,
    score,
    numComments,
    createdAt,
    raw: hit,
  };
}

function normalizeComment(hit: AlgoliaHit): NormalizedPost {
  const rawDate = new Date(hit.created_at);
  const createdAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const storyTitle = hit.story_title ?? "Unknown story";
  const rawBody = hit.comment_text ?? "";
  const body = stripHtml(rawBody);
  return {
    platform: "hackernews",
    externalId: `hackernews:comment:${hit.objectID}`,
    url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    author: hit.author || null,
    title: `Re: ${storyTitle}`,
    body,
    score: null,
    numComments: null,
    createdAt,
    raw: hit,
  };
}
