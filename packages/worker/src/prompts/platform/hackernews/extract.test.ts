import { describe, expect, it } from "bun:test";
import { buildHackerNewsExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "find_user_pain",
};

describe("buildHackerNewsExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildHackerNewsExtract({ ctx, posts: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildHackerNewsExtract({ ctx, posts: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels posts", () => {
    const built = buildHackerNewsExtract({ ctx, posts: [{ id: "h1", score: 10, body: "hi", author: null }] });
    expect(built.user).toContain("id=h1");
    expect(built.user).toContain("Twilio");
  });
});
