import { describe, expect, it } from "bun:test";
import { buildPlayStoreExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: null,
  goal: "find_user_pain",
};

describe("buildPlayStoreExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildPlayStoreExtract({ ctx, reviews: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildPlayStoreExtract({ ctx, reviews: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels reviews with rating", () => {
    const built = buildPlayStoreExtract({ ctx, reviews: [{ id: "g1", rating: 4, body: "ok", author: null }] });
    expect(built.user).toContain("id=g1");
    expect(built.user).toContain("rating=4/5");
  });
});
