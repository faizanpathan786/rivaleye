import { describe, expect, it } from "bun:test";
import fixture from "../__fixtures__/medium.json";
import type { RawMediumItem } from "./client";
import { normalizeMediumPayload } from "./normalize";

describe("medium normalizer", () => {
  it("converts RSS items into NormalizedPost[]", () => {
    const items = (fixture as { items: RawMediumItem[] }).items;
    const results = normalizeMediumPayload(items);
    expect(results.length).toBe(2);

    const first = results[0]!;
    expect(first.platform).toBe("medium");
    expect(first.externalId).toMatch(/^medium:/);
    expect(first.title).toBeTruthy();
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.author).toBe("Sai koushik");
    expect(first.score).toBeNull();
    expect(first.createdAt).toBeInstanceOf(Date);
  });
});
