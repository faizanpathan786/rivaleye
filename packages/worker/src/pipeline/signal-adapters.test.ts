import { describe, expect, it } from "bun:test";
import { emptyStageAExtract, mergeStageAExtracts, toLegacyExtract } from "./signal-adapters";
import type { StageAExtract } from "../prompts/shared";

function signal(over: Partial<StageAExtract["pain_signals"][number]> = {}) {
  return {
    title: "Title",
    summary: "Summary text.",
    sentiment: -0.5,
    strength_or_severity: 0.6,
    evidence_ids: ["e1"],
    representative_quotes: [],
    related_features: [],
    user_segment: null,
    ...over,
  };
}

describe("toLegacyExtract", () => {
  it("maps pain_signals to complaints and gap_signals to features_requested", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      pain_signals: [signal({ summary: "sync breaks", strength_or_severity: 0.9, evidence_ids: ["p1"] })],
      gap_signals: [signal({ title: "recurring tasks", evidence_ids: ["g1"] })],
    };
    const legacy = toLegacyExtract(extract);
    expect(legacy.complaints).toEqual([{ text: "sync breaks", severity: 0.9, evidence_ids: ["p1"] }]);
    expect(legacy.features_requested).toEqual([{ feature: "recurring tasks", evidence_ids: ["g1"] }]);
  });

  it("maps switch_signals using the first non-empty alternative as competitor", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      switch_signals: [
        { ...signal({ title: "leaving" }), direction: "outbound", alternatives_mentioned: ["", "Plivo"] },
      ],
    };
    const legacy = toLegacyExtract(extract);
    expect(legacy.switching_signals[0]).toEqual({
      direction: "outbound",
      competitor: "Plivo",
      evidence_ids: ["e1"],
    });
  });

  it("falls back to the switch signal title when no alternative is named", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      switch_signals: [
        { ...signal({ title: "evaluating options" }), direction: "outbound", alternatives_mentioned: [] },
      ],
    };
    expect(toLegacyExtract(extract).switching_signals[0]?.competitor).toBe("evaluating options");
  });

  it("maps evidence_quotes to notable_quotes", () => {
    const extract: StageAExtract = {
      ...emptyStageAExtract(),
      evidence_quotes: [
        { author: "u/x", text: "great tool", evidence_id: "e9", signal_type: "love", sentiment: 0.8 },
      ],
    };
    expect(toLegacyExtract(extract).notable_quotes).toEqual([
      { author: "u/x", text: "great tool", evidence_id: "e9" },
    ]);
  });

  it("produces a schema-valid legacy extract", async () => {
    const { platformExtractSchema } = await import("../prompts/shared");
    const legacy = toLegacyExtract({
      ...emptyStageAExtract(),
      pain_signals: [signal()],
    });
    expect(() => platformExtractSchema.parse(legacy)).not.toThrow();
  });
});

describe("mergeStageAExtracts", () => {
  it("concatenates every signal group across batches", () => {
    const a: StageAExtract = { ...emptyStageAExtract(), love_signals: [signal({ title: "A" })] };
    const b: StageAExtract = { ...emptyStageAExtract(), love_signals: [signal({ title: "B" })] };
    const merged = mergeStageAExtracts([a, b]);
    expect(merged.love_signals.map((s) => s.title)).toEqual(["A", "B"]);
  });

  it("merges voice_phrases positive and negative", () => {
    const a: StageAExtract = { ...emptyStageAExtract(), voice_phrases: { positive: ["x"], negative: [] } };
    const b: StageAExtract = { ...emptyStageAExtract(), voice_phrases: { positive: [], negative: ["y"] } };
    const merged = mergeStageAExtracts([a, b]);
    expect(merged.voice_phrases).toEqual({ positive: ["x"], negative: ["y"] });
  });

  it("returns an empty extract for an empty input array", () => {
    expect(mergeStageAExtracts([])).toEqual(emptyStageAExtract());
  });
});
