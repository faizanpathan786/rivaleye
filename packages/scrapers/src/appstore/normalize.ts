import type { NormalizedPost } from "../types";
import type { RawAppStoreApp, RawAppStoreReview, RawAppStoreReviewsFeed } from "./client";

export function normalizeAppStorePayload(
  apps: RawAppStoreApp[],
  reviewsByAppId: Record<string, RawAppStoreReviewsFeed>,
): NormalizedPost[] {
  const out: NormalizedPost[] = [];
  for (const app of apps) {
    const feed = reviewsByAppId[String(app.trackId)];
    const entries = (feed?.feed?.entry ?? []).filter(
      (e): e is RawAppStoreReview => !!e?.["im:rating"],
    );
    out.push(...entries.map((r) => normalizeReview(app, r)));
  }
  return out;
}

function normalizeReview(app: RawAppStoreApp, r: RawAppStoreReview): NormalizedPost {
  const rawRating = parseInt(r["im:rating"].label, 10);
  const rating = Number.isNaN(rawRating) ? 0 : rawRating;
  const rawDate = new Date(r.updated.label);
  const createdAt = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
  const title = r.title.label;
  const content = r.content.label;
  return {
    platform: "appstore",
    externalId: `appstore:${app.trackId}:${r.id.label}`,
    url: app.trackViewUrl,
    author: r.author.name.label || null,
    title,
    body: `${title}\n\n${content}\n\n— ${rating}/5 on ${app.trackName} v${r["im:version"]?.label ?? app.version}`,
    score: rating,
    numComments: null,
    createdAt,
    raw: { app, review: r },
  };
}
