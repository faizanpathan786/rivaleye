import { BLOCKED_PHRASES } from "../prompts/shared";
import { EvidenceIntegrityError } from "./errors";
import type { SyntheticIdMap } from "./stage1";

// ---- Internal output type ----
// Mirrors Stage3Output but defined locally so evidence-binding is not coupled
// to the stage3 module and can be used at any pre-wire point in the pipeline.

type EvidenceBlock = {
  post_ids: string[];
  top_quotes: string[];
};

type WithEvidence = {
  evidence: EvidenceBlock;
};

export type InternalOutput = {
  executiveSummary?: string;
  pain_clusters?: Array<{ description: string; evidence: EvidenceBlock }>;
  topOpportunities?: Array<WithEvidence>;
  featureGaps?: Array<WithEvidence>;
  switchingSignals?: Array<{ signal: string; evidence: EvidenceBlock }>;
  // Pass-through for anything else
  [key: string]: unknown;
};

// ---- 6.1 remapPostIds ----

/**
 * Remap a single array of synthetic IDs (e.g. "p001") to real externalIds.
 * Unknown synthetic IDs are dropped with a warning.
 */
function remapIds(ids: string[], syntheticIdMap: SyntheticIdMap): string[] {
  const result: string[] = [];
  for (const id of ids) {
    const real = syntheticIdMap.get(id);
    if (real !== undefined) {
      result.push(real);
    } else {
      console.warn(`[evidence-binding] unknown synthetic ID "${id}" — dropping`);
    }
  }
  return result;
}

/**
 * Remap post_ids in a single evidence block (non-mutating).
 */
function remapEvidenceBlock(
  evidence: EvidenceBlock,
  syntheticIdMap: SyntheticIdMap,
): EvidenceBlock {
  return {
    ...evidence,
    post_ids: remapIds(evidence.post_ids, syntheticIdMap),
  };
}

/**
 * Generic helper: remap post_ids for any array of items that have an evidence
 * block. Returns a new array without mutating the input.
 */
export function remapPostIds<
  T extends { evidence?: { post_ids: string[]; top_quotes: string[] } },
>(items: T[], syntheticIdMap: SyntheticIdMap): T[] {
  return items.map((item) => {
    if (item.evidence === undefined) return item;
    return {
      ...item,
      evidence: remapEvidenceBlock(item.evidence, syntheticIdMap),
    };
  });
}

/**
 * Remap all post_ids across the full internal output shape (non-mutating).
 */
export function remapAllPostIds(
  output: InternalOutput,
  syntheticIdMap: SyntheticIdMap,
): InternalOutput {
  const result: InternalOutput = { ...output };

  if (output.pain_clusters !== undefined) {
    result.pain_clusters = output.pain_clusters.map((cluster) => ({
      ...cluster,
      evidence: remapEvidenceBlock(cluster.evidence, syntheticIdMap),
    }));
  }

  if (output.featureGaps !== undefined) {
    result.featureGaps = remapPostIds(output.featureGaps, syntheticIdMap);
  }

  if (output.switchingSignals !== undefined) {
    result.switchingSignals = output.switchingSignals.map((signal) => ({
      ...signal,
      evidence: remapEvidenceBlock(signal.evidence, syntheticIdMap),
    }));
  }

  if (output.topOpportunities !== undefined) {
    result.topOpportunities = remapPostIds(output.topOpportunities, syntheticIdMap);
  }

  return result;
}

// ---- 6.2 validateEvidence ----

type ValidateResult = {
  output: InternalOutput;
  warnings: string[];
  droppedCount: number;
  totalCount: number;
};

/**
 * Filter a post_ids array to only include IDs present in realPostIds.
 * Returns [filtered, removedCount].
 */
function filterToReal(
  ids: string[],
  realPostIds: Set<string>,
): [string[], number] {
  const filtered = ids.filter((id) => realPostIds.has(id));
  return [filtered, ids.length - filtered.length];
}

/**
 * Validate all evidence blocks in the output against the set of real post IDs.
 *
 * Minimum thresholds per spec:
 *   pain_clusters     → ≥2 post_ids
 *   feature_gaps      → ≥1 post_id
 *   switching_signals → ≥1 post_id
 *   top_opportunities → ≥3 post_ids
 *
 * Claims are counted at the post_id citation level (one cited ID = one claim).
 * Invalid IDs are removed first, then threshold checks are applied.
 * If >20% of total cited post_id claims are dropped, throws EvidenceIntegrityError.
 */
export function validateEvidence(
  output: InternalOutput,
  realPostIds: Set<string>,
): ValidateResult {
  const warnings: string[] = [];
  let droppedCount = 0;
  let totalCount = 0;
  const result: InternalOutput = { ...output };

  // pain_clusters — min 2 post_ids
  if (output.pain_clusters !== undefined) {
    const filtered: typeof output.pain_clusters = [];
    for (const cluster of output.pain_clusters) {
      const [validIds, removed] = filterToReal(cluster.evidence.post_ids, realPostIds);
      totalCount += cluster.evidence.post_ids.length;
      droppedCount += removed;

      if (validIds.length < 2) {
        warnings.push(
          `pain_cluster dropped: "${cluster.description.slice(0, 60)}" has only ${validIds.length} valid post_ids (min 2)`,
        );
      } else {
        filtered.push({
          ...cluster,
          evidence: { ...cluster.evidence, post_ids: validIds },
        });
      }
    }
    result.pain_clusters = filtered;
  }

  // feature_gaps — min 1 post_id
  if (output.featureGaps !== undefined) {
    const filtered: typeof output.featureGaps = [];
    for (const gap of output.featureGaps) {
      const [validIds, removed] = filterToReal(gap.evidence.post_ids, realPostIds);
      totalCount += gap.evidence.post_ids.length;
      droppedCount += removed;

      if (validIds.length < 1) {
        warnings.push(`feature_gap dropped: no valid post_ids after filtering`);
      } else {
        filtered.push({
          ...gap,
          evidence: { ...gap.evidence, post_ids: validIds },
        });
      }
    }
    result.featureGaps = filtered;
  }

  // switching_signals — min 1 post_id
  if (output.switchingSignals !== undefined) {
    const filtered: typeof output.switchingSignals = [];
    for (const signal of output.switchingSignals) {
      const [validIds, removed] = filterToReal(signal.evidence.post_ids, realPostIds);
      totalCount += signal.evidence.post_ids.length;
      droppedCount += removed;

      if (validIds.length < 1) {
        warnings.push(
          `switching_signal dropped: "${signal.signal.slice(0, 60)}" has no valid post_ids`,
        );
      } else {
        filtered.push({
          ...signal,
          evidence: { ...signal.evidence, post_ids: validIds },
        });
      }
    }
    result.switchingSignals = filtered;
  }

  // top_opportunities — min 3 post_ids
  if (output.topOpportunities !== undefined) {
    const filtered: typeof output.topOpportunities = [];
    for (const opp of output.topOpportunities) {
      const [validIds, removed] = filterToReal(opp.evidence.post_ids, realPostIds);
      totalCount += opp.evidence.post_ids.length;
      droppedCount += removed;

      if (validIds.length < 3) {
        warnings.push(
          `top_opportunity dropped: only ${validIds.length} valid post_ids (min 3)`,
        );
      } else {
        filtered.push({
          ...opp,
          evidence: { ...opp.evidence, post_ids: validIds },
        });
      }
    }
    result.topOpportunities = filtered;
  }

  // Guard against division by zero
  if (totalCount > 0 && droppedCount > totalCount * 0.2) {
    throw new EvidenceIntegrityError(droppedCount, totalCount);
  }

  return { output: result, warnings, droppedCount, totalCount };
}

// ---- 6.3 checkBlocklist ----

type BlocklistResult = {
  ok: boolean;
  offending: string[];
};

/**
 * Scan executive_summary and each pain_cluster.description for BLOCKED_PHRASES.
 * Returns { ok: true, offending: [] } if clean.
 */
export function checkBlocklist(output: {
  executive_summary?: string;
  pain_clusters?: Array<{ description: string }>;
}): BlocklistResult {
  const textParts: string[] = [];

  if (output.executive_summary !== undefined) {
    textParts.push(output.executive_summary);
  }

  if (output.pain_clusters !== undefined) {
    for (const cluster of output.pain_clusters) {
      textParts.push(cluster.description);
    }
  }

  const combined = textParts.join(" ").toLowerCase();
  const offending: string[] = [];

  for (const phrase of BLOCKED_PHRASES) {
    if (combined.includes(phrase.toLowerCase())) {
      offending.push(phrase);
    }
  }

  return offending.length === 0
    ? { ok: true, offending: [] }
    : { ok: false, offending };
}
