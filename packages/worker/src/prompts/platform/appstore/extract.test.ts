import { describe, expect, it } from "bun:test";
import { buildAppStoreExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: null,
  goal: "find_user_pain",
};

describe("buildAppStoreExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildAppStoreExtract({ ctx, reviews: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildAppStoreExtract({ ctx, reviews: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels reviews with rating", () => {
    const built = buildAppStoreExtract({ ctx, reviews: [{ id: "a1", rating: 5, body: "great" }] });
    expect(built.user).toContain("id=a1");
    expect(built.user).toContain("rating=5/5");
  });
});
