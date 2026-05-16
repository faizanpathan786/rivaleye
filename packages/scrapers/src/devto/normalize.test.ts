import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/devto.json";
import type { DevToArticleWithComments } from "./normalize";
import { normalizeDevToPayload } from "./normalize";

describe("devto normalizer", () => {
  it("converts articles and comments into NormalizedPost[]", () => {
    const articles = fixture.articles as DevToArticleWithComments[];
    const posts = normalizeDevToPayload(articles);
    expect(posts.length).toBeGreaterThan(0);
    const first = posts[0]!;
    expect(first.platform).toBe("devto");
    expect(first.externalId).toMatch(/^devto:(article|comment):.+/);
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.createdAt).toBeInstanceOf(Date);
  });
});
