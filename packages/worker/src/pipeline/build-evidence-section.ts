import { randomUUID } from "crypto";
import {
  evidenceSectionSchema,
  type EvidenceSection,
} from "../prompts/role-sections/schema";
import type { SignalType } from "../prompts/role-sections/primitives";
import type { MergedSignals, EvidenceIndexItem } from "../prompts/shared";

/**
 * Builds a Map<clusterId, signal_type> by iterating all seven cluster arrays.
 * Used to resolve each evidence item's signal_type from its related_cluster_ids.
 */
function buildClusterSignalTypeMap(mergedSignals: MergedSignals): Map<string, SignalType> {
  const map = new Map<string, SignalType>();
  const allArrays = [
    mergedSignals.love_clusters,
    mergedSignals.pain_clusters,
    mergedSignals.gap_clusters,
    mergedSignals.switch_clusters,
    mergedSignals.pricing_clusters,
    mergedSignals.feature_clusters,
    mergedSignals.positioning_clusters,
  ] as const;
  for (const clusters of allArrays) {
    for (const cluster of clusters) {
      map.set(cluster.id, cluster.signal_type);
    }
  }
  return map;
}

/**
 * Resolves the signal_type for an evidence item.
 *
 * Resolution order:
 * 1. Look up related_cluster_ids[0] in the clusterMap.
 * 2. If unresolved, scan all clusters' evidence_ids for one containing this evidence_id.
 * 3. Fall back to "pain" only when truly unresolvable.
 */
function resolveSignalType(
  item: EvidenceIndexItem,
  clusterMap: Map<string, SignalType>,
  mergedSignals: MergedSignals,
): SignalType {
  // Step 1: try the first related_cluster_id
  const firstClusterId = item.related_cluster_ids[0];
  if (firstClusterId !== undefined) {
    const resolved = clusterMap.get(firstClusterId);
    if (resolved !== undefined) return resolved;
  }

  // Step 2: scan all cluster evidence_ids arrays for a cluster containing this evidence_id
  const allArrays = [
    mergedSignals.love_clusters,
    mergedSignals.pain_clusters,
    mergedSignals.gap_clusters,
    mergedSignals.switch_clusters,
    mergedSignals.pricing_clusters,
    mergedSignals.feature_clusters,
    mergedSignals.positioning_clusters,
  ] as const;
  for (const clusters of allArrays) {
    for (const cluster of clusters) {
      if (cluster.evidence_ids.includes(item.evidence_id)) {
        return cluster.signal_type;
      }
    }
  }

  // Step 3: final fallback
  return "pain";
}

/**
 * Builds the EvidenceSection deterministically from MergedSignals.
 * No LLM call is made — this is a pure code transformation.
 *
 * Mapping decisions:
 * - EvidenceIndexItem.evidence_id → EvidenceItem.id
 *   The EvidenceIndexItem schema types evidence_id as string (not uuid).
 *   We use it directly; if callers ever need strict uuid format they must
 *   ensure evidence_index items carry valid UUIDs upstream.
 *   When evidence_id is empty we generate a fresh UUID as a safe fallback.
 *
 * - signal_type is resolved from the cluster arrays in mergedSignals:
 *   first via related_cluster_ids[0], then by scanning cluster evidence_ids,
 *   and only if both fail, defaulting to "pain".
 *
 * - EvidenceIndexItem.related_cluster_ids has no EvidenceItem counterpart.
 *   We cannot reliably map cluster IDs to dashboardSectionSchema values
 *   without the cluster objects themselves, so related_dashboard_sections
 *   is left as [] — the UI filter degrades gracefully.
 *
 * - raw_items: EvidenceIndexItem does not carry full source-post fields
 *   (title, body_excerpt, score). raw_items is intentionally left empty;
 *   it is an audit artefact that belongs to a dedicated scraper output pass.
 *
 * - source_links: derived from unique, non-null source_urls.
 *   Label is "<source> thread/review" (generic but self-describing).
 */
export function buildEvidenceSection(mergedSignals: MergedSignals): EvidenceSection {
  const clusterMap = buildClusterSignalTypeMap(mergedSignals);
  const quotes = mergedSignals.evidence_index.map((item) =>
    mapEvidenceItem(item, clusterMap, mergedSignals),
  );

  const source_links = buildSourceLinks(mergedSignals.evidence_index);

  return evidenceSectionSchema.parse({
    quotes,
    source_links,
    raw_items: [],
    // filters_supported uses the schema default — no override needed.
  });
}

/**
 * Converts a raw numeric confidence score (0–1) to a confidenceSchema object.
 * EvidenceIndexItem.confidence is a plain number; EvidenceItem.confidence is
 * the richer { score, label, basis } shape from primitives.confidenceSchema.
 */
function numericToConfidence(score: number) {
  const label =
    score >= 0.7 ? ("high" as const) : score >= 0.4 ? ("medium" as const) : ("low" as const);
  return { score, label, basis: null };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapEvidenceItem(
  item: EvidenceIndexItem,
  clusterMap: Map<string, SignalType>,
  mergedSignals: MergedSignals,
) {
  const trimmed = item.evidence_id.trim();
  const id = UUID_RE.test(trimmed) ? trimmed : randomUUID();
  const sentiment = item.sentiment ?? 0;

  return {
    id,
    quote: item.text,
    source: item.source,
    // source_item_id is not in EvidenceIndexItem; reuse evidence_id as the
    // best available stable reference to the originating source post.
    source_item_id: id,
    // source_url is nullable — evidenceItemSchema.source_url is z.string().url().nullable()
    source_url: item.source_url,
    source_date: item.source_date ?? null,
    author_or_context: item.author ?? null,
    // Resolve signal_type from cluster arrays; fall back to "pain" only when unresolvable.
    signal_type: resolveSignalType(item, clusterMap, mergedSignals),
    sentiment,
    // EvidenceIndexItem.confidence is a plain 0–1 number; EvidenceItem requires
    // a { score, label, basis } object (confidenceSchema).
    confidence: numericToConfidence(item.confidence),
    related_signal_ids: item.related_signal_ids,
    // related_cluster_ids cannot be mapped to dashboardSectionSchema values
    // without cluster objects; left empty.
    related_dashboard_sections: [],
    role_relevance: [],
    raw_text_excerpt: null,
    metadata: {},
  };
}

function buildSourceLinks(index: EvidenceIndexItem[]) {
  const seen = new Set<string>();
  const links: Array<{ label: string; url: string }> = [];

  for (const item of index) {
    const url = item.source_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push({
      label: `${item.source} thread/review`,
      url,
    });
  }

  return links;
}
