import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/reddit.json";
import type { RawRedditPost } from "./search";
import type { RawRedditComment } from "./comments";
import { normalizePost } from "./normalize";

describe("reddit normalizer", () => {
  it("converts a post + comments into a NormalizedPost", () => {
    const post = (fixture as { posts: RawRedditPost[] }).posts[0]!;
    const comments = (fixture as { comments: RawRedditComment[] }).comments;
    const result = normalizePost(post, comments);

    expect(result.platform).toBe("reddit");
    expect(result.externalId).toMatch(/^reddit:.+/);
    expect(result.externalId).toBe(`reddit:${post.id}`);
    expect(result.url).toBe(`https://www.reddit.com${post.permalink}`);
    expect(result.author).toBe(post.author);
    expect(result.title).toBe(post.title);
    expect(result.body.length).toBeGreaterThan(0);
    expect(result.score).toBe(post.score);
    expect(result.numComments).toBe(post.num_comments);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.getTime()).toBe(post.created_utc * 1000);
  });

  it("sets author to null when post author is [deleted]", () => {
    const post = (fixture as { posts: RawRedditPost[] }).posts[0]!;
    const deletedPost: RawRedditPost = { ...post, author: "[deleted]" };
    const result = normalizePost(deletedPost, []);
    expect(result.author).toBeNull();
  });

  it("falls back to title when selftext and comments are empty", () => {
    const post = (fixture as { posts: RawRedditPost[] }).posts[0]!;
    const noBodyPost: RawRedditPost = { ...post, selftext: "" };
    const result = normalizePost(noBodyPost, []);
    expect(result.body).toBe(post.title);
  });

  it("includes comment bodies in post body", () => {
    const post = (fixture as { posts: RawRedditPost[] }).posts[0]!;
    const comments = (fixture as { comments: RawRedditComment[] }).comments;
    const result = normalizePost(post, comments);
    expect(result.body).toContain(comments[0]!.body);
  });
});
