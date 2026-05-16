import type { NormalizedPost } from "../types";
import type { RawAppStoreApp, RawAppStoreReview, RawAppStoreReviewsFeed } from "./client";

export function normalizeAppStorePayload(
  apps: unknown[],
  reviewsByAppId: Record<string, unknown>,
): NormalizedPost[] {
  const out: NormalizedPost[] = [];
  for (const app of apps) {
    const a = app as RawAppStoreApp;
    const feed = (reviewsByAppId[String(a.trackId)] ?? reviewsByAppId["app"]) as RawAppStoreReviewsFeed | undefined;
    const entries = (feed?.feed?.entry ?? []).filter(
      (e): e is RawAppStoreReview => !!e?.["im:rating"],
    );
    out.push(...entries.map((r) => normalizeReview(a, r)));
  }
  return out;
}

function normalizeReview(app: RawAppStoreApp, r: RawAppStoreReview): NormalizedPost {
  const rating = parseInt(r["im:rating"].label, 10);
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
    createdAt: new Date(r.updated.label),
    raw: { app, review: r },
  };
}
