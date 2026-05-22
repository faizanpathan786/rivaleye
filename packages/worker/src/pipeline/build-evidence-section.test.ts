import { describe, it, expect } from "bun:test";
import { buildEvidenceSection } from "./build-evidence-section";
import { evidenceSectionSchema } from "../prompts/role-sections/schema";
import type { MergedSignals } from "../prompts/shared";

// Minimal valid MergedSignals fixture — only evidence_index matters for this function.
function makeMergedSignals(overrides: Partial<MergedSignals> = {}): MergedSignals {
  return {
    love_clusters: [],
    pain_clusters: [],
    gap_clusters: [],
    switch_clusters: [],
    pricing_clusters: [],
    feature_clusters: [],
    positioning_clusters: [],
    voice_top: { positive: [], negative: [] },
    cross_platform_themes: [],
    evidence_index: [],
    source_coverage: [],
    clustering_meta: {
      total_input_signals: 0,
      total_output_clusters: 0,
      model: "test",
      generated_at: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("buildEvidenceSection", () => {
  it("returns empty quotes for empty evidence_index", () => {
    const result = buildEvidenceSection(makeMergedSignals());

    expect(result.quotes).toHaveLength(0);
    expect(result.raw_items).toHaveLength(0);
    expect(result.source_links).toHaveLength(0);
    // Must validate without throwing
    evidenceSectionSchema.parse(result);
  });

  it("maps a single evidence_index item to quotes correctly", () => {
    const item = {
      evidence_id: "3f6c2b1a-4d5e-4a7b-8c9d-0e1f2a3b4c5d",
      source: "reddit" as const,
      text: "This product is way too expensive for what it offers.",
      author: "u/some_user",
      source_url: "https://reddit.com/r/saas/comments/abc123",
      source_date: "2024-01-15T10:30:00Z",
      related_signal_ids: ["sig-001"],
      related_cluster_ids: ["cluster-001"],
      sentiment: -0.8,
      confidence: 0.9,
    };

    const result = buildEvidenceSection(makeMergedSignals({ evidence_index: [item] }));

    expect(result.quotes).toHaveLength(1);
    const quote = result.quotes[0]!;

    expect(quote.id).toBe(item.evidence_id);
    expect(quote.quote).toBe(item.text);
    expect(quote.source).toBe(item.source);
    expect(quote.source_url).toBe(item.source_url);
    expect(quote.source_date).toBe(item.source_date);
    expect(quote.author_or_context).toBe(item.author);
    expect(quote.sentiment).toBe(item.sentiment);
    // confidence is converted from a plain number to { score, label, basis }
    expect(quote.confidence.score).toBe(item.confidence);
    expect(["low", "medium", "high"]).toContain(quote.confidence.label);
    expect(quote.related_signal_ids).toEqual(item.related_signal_ids);
  });

  it("output validates against evidenceSectionSchema with one item", () => {
    const item = {
      evidence_id: "3f6c2b1a-4d5e-4a7b-8c9d-0e1f2a3b4c5d",
      source: "reddit" as const,
      text: "Great UI but missing export feature.",
      author: "u/test_user",
      source_url: "https://reddit.com/r/saas/comments/xyz789",
      source_date: "2024-03-20T08:00:00Z",
      related_signal_ids: [],
      related_cluster_ids: [],
      sentiment: 0.2,
      confidence: 0.75,
    };

    const result = buildEvidenceSection(makeMergedSignals({ evidence_index: [item] }));

    // Must not throw
    const parsed = evidenceSectionSchema.parse(result);
    expect(parsed.quotes).toHaveLength(1);
  });

  it("deduplicates source_links by URL", () => {
    const url = "https://reddit.com/r/saas/comments/dup123";
    const items = [
      {
        evidence_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        source: "reddit" as const,
        text: "First quote from this thread.",
        author: "u/user1",
        source_url: url,
        source_date: null,
        related_signal_ids: [],
        related_cluster_ids: [],
        sentiment: 0,
        confidence: 0.5,
      },
      {
        evidence_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        source: "reddit" as const,
        text: "Second quote from the same thread.",
        author: "u/user2",
        source_url: url,
        source_date: null,
        related_signal_ids: [],
        related_cluster_ids: [],
        sentiment: -0.3,
        confidence: 0.6,
      },
    ];

    const result = buildEvidenceSection(makeMergedSignals({ evidence_index: items }));

    expect(result.quotes).toHaveLength(2);
    // Both items have the same source_url — should produce only one source_link
    expect(result.source_links).toHaveLength(1);
    expect(result.source_links[0]!.url).toBe(url);
    evidenceSectionSchema.parse(result);
  });

  it("populates filters_supported with the expected filter keys", () => {
    const result = buildEvidenceSection(makeMergedSignals());
    expect(result.filters_supported).toContain("source");
    expect(result.filters_supported).toContain("signal_type");
    expect(result.filters_supported).toContain("sentiment");
    expect(result.filters_supported).toContain("confidence");
    expect(result.filters_supported).toContain("date");
  });

  it("handles null source_url gracefully (item is mapped, source_links skipped)", () => {
    const item = {
      evidence_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      source: "appstore" as const,
      text: "App crashes on startup.",
      author: null,
      source_url: null,
      source_date: null,
      related_signal_ids: [],
      related_cluster_ids: [],
      sentiment: -1,
      confidence: 0.8,
    };

    const result = buildEvidenceSection(makeMergedSignals({ evidence_index: [item] }));

    expect(result.quotes).toHaveLength(1);
    // null source_url passes through as null — no placeholder injected
    expect(result.quotes[0]!.source_url).toBeNull();
    expect(result.source_links).toHaveLength(0); // null URL → no source_link entry
    evidenceSectionSchema.parse(result);
  });

  it("derives signal_type 'love' for an evidence item linked to a love cluster", () => {
    const loveCluster = {
      id: "cluster-love-001",
      title: "Great onboarding experience",
      summary: "Users praise the onboarding flow.",
      signal_type: "love" as const,
      frequency: 5,
      source_spread: 2,
      platforms: [],
      confidence: 0.9,
      strength_or_severity: 0.8,
      evidence_ids: [],
      representative_quotes: [],
      related_signal_ids: [],
      role_relevance: [],
    };

    const item = {
      evidence_id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
      source: "reddit" as const,
      text: "The onboarding is fantastic!",
      author: "u/happy_user",
      source_url: "https://reddit.com/r/saas/comments/love123",
      source_date: null,
      related_signal_ids: [],
      // related_cluster_ids points to the love cluster
      related_cluster_ids: ["cluster-love-001"],
      sentiment: 0.9,
      confidence: 0.85,
    };

    const result = buildEvidenceSection(
      makeMergedSignals({
        love_clusters: [loveCluster],
        evidence_index: [item],
      }),
    );

    expect(result.quotes).toHaveLength(1);
    // Must resolve to "love", NOT default to "pain"
    expect(result.quotes[0]!.signal_type).toBe("love");
    evidenceSectionSchema.parse(result);
  });

  it("falls back to scanning cluster evidence_ids when related_cluster_ids is empty", () => {
    const gapCluster = {
      id: "cluster-gap-001",
      title: "Missing export feature",
      summary: "Users want an export button.",
      signal_type: "gap" as const,
      frequency: 3,
      source_spread: 1,
      platforms: [],
      confidence: 0.75,
      strength_or_severity: 0.6,
      // evidence_id of our item is listed here
      evidence_ids: ["eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee"],
      representative_quotes: [],
      related_signal_ids: [],
      role_relevance: [],
      workaround: null,
      product_opportunity: null,
    };

    const item = {
      evidence_id: "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
      source: "producthunt" as const,
      text: "I wish there was an export button.",
      author: null,
      source_url: "https://producthunt.com/posts/sometool",
      source_date: null,
      related_signal_ids: [],
      // Empty — forces fallback scan path
      related_cluster_ids: [],
      sentiment: -0.4,
      confidence: 0.7,
    };

    const result = buildEvidenceSection(
      makeMergedSignals({
        gap_clusters: [gapCluster],
        evidence_index: [item],
      }),
    );

    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]!.signal_type).toBe("gap");
    evidenceSectionSchema.parse(result);
  });
});
