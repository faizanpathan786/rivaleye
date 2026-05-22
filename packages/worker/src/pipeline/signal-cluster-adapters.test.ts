import { describe, expect, it } from "bun:test";
import { enrichMergedSignals, toLegacyMergedClusters } from "./signal-cluster-adapters";
import { mergedClustersSchema } from "../prompts/shared";
import type { StageCMergeLlmOutput, EvidenceIndexItem } from "../prompts/shared";

const emptyLlm: StageCMergeLlmOutput = {
  love_clusters: [], pain_clusters: [], gap_clusters: [], switch_clusters: [],
  pricing_clusters: [], feature_clusters: [], positioning_clusters: [],
  voice_top: { positive: [], negative: [] }, cross_platform_themes: [],
};

function painCluster(over: Record<string, unknown> = {}) {
  return {
    id: "pain-x", title: "Sync breaks", summary: "Sync fails daily.",
    signal_type: "pain" as const, frequency: 0, source_spread: 0, platforms: [],
    confidence: 0, strength_or_severity: 0.8, evidence_ids: ["reddit:1", "appstore:9"],
    representative_quotes: [{ author: "u/x", text: "sync broke again", evidence_id: "reddit:1" }],
    related_signal_ids: [], role_relevance: ["product" as const],
    affected_segment: null, opportunity_implication: null, ...over,
  };
}

describe("enrichMergedSignals", () => {
  const evidencePlatform = new Map<string, "reddit" | "appstore">([
    ["reddit:1", "reddit"], ["appstore:9", "appstore"],
  ]);
  const evidenceIndex: EvidenceIndexItem[] = [];

  it("recomputes frequency, source_spread and platforms from evidence_ids", () => {
    const llm: StageCMergeLlmOutput = { ...emptyLlm, pain_clusters: [painCluster()] };
    const merged = enrichMergedSignals(llm, {
      evidencePlatform, evidenceIndex, totalInputSignals: 2, model: "m",
    });
    const c = merged.pain_clusters[0]!;
    expect(c.frequency).toBe(2);
    expect(c.source_spread).toBe(2);
    expect(c.platforms.sort()).toEqual(["appstore", "reddit"]);
    expect(c.confidence).toBeGreaterThan(0);
  });

  it("fills evidence_index, source_coverage and clustering_meta", () => {
    const llm: StageCMergeLlmOutput = { ...emptyLlm, pain_clusters: [painCluster()] };
    const merged = enrichMergedSignals(llm, {
      evidencePlatform,
      evidenceIndex: [{
        evidence_id: "reddit:1", source: "reddit", text: "sync broke", author: null,
        source_url: null, source_date: null, related_signal_ids: [], related_cluster_ids: [],
        sentiment: null, confidence: 0,
      }],
      totalInputSignals: 2, model: "m",
    });
    expect(merged.evidence_index.length).toBe(1);
    expect(merged.clustering_meta.total_output_clusters).toBe(1);
    expect(merged.clustering_meta.model).toBe("m");
  });
});

describe("toLegacyMergedClusters", () => {
  it("maps pain_clusters to complaint_clusters and gap_clusters to feature_clusters", () => {
    const merged = enrichMergedSignals(
      {
        ...emptyLlm,
        pain_clusters: [painCluster()],
        gap_clusters: [{
          id: "gap-recurring", title: "Recurring tasks", summary: "Users want recurring tasks.",
          signal_type: "gap", frequency: 0, source_spread: 0, platforms: [], confidence: 0,
          strength_or_severity: 0.6, evidence_ids: ["reddit:1"], representative_quotes: [],
          related_signal_ids: [], role_relevance: ["product"], workaround: null, product_opportunity: null,
        }],
      },
      { evidencePlatform: new Map([["reddit:1", "reddit"], ["appstore:9", "appstore"]]),
        evidenceIndex: [], totalInputSignals: 3, model: "m" },
    );
    const legacy = toLegacyMergedClusters(merged);
    expect(legacy.complaint_clusters[0]?.title).toBe("Sync breaks");
    expect(legacy.complaint_clusters[0]?.severity).toBe(0.8);
    expect(legacy.complaint_clusters[0]?.sample_quote).toBe("sync broke again");
    expect(legacy.feature_clusters[0]?.feature).toBe("Recurring tasks");
  });

  it("produces a schema-valid legacy MergedClusters", () => {
    const merged = enrichMergedSignals(
      { ...emptyLlm, pain_clusters: [painCluster()] },
      { evidencePlatform: new Map([["reddit:1", "reddit"], ["appstore:9", "appstore"]]),
        evidenceIndex: [], totalInputSignals: 2, model: "m" },
    );
    expect(() => mergedClustersSchema.parse(toLegacyMergedClusters(merged))).not.toThrow();
  });

  it("switching_clusters share sums to ~1 across switch clusters", () => {
    const sw = (id: string, ev: string[]) => ({
      id, title: id, summary: "s", signal_type: "switch" as const, frequency: 0, source_spread: 0,
      platforms: [], confidence: 0, strength_or_severity: 0.5, evidence_ids: ev,
      representative_quotes: [], related_signal_ids: [], role_relevance: ["growth" as const],
      direction: "outbound" as const, competitor: "Plivo", alternatives: ["Plivo"], urgency: "low" as const,
    });
    const merged = enrichMergedSignals(
      { ...emptyLlm, switch_clusters: [sw("a", ["reddit:1"]), sw("b", ["appstore:9"])] },
      { evidencePlatform: new Map([["reddit:1", "reddit"], ["appstore:9", "appstore"]]),
        evidenceIndex: [], totalInputSignals: 2, model: "m" },
    );
    const legacy = toLegacyMergedClusters(merged);
    const total = legacy.switching_clusters.reduce((s, c) => s + c.share, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("handles an empty merged-signals object", () => {
    const merged = enrichMergedSignals(emptyLlm, {
      evidencePlatform: new Map(), evidenceIndex: [], totalInputSignals: 0, model: "m",
    });
    const legacy = toLegacyMergedClusters(merged);
    expect(legacy.complaint_clusters).toEqual([]);
    expect(() => mergedClustersSchema.parse(legacy)).not.toThrow();
  });
});
