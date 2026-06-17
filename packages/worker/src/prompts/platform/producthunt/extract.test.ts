import { describe, expect, it } from "bun:test";
import { buildProductHuntExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Notion",
  category: "productivity",
  audience: null,
  goal: "find_user_pain",
};

describe("buildProductHuntExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildProductHuntExtract({ ctx, reviews: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt gives love equal weight", () => {
    expect(buildProductHuntExtract({ ctx, reviews: [] }).system).toContain("EQUAL attention");
  });

  it("user message id-labels items with votes", () => {
    const built = buildProductHuntExtract({ ctx, reviews: [{ id: "ph1", rating: 12, body: "nice", author: null }] });
    expect(built.user).toContain("id=ph1");
    expect(built.user).toContain("votes=12");
  });
});
