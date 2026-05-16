import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/producthunt.json";
import type { RawPHPost } from "./client";
import { normalizeProductHuntPayload } from "./normalize";

describe("producthunt normalizer", () => {
  it("converts posts + comments into NormalizedPost[]", () => {
    const posts = (fixture as { posts: RawPHPost[] }).posts;
    const results = normalizeProductHuntPayload(posts);
    expect(results.length).toBeGreaterThan(0);

    const postEntry = results.find((r) => r.externalId.startsWith("producthunt:post:"));
    expect(postEntry).toBeDefined();
    expect(postEntry!.platform).toBe("producthunt");
    expect(postEntry!.title).toBe("Notion Developer Platform");
    expect(postEntry!.createdAt).toBeInstanceOf(Date);

    const commentEntry = results.find((r) => r.externalId.startsWith("producthunt:comment:"));
    expect(commentEntry).toBeDefined();
    expect(commentEntry!.title).toBeNull();
    expect(commentEntry!.body.length).toBeGreaterThan(0);
  });
});
