import type { NormalizedPost } from "../types";
import type { RawPlayStoreApp, RawPlayStoreReview } from "./client";

export function normalizePlayStorePayload(
  apps: RawPlayStoreApp[],
  reviewsByAppId: Record<string, RawPlayStoreReview[]>,
): NormalizedPost[] {
  const out: NormalizedPost[] = [];
  for (const app of apps) {
    const reviews = reviewsByAppId[app.appId] ?? [];
    out.push(...reviews.map((r) => normalizeReview(app, r)));
  }
  return out;
}

function normalizeReview(app: RawPlayStoreApp, r: RawPlayStoreReview): NormalizedPost {
  const rawRating = r.score;
  const rating = Number.isNaN(rawRating) ? 0 : rawRating;
  const rawDate = new Date(r.date);
  const createdAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  return {
    platform: "playstore",
    externalId: `playstore:${app.appId}:${r.id}`,
    url: app.url,
    author: r.userName ?? null,
    title: null,
    body: `${r.text}\n\n— ${rating}/5 on ${app.title}`,
    score: rating,
    numComments: null,
    createdAt,
    raw: { app, review: r },
  };
}
