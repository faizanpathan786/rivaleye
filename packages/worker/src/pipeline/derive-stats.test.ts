import { describe, expect, it } from "bun:test";
import { computePlatformStats, computeSubredditStats } from "./derive-stats";
import type { MentionLike } from "./derive-stats";

const mention = (platform: string, subreddit?: string): MentionLike => ({
  platform,
  raw: subreddit ? { subreddit } : {},
});

describe("computePlatformStats", () => {
  it("returns counts sorted by count desc with human-readable labels", () => {
    const mentions: MentionLike[] = [
      mention("reddit"),
      mention("reddit"),
      mention("reddit"),
      mention("g2"),
      mention("g2"),
      mention("appstore"),
    ];

    const result = computePlatformStats(mentions);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ platform: "reddit", label: "Reddit", count: 3 });
    expect(result[1]).toEqual({ platform: "g2", label: "G2", count: 2 });
    expect(result[2]).toEqual({ platform: "appstore", label: "App Store", count: 1 });
  });

  it("returns empty array for empty input", () => {
    expect(computePlatformStats([])).toEqual([]);
  });
});

describe("computeSubredditStats", () => {
  it("filters to reddit-only mentions and extracts raw.subreddit, sorted by count desc", () => {
    const mentions: MentionLike[] = [
      mention("reddit", "r/entrepreneur"),
      mention("reddit", "r/entrepreneur"),
      mention("reddit", "r/startups"),
      mention("g2"),
      mention("appstore"),
    ];

    const result = computeSubredditStats(mentions);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ subreddit: "r/entrepreneur", count: 2 });
    mention("reddit", "r/startups");
    expect(result[1]).toEqual({ subreddit: "r/startups", count: 1 });
  });

  it("skips reddit mentions without a subreddit field", () => {
    const mentions: MentionLike[] = [
      mention("reddit"),
      mention("reddit", "r/saas"),
    ];

    const result = computeSubredditStats(mentions);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ subreddit: "r/saas", count: 1 });
  });

  it("returns empty array when no reddit mentions", () => {
    expect(computeSubredditStats([mention("g2"), mention("appstore")])).toEqual([]);
  });
});
