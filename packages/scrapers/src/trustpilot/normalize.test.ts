import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/trustpilot.json";
import type { RawTrustpilotBusiness, RawTrustpilotReview } from "./client";
import { normalizeTrustpilotPayload } from "./normalize";

describe("trustpilot normalizer", () => {
  it("converts business + reviews into NormalizedPost[]", () => {
    const { business, reviews } = fixture as {
      business: RawTrustpilotBusiness;
      reviews: RawTrustpilotReview[];
    };
    const results = normalizeTrustpilotPayload(business, reviews);
    expect(results.length).toBe(2);

    const first = results[0]!;
    expect(first.platform).toBe("trustpilot");
    expect(first.externalId).toMatch(/^trustpilot:/);
    expect(first.score).toBe(5);
    expect(first.body).toContain("5/5 by Alice Johnson");
    expect(first.createdAt).toBeInstanceOf(Date);

    const second = results[1]!;
    expect(second.score).toBe(2);
  });
});
