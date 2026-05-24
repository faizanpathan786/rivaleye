/**
 * dashboard-helpers.ts
 *
 * Shared utilities and canonical type definitions for the Phase 5b dashboard
 * UI.  All types match the doc-16 contract exactly (see
 * docs/architecture/16-dashboard-data-contracts.md — "Shared primitives").
 *
 * These types are defined locally for the web package because `@rivaleye/shared`
 * does not yet expose them.  Once shared exports them, replace the local
 * definitions with imports from "@rivaleye/shared".
 */

// ─── Canonical doc-16 shared primitives ──────────────────────────────────────

/** Signal category as defined in doc-16. */
export type SignalType =
  | "love"
  | "pain"
  | "gap"
  | "switch"
  | "pricing"
  | "feature"
  | "positioning";

/**
 * A reference from a dashboard insight back to its grounding evidence.
 * At least one of the three arrays must be non-empty for any claim-making insight.
 */
export type EvidenceRef = {
  signal_ids: string[];
  quote_ids: string[];
  source_urls: string[];
};

/**
 * Confidence attached to any insight.
 * `score` is 0–1, `label` is a bucketed tier, `basis` is a plain-English
 * explanation of what data backs this confidence value (may be null when thin).
 */
export type Confidence = {
  score: number;
  label: "low" | "medium" | "high";
  basis: string | null;
};

/**
 * A single evidence quote as stored in the EvidenceSection.
 * `id` matches the `quote_ids` strings in `EvidenceRef`.
 */
export type EvidenceQuote = {
  id: string;
  text: string;
  source: string;
  source_url: string | null;
  sentiment: number | null;
  signal_type: SignalType | null;
};

/**
 * The EvidenceSection as emitted by Stage D.
 * Only the fields needed by `<EvidenceDrawer>` are typed here.
 */
export type EvidenceSection = {
  quotes: EvidenceQuote[];
};

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * `bucketFloat` — maps a 0–1 float to a semantic tier.
 *
 * @param v   - Input value, 0–1.
 * @param hi  - Lower bound for "high" bucket (default 0.66).
 * @param mid - Lower bound for "medium" bucket (default 0.33).
 * @returns   "high" | "medium" | "low"
 *
 * Boundary behaviour (inclusive lower bound):
 *   v >= hi              → "high"
 *   v >= mid && v < hi   → "medium"
 *   v < mid              → "low"
 *
 * @example
 *   bucketFloat(0.9)         // "high"
 *   bucketFloat(0.5)         // "medium"
 *   bucketFloat(0.2)         // "low"
 *   bucketFloat(0.66)        // "high"
 *   bucketFloat(0.33)        // "medium"
 *   bucketFloat(0.32)        // "low"
 */
export function bucketFloat(
  v: number,
  hi = 0.66,
  mid = 0.33,
): "low" | "medium" | "high" {
  if (v >= hi) return "high";
  if (v >= mid) return "medium";
  return "low";
}

/**
 * `confidencePercent` — converts a `Confidence` score (0–1) to a rounded
 * integer percentage (0–100) suitable for display.
 *
 * @example
 *   confidencePercent({ score: 0.714, label: "medium", basis: null }) // 71
 */
export function confidencePercent(c: Confidence): number {
  return Math.round(c.score * 100);
}
