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
  author: string | null;
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

/**
 * Filter quotes/mentions by date range.
 * @param items Array of items with `createdAt`, `when`, or `timestamp` field
 * @param range "24h" | "7d" | "30d" | "90d"
 */
export function filterByDateRange<T extends { createdAt?: Date | string | null; when?: string }>(
  items: T[],
  range?: string,
): T[] {
  if (!range || range === "90d") return items; // Default: no filtering or full 90d

  const now = new Date();
  const rangeMs = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  }[range];

  if (!rangeMs) return items; // Invalid range, return all

  return items.filter((item) => {
    const date = item.createdAt
      ? new Date(item.createdAt)
      : parseWhenString(item.when);
    if (!date) return true; // No date, include it
    return now.getTime() - date.getTime() <= rangeMs;
  });
}

function parseWhenString(when?: string): Date | null {
  if (!when) return null;
  const match = when.match(/^(\d+)([hdwm])$/); // "3d", "1w", "2m"
  if (!match || !match[1] || !match[2]) return null;

  const num = match[1];
  const unit = match[2];
  const ms =
    unit === "h" ? +num * 60 * 60 * 1000
    : unit === "d" ? +num * 24 * 60 * 60 * 1000
    : unit === "w" ? +num * 7 * 24 * 60 * 60 * 1000
    : unit === "m" ? +num * 30 * 24 * 60 * 60 * 1000
    : 0;

  return ms > 0 ? new Date(Date.now() - ms) : null;
}
