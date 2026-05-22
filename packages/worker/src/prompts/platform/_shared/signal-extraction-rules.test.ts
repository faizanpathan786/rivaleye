import { describe, expect, it } from "bun:test";
import { buildSignalSystemPrompt } from "./signal-extraction-rules";

describe("buildSignalSystemPrompt", () => {
  const prompt = buildSignalSystemPrompt("Reddit posts and comment threads");

  it("interpolates the source noun", () => {
    expect(prompt).toContain("Reddit posts and comment threads");
  });

  it("requires every signal group key", () => {
    for (const key of [
      "love_signals",
      "pain_signals",
      "gap_signals",
      "switch_signals",
      "pricing_signals",
      "feature_signals",
      "positioning_signals",
      "voice_phrases",
      "evidence_quotes",
    ]) {
      expect(prompt).toContain(key);
    }
  });

  it("instructs equal weight for love and pain", () => {
    expect(prompt).toContain("EQUAL attention");
  });

  it("forbids markdown fences", () => {
    expect(prompt).toContain("No prose, no markdown fences");
  });
});
