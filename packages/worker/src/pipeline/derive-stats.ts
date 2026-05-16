export interface MentionLike {
  platform: string;
  raw: unknown;
}

export const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  capterra: "Capterra",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  producthunt: "Product Hunt",
  appstore: "App Store",
  playstore: "Play Store",
  gmaps: "Google Maps",
  hackernews: "Hacker News",
  devto: "DEV.to",
};

export interface PlatformStatRow {
  platform: string;
  label: string;
  count: number;
}

export function computePlatformStats(mentions: MentionLike[]): PlatformStatRow[] {
  const counts = new Map<string, number>();
  for (const m of mentions) {
    counts.set(m.platform, (counts.get(m.platform) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([platform, count]) => ({
      platform,
      label: PLATFORM_LABELS[platform] ?? platform,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface SubredditRow {
  subreddit: string;
  count: number;
}

export function computeSubredditStats(mentions: MentionLike[]): SubredditRow[] {
  const counts = new Map<string, number>();
  for (const m of mentions) {
    if (m.platform !== "reddit") continue;
    const sub = readSubreddit(m.raw);
    if (sub === null) continue;
    counts.set(sub, (counts.get(sub) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([subreddit, count]) => ({ subreddit, count }))
    .sort((a, b) => b.count - a.count);
}

function readSubreddit(raw: unknown): string | null {
  if (
    raw !== null &&
    typeof raw === "object" &&
    "subreddit" in raw &&
    typeof (raw as Record<string, unknown>)["subreddit"] === "string"
  ) {
    return (raw as Record<string, string>)["subreddit"] ?? null;
  }
  return null;
}
