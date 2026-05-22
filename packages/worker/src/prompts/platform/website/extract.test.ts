import { describe, expect, it } from "bun:test";
import { buildWebsiteExtract } from "./extract";
import { stageAExtractSchema } from "../../shared";

const ctx = {
  reportId: "r1",
  competitor: "Twilio",
  category: "Messaging",
  audience: null,
  goal: "improve_positioning",
};

describe("buildWebsiteExtract", () => {
  it("returns the Stage A signal schema", () => {
    expect(buildWebsiteExtract({ ctx, pages: [] }).schema).toBe(stageAExtractSchema);
  });

  it("system prompt lists the signal groups and is website-specific", () => {
    const sys = buildWebsiteExtract({ ctx, pages: [] }).system;
    expect(sys).toContain("love_signals");
    expect(sys).toContain("feature_signals");
    expect(sys).toContain("marketing website");
  });

  it("user message id-labels pages with url", () => {
    const built = buildWebsiteExtract({ ctx, pages: [{ id: "w1", url: "https://x.com/pricing", body: "Plans" }] });
    expect(built.user).toContain("id=w1");
    expect(built.user).toContain("https://x.com/pricing");
  });
});
