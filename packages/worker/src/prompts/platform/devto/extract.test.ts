import { describe, expect, it } from "bun:test";
import { buildDevToExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "find_user_pain",
};

describe("buildDevToExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildDevToExtract({ ctx, posts: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildDevToExtract({ ctx, posts: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels posts", () => {
    const built = buildDevToExtract({ ctx, posts: [{ id: "d1", score: 3, body: "hi", author: null }] });
    expect(built.user).toContain("id=d1");
    expect(built.user).toContain("Twilio");
  });
});
