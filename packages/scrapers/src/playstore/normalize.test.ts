import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/playstore.json";
import type { RawPlayStoreApp, RawPlayStoreReview } from "./client";
import { normalizePlayStorePayload } from "./normalize";

describe("playstore normalizer", () => {
  it("converts an app + its reviews into NormalizedPost[]", () => {
    const appEntry = (
      fixture as unknown as {
        apps: Array<{ metadata: RawPlayStoreApp; reviews: RawPlayStoreReview[] }>;
      }
    ).apps[0]!;
    const posts = normalizePlayStorePayload(
      [appEntry.metadata],
      { [appEntry.metadata.appId]: appEntry.reviews },
    );
    expect(posts.length).toBeGreaterThan(0);
    const first = posts[0]!;
    expect(first.platform).toBe("playstore");
    expect(first.externalId).toMatch(/^playstore:.+:.+/);
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.createdAt).toBeInstanceOf(Date);
  });
});
