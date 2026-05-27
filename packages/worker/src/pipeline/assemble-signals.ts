import type { PlatformId } from "@rivaleye/scrapers";
import type {
  EvidenceIndexItem,
  MergedSignals,
  StageAExtract,
  StageASignal,
  StageASwitchSignal,
  StageAPricingSignal,
  StageAFeatureSignal,
  StageAPositioningSignal,
  LoveCluster,
  PainCluster,
  GapCluster,
  SwitchCluster,
  PricingCluster,
  FeatureCluster,
  PositioningCluster,
} from "../prompts/shared";

export interface AssembleInput {
  platform: PlatformId;
  extract: StageAExtract;
}

/** The narrow 7-platform enum MergedSignals clusters use (subset of the wide
 *  scrapers PlatformId). Only enabled platforms ever reach assembly. */
type PoolPlatform = MergedSignals["source_coverage"][number]["platform"];

const ASSEMBLE_MODEL = "assemble-v1 (no-merge code pool)";

/** More evidence and wider platform spread => higher confidence. Mirrors the
 *  formula used by the old enrichMergedSignals so downstream widgets behave. */
function clusterConfidence(frequency: number, sourceSpread: number): number {
  const freqScore = Math.min(frequency / 8, 1);
  const spreadScore = Math.min(sourceSpread / 3, 1);
  return Math.round((freqScore * 0.6 + spreadScore * 0.4) * 100) / 100;
}

function urgencyFromStrength(strength: number): "low" | "medium" | "high" {
  if (strength >= 0.66) return "high";
  if (strength >= 0.33) return "medium";
  return "low";
}

/** Stats for a single-signal cluster: it comes from exactly one platform, so
 *  frequency is its evidence count and source_spread is 1. */
function baseFields(
  signal: StageASignal,
  platform: PoolPlatform,
  signalType: LoveCluster["signal_type"],
  id: string,
) {
  const frequency = Math.max(signal.evidence_ids.length, 1);
  const source_spread = 1;
  return {
    id,
    title: signal.title,
    summary: signal.summary,
    signal_type: signalType,
    frequency,
    source_spread,
    platforms: [platform],
    confidence: clusterConfidence(frequency, source_spread),
    strength_or_severity: signal.strength_or_severity,
    evidence_ids: signal.evidence_ids,
    representative_quotes: signal.representative_quotes.map((q) => ({
      author: q.author,
      text: q.text,
      evidence_id: q.evidence_id,
    })),
    related_signal_ids: [],
    // All dashboards mine the full pool themselves; relevance is not gated here.
    role_relevance: ["founder", "product", "marketing", "growth"] as Array<
      "founder" | "product" | "marketing" | "growth"
    >,
  };
}

function buildEvidenceIndex(inputs: AssembleInput[]): EvidenceIndexItem[] {
  const byId = new Map<string, EvidenceIndexItem>();
  for (const { platform: rawPlatform, extract } of inputs) {
    const platform = rawPlatform as PoolPlatform;
    for (const q of extract.evidence_quotes) {
      if (byId.has(q.evidence_id)) continue;
      byId.set(q.evidence_id, {
        evidence_id: q.evidence_id,
        source: platform,
        text: q.text,
        author: q.author || null,
        source_url: null,
        source_date: null,
        related_signal_ids: [],
        related_cluster_ids: [],
        sentiment: q.sentiment ?? null,
        confidence: 0,
      });
    }
  }
  return [...byId.values()];
}

function buildVoiceTop(inputs: AssembleInput[]): MergedSignals["voice_top"] {
  const pos = new Map<string, number>();
  const neg = new Map<string, number>();
  for (const { extract } of inputs) {
    for (const w of extract.voice_phrases.positive) {
      const key = w.trim().toLowerCase();
      if (key) pos.set(key, (pos.get(key) ?? 0) + 1);
    }
    for (const w of extract.voice_phrases.negative) {
      const key = w.trim().toLowerCase();
      if (key) neg.set(key, (neg.get(key) ?? 0) + 1);
    }
  }
  const toSorted = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  return { positive: toSorted(pos), negative: toSorted(neg) };
}

/**
 * Pool every per-platform Stage A signal into one MergedSignals object WITHOUT
 * the LLM collapse. Each raw signal becomes its own cluster (1:1), tagged with
 * its source platform. No semantic merge, no cap, no cross-platform balancing —
 * the full corpus reaches every downstream dashboard so each can synthesize
 * through its own lens instead of all sharing one over-collapsed digest.
 */
export function assembleSignalPool(inputs: AssembleInput[]): MergedSignals {
  const love_clusters: LoveCluster[] = [];
  const pain_clusters: PainCluster[] = [];
  const gap_clusters: GapCluster[] = [];
  const switch_clusters: SwitchCluster[] = [];
  const pricing_clusters: PricingCluster[] = [];
  const feature_clusters: FeatureCluster[] = [];
  const positioning_clusters: PositioningCluster[] = [];

  for (const { platform: rawPlatform, extract } of inputs) {
    const platform = rawPlatform as PoolPlatform;
    extract.love_signals.forEach((s: StageASignal, i: number) => {
      love_clusters.push(baseFields(s, platform, "love", `love-${platform}-${i}`));
    });
    extract.pain_signals.forEach((s: StageASignal, i: number) => {
      pain_clusters.push({
        ...baseFields(s, platform, "pain", `pain-${platform}-${i}`),
        affected_segment: s.user_segment,
        opportunity_implication: null,
      });
    });
    extract.gap_signals.forEach((s: StageASignal, i: number) => {
      gap_clusters.push({
        ...baseFields(s, platform, "gap", `gap-${platform}-${i}`),
        workaround: null,
        product_opportunity: null,
      });
    });
    extract.switch_signals.forEach((s: StageASwitchSignal, i: number) => {
      switch_clusters.push({
        ...baseFields(s, platform, "switch", `switch-${platform}-${i}`),
        direction: s.direction,
        competitor: s.alternatives_mentioned[0] ?? null,
        alternatives: s.alternatives_mentioned,
        urgency: urgencyFromStrength(s.strength_or_severity),
      });
    });
    extract.pricing_signals.forEach((s: StageAPricingSignal, i: number) => {
      pricing_clusters.push({
        ...baseFields(s, platform, "pricing", `pricing-${platform}-${i}`),
        tier_label: s.tier_label,
        quoted_prices: s.quoted_price ? [s.quoted_price] : [],
        affected_segment: s.user_segment,
      });
    });
    extract.feature_signals.forEach((s: StageAFeatureSignal, i: number) => {
      feature_clusters.push({
        ...baseFields(s, platform, "feature", `feature-${platform}-${i}`),
        feature_name: s.feature_name,
        perception: s.perception,
        product_lesson: null,
      });
    });
    extract.positioning_signals.forEach((s: StageAPositioningSignal, i: number) => {
      positioning_clusters.push({
        ...baseFields(s, platform, "positioning", `positioning-${platform}-${i}`),
        angle: s.angle,
        against: s.against,
        promise_vs_reality: null,
      });
    });
  }

  const totalClusters =
    love_clusters.length +
    pain_clusters.length +
    gap_clusters.length +
    switch_clusters.length +
    pricing_clusters.length +
    feature_clusters.length +
    positioning_clusters.length;

  const source_coverage = inputs.map(({ platform: rawPlatform, extract }) => {
    const platform = rawPlatform as PoolPlatform;
    const signal_count =
      extract.love_signals.length +
      extract.pain_signals.length +
      extract.gap_signals.length +
      extract.switch_signals.length +
      extract.pricing_signals.length +
      extract.feature_signals.length +
      extract.positioning_signals.length;
    return { platform, signal_count, contributed: signal_count > 0 };
  });

  return {
    love_clusters,
    pain_clusters,
    gap_clusters,
    switch_clusters,
    pricing_clusters,
    feature_clusters,
    positioning_clusters,
    voice_top: buildVoiceTop(inputs),
    cross_platform_themes: [],
    evidence_index: buildEvidenceIndex(inputs),
    source_coverage,
    clustering_meta: {
      total_input_signals: totalClusters,
      total_output_clusters: totalClusters,
      model: ASSEMBLE_MODEL,
      generated_at: new Date().toISOString(),
    },
  };
}
