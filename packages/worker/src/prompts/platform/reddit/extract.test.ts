import { describe, expect, it } from "bun:test";
import { buildRedditExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "find_user_pain",
};

describe("buildRedditExtract", () => {
  it("returns the Stage A signal schema", () => {
    const built = buildRedditExtract({ ctx, posts: [] });
    expect(built.schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight and lists signal groups", () => {
    const built = buildRedditExtract({ ctx, posts: [] });
    expect(built.system).toContain("EQUAL attention");
    expect(built.system).toContain("love_signals");
  });

  it("user message keeps the relevance filter and competitor", () => {
    const built = buildRedditExtract({ ctx, posts: [{ id: "p1", score: 5, body: "hi", author: null }] });
    expect(built.user).toContain("RELEVANCE FILTER");
    expect(built.user).toContain("Twilio");
    expect(built.user).toContain("id=p1");
  });
});
