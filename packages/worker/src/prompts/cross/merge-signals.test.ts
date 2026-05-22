import { describe, expect, it } from "bun:test";
import { buildSignalMerge } from "./merge-signals";
import { stageCMergeLlmSchema } from "../shared";
import { emptyStageAExtract } from "../../pipeline/signal-adapters";

const ctx = {
  reportId: "r1", competitor: "Twilio", category: "Messaging",
  audience: null, goal: "find_user_pain",
};

describe("buildSignalMerge", () => {
  it("returns the lean Stage C LLM schema", () => {
    const built = buildSignalMerge({ ctx, briefs: [], signalExtracts: [] });
    expect(built.schema).toBe(stageCMergeLlmSchema);
  });

  it("system prompt requires all seven cluster types and forbids the complaint cap", () => {
    const built = buildSignalMerge({ ctx, briefs: [], signalExtracts: [] });
    for (const k of [
      "love_clusters", "pain_clusters", "gap_clusters", "switch_clusters",
      "pricing_clusters", "feature_clusters", "positioning_clusters",
    ]) {
      expect(built.system).toContain(k);
    }
    expect(built.system).toContain("love and pain EQUAL");
  });

  it("user message includes the competitor and the per-platform signal extracts", () => {
    const built = buildSignalMerge({
      ctx,
      briefs: [],
      signalExtracts: [{ platform: "reddit", extract: emptyStageAExtract() }],
    });
    expect(built.user).toContain("Twilio");
    expect(built.user).toContain("reddit");
  });
});
