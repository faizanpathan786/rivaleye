import { describe, expect, it } from "bun:test";
import { synthesizePosts } from "./synthesize";
import { FixtureScraper } from "./fixture-scraper";

const QUERY = { competitor: "Notion", category: "productivity" };

describe("synthesizePosts", () => {
  it("returns posts about the competitor", () => {
    const posts = synthesizePosts("reddit", QUERY, 30);
    expect(posts.length).toBe(30);
    expect(posts.some((p) => p.body.includes("Notion"))).toBe(true);
  });

  it("is deterministic across calls", () => {
    const a = synthesizePosts("reddit", QUERY, 20);
    const b = synthesizePosts("reddit", QUERY, 20);
    expect(a.map((p) => p.externalId)).toEqual(b.map((p) => p.externalId));
    expect(a.map((p) => p.body)).toEqual(b.map((p) => p.body));
  });

  it("produces valid NormalizedPost shape", () => {
    const [post] = synthesizePosts("appstore", QUERY, 1);
    expect(post).toBeDefined();
    expect(typeof post!.externalId).toBe("string");
    expect(typeof post!.url).toBe("string");
    expect(typeof post!.body).toBe("string");
    expect(post!.createdAt instanceof Date).toBe(true);
    expect(post!.platform).toBe("appstore");
  });

  it("differs by platform", () => {
    const reddit = synthesizePosts("reddit", QUERY, 10);
    const hn = synthesizePosts("hackernews", QUERY, 10);
    expect(reddit[0]!.externalId).not.toBe(hn[0]!.externalId);
  });
});

describe("FixtureScraper", () => {
  it("synthesizes when no fixture dir is set", async () => {
    delete process.env.SCRAPER_FIXTURES_DIR;
    process.env.MOCK_SCRAPER_LATENCY_MS = "0";
    const scraper = new FixtureScraper("reddit");
    const posts = await scraper.fetch(QUERY);
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.platform === "reddit")).toBe(true);
  });

  it("respects query.limit", async () => {
    process.env.MOCK_SCRAPER_LATENCY_MS = "0";
    const scraper = new FixtureScraper("reddit");
    const posts = await scraper.fetch({ ...QUERY, limit: 5 });
    expect(posts.length).toBe(5);
  });
});
