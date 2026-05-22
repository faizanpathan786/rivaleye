import type { PlatformId } from "@rivaleye/scrapers";
import type {
  EvidenceIndexItem, MergedClusters, MergedSignals, SignalClusterBase, StageCMergeLlmOutput,
} from "../prompts/shared";

export interface EnrichContext {
  /** evidence_id → platform it came from. */
  evidencePlatform: Map<string, PlatformId>;
  /** the pre-built evidence index (see buildEvidenceIndex). */
  evidenceIndex: EvidenceIndexItem[];
  /** total raw signals fed into Stage C (for clustering_meta). */
  totalInputSignals: number;
  model: string;
}

/** Confidence: more evidence and wider platform spread => higher confidence. */
function clusterConfidence(frequency: number, sourceSpread: number): number {
  const freqScore = Math.min(frequency / 8, 1);     // 8+ mentions => full
  const spreadScore = Math.min(sourceSpread / 3, 1); // 3+ platforms => full
  return Math.round((freqScore * 0.6 + spreadScore * 0.4) * 100) / 100;
}

function withStats<T extends SignalClusterBase>(cluster: T, evidencePlatform: Map<string, PlatformId>): T {
  const platforms = [
    ...new Set(
      cluster.evidence_ids
        .map((id) => evidencePlatform.get(id))
        .filter((p): p is PlatformId => p !== undefined),
    ),
  ];
  const frequency = cluster.evidence_ids.length;
  const source_spread = platforms.length;
  return {
    ...cluster,
    frequency,
    source_spread,
    platforms,
    confidence: clusterConfidence(frequency, source_spread),
  };
}

/** Enrich the lean LLM output into the full MergedSignals: recompute per-cluster
 *  stats in code, attach the evidence index, source coverage and meta. */
export function enrichMergedSignals(
  llm: StageCMergeLlmOutput,
  ctx: EnrichContext,
): MergedSignals {
  const ep = ctx.evidencePlatform;
  const love_clusters = llm.love_clusters.map((c) => withStats(c, ep));
  const pain_clusters = llm.pain_clusters.map((c) => withStats(c, ep));
  const gap_clusters = llm.gap_clusters.map((c) => withStats(c, ep));
  const switch_clusters = llm.switch_clusters.map((c) => withStats(c, ep));
  const pricing_clusters = llm.pricing_clusters.map((c) => withStats(c, ep));
  const feature_clusters = llm.feature_clusters.map((c) => withStats(c, ep));
  const positioning_clusters = llm.positioning_clusters.map((c) => withStats(c, ep));

  const totalClusters =
    love_clusters.length + pain_clusters.length + gap_clusters.length +
    switch_clusters.length + pricing_clusters.length + feature_clusters.length +
    positioning_clusters.length;

  const source_coverage = computeSourceCoverage(ep);

  return {
    love_clusters,
    pain_clusters,
    gap_clusters,
    switch_clusters,
    pricing_clusters,
    feature_clusters,
    positioning_clusters,
    voice_top: llm.voice_top,
    cross_platform_themes: llm.cross_platform_themes,
    evidence_index: ctx.evidenceIndex,
    source_coverage,
    clustering_meta: {
      total_input_signals: ctx.totalInputSignals,
      total_output_clusters: totalClusters,
      model: ctx.model,
      generated_at: new Date().toISOString(),
    },
  };
}

export function computeSourceCoverage(
  evidencePlatform: Map<string, PlatformId>,
): MergedSignals["source_coverage"] {
  const counts = new Map<PlatformId, number>();
  for (const platform of evidencePlatform.values()) {
    counts.set(platform, (counts.get(platform) ?? 0) + 1);
  }
  return [...counts.entries()].map(([platform, signal_count]) => ({
    platform: platform as MergedSignals["source_coverage"][number]["platform"],
    signal_count,
    contributed: signal_count > 0,
  }));
}

/** Derive the legacy MergedClusters so Stage D/E keep working unchanged. */
export function toLegacyMergedClusters(m: MergedSignals): MergedClusters {
  const switchTotal = m.switch_clusters.reduce((s, c) => s + c.frequency, 0);
  return {
    complaint_clusters: m.pain_clusters.map((c) => ({
      title: c.title,
      summary: c.summary,
      severity: c.strength_or_severity,
      platforms: c.platforms,
      evidence_ids: c.evidence_ids,
      sample_quote: c.representative_quotes[0]?.text ?? null,
    })),
    feature_clusters: m.gap_clusters.map((c) => ({
      feature: c.title,
      demand_score: c.strength_or_severity,
      platforms: c.platforms,
      evidence_ids: c.evidence_ids,
    })),
    pricing_clusters: m.pricing_clusters.map((c) => ({
      tier_label: c.tier_label ?? "General",
      pain: c.strength_or_severity,
      note: c.summary,
      platforms: c.platforms,
      sample_quotes: c.representative_quotes.map((q) => ({ who: q.author, text: q.text })),
    })),
    switching_clusters: m.switch_clusters.map((c) => ({
      direction: c.direction,
      competitor: c.competitor ?? c.alternatives.find((a) => a.length > 0) ?? c.title,
      count: c.frequency,
      share: switchTotal > 0 ? Math.round((c.frequency / switchTotal) * 100) / 100 : 0,
      platforms: c.platforms,
    })),
    voice_top: m.voice_top,
    cross_platform_themes: m.cross_platform_themes.map((t) => ({
      theme: t.theme,
      platforms: t.platforms,
      weight: t.weight,
    })),
  };
}
