import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/appstore.json";
import type { RawAppStoreApp, RawAppStoreReviewsFeed } from "./client";
import { normalizeAppStorePayload } from "./normalize";

describe("appstore normalizer", () => {
  it("converts an app + its reviews into NormalizedPost[]", () => {
    const app = (fixture as { search: { results: RawAppStoreApp[] } }).search.results[0]!;
    const reviews = (fixture as { reviews: RawAppStoreReviewsFeed }).reviews;
    const posts = normalizeAppStorePayload([app], { [String(app.trackId)]: reviews });
    expect(posts.length).toBeGreaterThan(0);
    const first = posts[0]!;
    expect(first.platform).toBe("appstore");
    expect(first.externalId).toMatch(/^appstore:.+:.+/);
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.createdAt).toBeInstanceOf(Date);
  });
});
