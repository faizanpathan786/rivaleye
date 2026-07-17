import type { NormalizedPost, PlatformId, ScrapeQuery } from "../types";

/** Deterministic synthetic post generation for the zero-cost verification path. */

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

const LOVE = [
  "Honestly {c} has been a game changer for our team — the {feat} feature alone paid for itself.",
  "Switched to {c} last quarter and the {feat} is incredible, exactly what we needed.",
  "The best thing about {c} is how fast the {feat} is. Never going back.",
  "{c}'s onboarding was the smoothest I've seen; had the whole team on it in a day.",
];
const PAIN = [
  "{c} keeps crashing whenever I open a large {feat}. Support has been unresponsive for weeks.",
  "The pricing on {c} tripled at renewal with zero warning. Feeling burned.",
  "{c} is painfully slow once your {feat} gets big. Constant timeouts.",
  "Data export in {c} is broken and their support just keeps closing my tickets.",
];
const GAP = [
  "I really wish {c} had a proper offline mode — our field team keeps losing work.",
  "{c} still doesn't have {feat} integration, which is a dealbreaker for us.",
  "Why does {c} not support bulk editing yet? Every competitor has it.",
  "If {c} added an API for {feat} we'd upgrade to the enterprise tier tomorrow.",
];
const SWITCH = [
  "We're moving off {c} to a competitor because the {feat} kept breaking on large workspaces.",
  "Evaluating alternatives to {c} — the reliability just isn't there anymore.",
  "Finally migrated away from {c} after the last outage. Much happier now.",
  "Anyone got a good {c} alternative? The pricing changes pushed us out.",
];
const FEATURES = ["sync", "reporting dashboard", "mobile app", "search", "automation", "sharing", "integrations", "editor"];

const CATEGORIES: Array<{ pool: readonly string[]; weight: number }> = [
  { pool: PAIN, weight: 0.4 },
  { pool: LOVE, weight: 0.3 },
  { pool: GAP, weight: 0.2 },
  { pool: SWITCH, weight: 0.1 },
];

function templateFor(rng: Rng): readonly string[] {
  const r = rng();
  let acc = 0;
  for (const { pool, weight } of CATEGORIES) {
    acc += weight;
    if (r <= acc) return pool;
  }
  return PAIN;
}

function authorFor(platform: PlatformId, rng: Rng): string {
  const n = Math.floor(rng() * 90000) + 1000;
  switch (platform) {
    case "reddit":
      return `u/user_${n}`;
    case "twitter":
      return `@user${n}`;
    case "hackernews":
      return `hn_${n}`;
    default:
      return `reviewer_${n}`;
  }
}

function urlFor(platform: PlatformId, externalId: string): string {
  switch (platform) {
    case "reddit":
      return `https://www.reddit.com/r/saas/comments/${externalId}/`;
    case "hackernews":
      return `https://news.ycombinator.com/item?id=${externalId}`;
    case "twitter":
      return `https://twitter.com/i/web/status/${externalId}`;
    case "producthunt":
      return `https://www.producthunt.com/posts/${externalId}`;
    case "appstore":
      return `https://apps.apple.com/review/${externalId}`;
    case "playstore":
      return `https://play.google.com/store/apps/details?reviewId=${externalId}`;
    case "devto":
      return `https://dev.to/p/${externalId}`;
    default:
      return `https://example.com/${platform}/${externalId}`;
  }
}

export function synthesizePosts(
  platform: PlatformId,
  query: ScrapeQuery,
  count = 40,
): NormalizedPost[] {
  const competitor = query.competitor || query.category || "the product";
  const rng = mulberry32(hash32(`${platform}::${competitor}`));
  const n = Math.max(1, Math.min(count, query.limit ?? count));
  const posts: NormalizedPost[] = [];
  for (let i = 0; i < n; i++) {
    const feat = pick(rng, FEATURES);
    const body = pick(rng, templateFor(rng))
      .replaceAll("{c}", competitor)
      .replaceAll("{feat}", feat);
    const externalId = `${platform}_${Math.floor(rng() * 0xffffffff).toString(36)}`;
    const daysAgo = Math.floor(rng() * 60);
    posts.push({
      platform,
      externalId,
      url: urlFor(platform, externalId),
      author: authorFor(platform, rng),
      title: rng() < 0.5 ? `${competitor}: ${feat} feedback` : null,
      body,
      score: Math.floor(rng() * 500),
      numComments: Math.floor(rng() * 80),
      createdAt: new Date(Date.now() - daysAgo * 86_400_000),
      raw: { synthetic: true, platform, competitor, feat },
    });
  }
  return posts;
}
