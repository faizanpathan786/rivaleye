import { z } from "zod";
import type { MergedSignals } from "../shared";

/**
 * Derives a human-readable platform breakdown from merged evidence.
 * Used to inject source context into each role section prompt so the LLM
 * knows which platforms contributed data and can calibrate its output.
 */
export function buildPlatformSummary(mergedSignals: MergedSignals): string {
  const counts = new Map<string, number>();
  for (const item of mergedSignals.evidence_index) {
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  }
  if (counts.size === 0) return "No platform breakdown available.";
  const lines = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([platform, count]) => `  - ${platform}: ${count} evidence items`);
  return `Data sources for this report:\n${lines.join("\n")}`;
}

export const signalTypeSchema = z.enum([
  "love", "pain", "gap", "switch", "pricing", "feature", "positioning",
]);
export type SignalType = z.infer<typeof signalTypeSchema>;

export const roleSchema = z.enum(["founder", "product", "marketing", "growth"]);
export type Role = z.infer<typeof roleSchema>;

/**
 * A reference from a dashboard insight back to its grounding evidence.
 *  - signal_ids  → Stage C signal cluster ids
 *  - quote_ids   → ids into EvidenceSection.quotes
 *  - source_urls → raw source post/page URLs
 * At least one of the three must be non-empty for any insight that makes a claim.
 *
 * Uses .catch() so that LLM returning [] instead of {} gracefully falls back.
 */
export const evidenceRefSchema = z.object({
  signal_ids: z.array(z.string()).default([]),
  quote_ids: z.array(z.string()).default([]),
  source_urls: z.array(z.string()).default([]),
}).catch({ signal_ids: [], quote_ids: [], source_urls: [] });
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/**
 * Confidence attached to any insight. Never fake certainty.
 *
 * Uses .catch() so that LLM omitting the entire confidence object
 * or returning invalid values gracefully falls back to medium confidence.
 */
export const confidenceSchema = z.object({
  score: z.number().min(0).max(1).default(0.5),
  label: z.enum(["low", "medium", "high"]).default("medium"),
  basis: z.string().nullable().default(null),
}).catch({ score: 0.5, label: "medium", basis: null });
export type Confidence = z.infer<typeof confidenceSchema>;
