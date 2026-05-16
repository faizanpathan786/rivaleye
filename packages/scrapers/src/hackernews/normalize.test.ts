import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/hackernews.json";
import type { AlgoliaHit } from "./client";
import { normalizeHackernewsPayload } from "./normalize";

describe("hackernews normalizer", () => {
  it("converts stories and comments into NormalizedPost[]", () => {
    const hits = [
      ...(fixture.recentStories as AlgoliaHit[]),
      ...(fixture.recentComments as AlgoliaHit[]),
    ];
    const posts = normalizeHackernewsPayload(hits);
    expect(posts.length).toBeGreaterThan(0);
    const first = posts[0]!;
    expect(first.platform).toBe("hackernews");
    expect(first.externalId).toMatch(/^hackernews:(story|comment):.+/);
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.createdAt).toBeInstanceOf(Date);
  });
});
