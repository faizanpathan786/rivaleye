/**
 * marketing.ts
 *
 * Pure adapter: MarketingViewSection (doc-16 contract) → MarketingViewProps
 * (the shape the marketing.tsx page consumes).
 *
 * Rules:
 * - No `any`. No side effects. Named exports only.
 * - Dropped mock-only fields: score.coverage, quoteLib[].score (upvote int),
 *   bestAngle.evidence / .sources / .confidence (standalone ad-hoc fields),
 *   comparison.chooseThem[].
 * - bestAngle is derived at runtime from positioning_angles sorted by
 *   confidence.score desc; the first item becomes the hero.
 * - language.* exposes all 5 sub-arrays from user_language_bank.
 * - score factors: object → { key, value }[] (tone and note dropped).
 * - objections[].frequency: integer → 0..1 by dividing by max across list.
 * - quoteLib[].signals: contract's single signal_type enum → single-element
 *   array to keep the UI's array-iteration intact.
 */

import type {
  Confidence,
  EvidenceRef,
  SignalType,
} from "../dashboard-helpers";

// ── Re-exported doc-16 sub-types used in MarketingViewProps ─────────────────

export type { Confidence, EvidenceRef, SignalType };

// ── PhraseItem (matches doc-16 phraseItemSchema) ─────────────────────────────

export type PhraseItem = {
  phrase: string;
  frequency: number;       // integer count (raw, not normalised)
  sentiment: number;       // -1..1
  source_count: number;    // integer
  evidence_refs: EvidenceRef;
};

// ── ScoreFactor — adapted from doc-16 factors object ─────────────────────────

export type ScoreFactor = {
  key: string;
  value: number;           // 0..1
};

// ── Adapted score ─────────────────────────────────────────────────────────────

export type MessagingOpportunityScoreProps = {
  score: number;           // 0..100
  label: string;
  explanation: string;
  factors: ScoreFactor[];
};

// ── Language bank (all 5 sub-arrays) ─────────────────────────────────────────

export type UserLanguageBankProps = {
  positive_phrases: PhraseItem[];
  negative_phrases: PhraseItem[];
  alternative_seeking_phrases: PhraseItem[];
  emotional_adjectives: PhraseItem[];
  category_language: PhraseItem[];
};

// ── BestAngle — derived from top positioning_angle ───────────────────────────

export type BestAngleProps = {
  angle_title: string;
  suggested_message: string;
  pain_targeted: string;
  competitor_weakness: string;
  competitor_strength_to_respect: string;
  best_channel_or_use_case: string;
  risk_warning: string | null;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

// ── PositioningAngleProps (full card) ─────────────────────────────────────────

export type PositioningAngleProps = {
  angle_title: string;
  suggested_message: string;
  pain_targeted: string;
  competitor_weakness: string;
  competitor_strength_to_respect: string;
  best_channel_or_use_case: string;
  risk_warning: string | null;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

// ── PromiseVsRealityProps ─────────────────────────────────────────────────────

export type PromiseVsRealityProps = {
  competitor_claim: string;
  user_reality: string;
  gap_summary: string;
  messaging_opportunity: string;
  evidence_count: number;
  evidence_refs: EvidenceRef;
};

// ── ObjectionProps — frequency normalised to 0..1 ────────────────────────────

export type ObjectionProps = {
  objection_title: string;
  objection_type: string;
  why_users_hesitate: string;
  /** Normalised 0..1 share of max frequency across the objections list. */
  frequency: number;
  suggested_response: string;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

// ── ComparisonPageBulletsProps ────────────────────────────────────────────────
// chooseThem[] is dropped (mock-only, no contract source).

export type ComparisonPageBulletsProps = {
  hero_angle: string;
  why_users_look_for_alternatives: string[];
  where_competitor_is_strong: string[];
  where_users_struggle: string[];
  who_should_choose_us: string[];
  objections_to_handle: string[];
  proof_quotes: string[];
};

// ── CopyItemProps ─────────────────────────────────────────────────────────────

export type CopyItemProps = {
  copy: string;
  signal_behind_it: string;
  best_use_case: string;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

// ── CopyIdeasProps ────────────────────────────────────────────────────────────

export type CopyIdeasProps = {
  homepage_headlines: CopyItemProps[];
  subheadlines: CopyItemProps[];
  ad_hooks: CopyItemProps[];
  linkedin_hooks: CopyItemProps[];
  comparison_page_headlines: CopyItemProps[];
  cta_ideas: CopyItemProps[];
};

// ── QuoteLibItemProps — signals is always a single-element array ──────────────
// score (upvote int) is dropped.

export type QuoteLibItemProps = {
  quote: string;
  source: string;
  source_date: string | null;
  sentiment: number;
  /** Single-element array wrapping the contract's signal_type enum. */
  signals: [SignalType];
  related_positioning_angle: string | null;
  copy_usefulness_score: number;
  source_url: string | null;
};

// ── Root adapted shape ────────────────────────────────────────────────────────

export type MarketingViewProps = {
  role: "marketing";
  competitor_id: string;
  generated_at: string;

  score: MessagingOpportunityScoreProps;
  messaging_summary: string;

  /** All 5 language sub-arrays. */
  language: UserLanguageBankProps;

  /** Hero angle — the positioning_angle with the highest confidence.score. */
  bestAngle: BestAngleProps | null;

  angles: PositioningAngleProps[];

  promiseReality: PromiseVsRealityProps[];

  /** Objections with frequency normalised to 0..1. */
  objections: ObjectionProps[];

  comparison: ComparisonPageBulletsProps;

  copy: CopyIdeasProps;

  quoteLib: QuoteLibItemProps[];

  evidence_refs: EvidenceRef;
};

// ── Doc-16 input types (minimal — only fields used by the adapter) ────────────

type DocEvidenceRef = {
  signal_ids: string[];
  quote_ids: string[];
  source_urls: string[];
};

type DocConfidence = {
  score: number;
  label: "low" | "medium" | "high";
  basis: string | null;
};

type DocPhraseItem = {
  phrase: string;
  frequency: number;
  sentiment: number;
  source_count: number;
  evidence_refs: DocEvidenceRef;
};

type DocPositioningAngle = {
  angle_title: string;
  suggested_message: string;
  pain_targeted: string;
  competitor_weakness: string;
  competitor_strength_to_respect: string;
  best_channel_or_use_case: string;
  risk_warning: string | null;
  confidence: DocConfidence;
  evidence_refs: DocEvidenceRef;
};

type DocObjectionItem = {
  objection_title: string;
  objection_type: string;
  why_users_hesitate: string;
  frequency: number;       // integer count in the contract
  suggested_response: string;
  confidence: DocConfidence;
  evidence_refs: DocEvidenceRef;
};

type DocPromiseVsRealityItem = {
  competitor_claim: string;
  user_reality: string;
  gap_summary: string;
  messaging_opportunity: string;
  evidence_count: number;
  evidence_refs: DocEvidenceRef;
};

type DocCopyItem = {
  copy: string;
  signal_behind_it: string;
  best_use_case: string;
  confidence: DocConfidence;
  evidence_refs: DocEvidenceRef;
};

type DocCopyIdeas = {
  homepage_headlines: DocCopyItem[];
  subheadlines: DocCopyItem[];
  ad_hooks: DocCopyItem[];
  linkedin_hooks: DocCopyItem[];
  comparison_page_headlines: DocCopyItem[];
  cta_ideas: DocCopyItem[];
};

type DocQuoteLibraryItem = {
  quote: string;
  source: string;
  source_date: string | null;
  sentiment: number;
  signal_type: SignalType;
  related_positioning_angle: string | null;
  copy_usefulness_score: number;
  source_url: string | null;
};

type DocComparisonPageBullets = {
  hero_angle: string;
  why_users_look_for_alternatives: string[];
  where_competitor_is_strong: string[];
  where_users_struggle: string[];
  who_should_choose_us: string[];
  objections_to_handle: string[];
  proof_quotes: string[];
};

type DocUserLanguageBank = {
  positive_phrases: DocPhraseItem[];
  negative_phrases: DocPhraseItem[];
  alternative_seeking_phrases: DocPhraseItem[];
  emotional_adjectives: DocPhraseItem[];
  category_language: DocPhraseItem[];
};

type DocMessagingOpportunityScore = {
  score: number;
  label: string;
  explanation: string;
  factors: {
    repeated_user_language_strength: number;
    pain_clarity: number;
    promise_reality_gap: number;
    objection_frequency: number;
    quote_quality: number;
    source_confidence: number;
  };
};

export type MarketingViewSection = {
  role: "marketing";
  competitor_id: string;
  generated_at: string;
  messaging_opportunity_score: DocMessagingOpportunityScore;
  messaging_summary: string;
  user_language_bank: DocUserLanguageBank;
  positive_phrases: DocPhraseItem[];
  negative_phrases: DocPhraseItem[];
  positioning_angles: DocPositioningAngle[];
  competitor_promise_vs_user_reality: DocPromiseVsRealityItem[];
  objections_to_handle: DocObjectionItem[];
  comparison_page_bullets: DocComparisonPageBullets;
  copy_ideas: DocCopyIdeas;
  quote_library: DocQuoteLibraryItem[];
  evidence_refs: DocEvidenceRef;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function adaptPhraseItem(p: DocPhraseItem): PhraseItem {
  return {
    phrase: p.phrase,
    frequency: p.frequency,
    sentiment: p.sentiment,
    source_count: p.source_count,
    evidence_refs: p.evidence_refs,
  };
}

function adaptScoreFactors(
  factors: DocMessagingOpportunityScore["factors"],
): ScoreFactor[] {
  return [
    { key: "repeated_user_language_strength", value: factors.repeated_user_language_strength },
    { key: "pain_clarity", value: factors.pain_clarity },
    { key: "promise_reality_gap", value: factors.promise_reality_gap },
    { key: "objection_frequency", value: factors.objection_frequency },
    { key: "quote_quality", value: factors.quote_quality },
    { key: "source_confidence", value: factors.source_confidence },
  ];
}

function adaptPositioningAngle(a: DocPositioningAngle): PositioningAngleProps {
  return {
    angle_title: a.angle_title,
    suggested_message: a.suggested_message,
    pain_targeted: a.pain_targeted,
    competitor_weakness: a.competitor_weakness,
    competitor_strength_to_respect: a.competitor_strength_to_respect,
    best_channel_or_use_case: a.best_channel_or_use_case,
    risk_warning: a.risk_warning,
    confidence: a.confidence,
    evidence_refs: a.evidence_refs,
  };
}

/**
 * Derive bestAngle: pick the positioning_angle with the highest confidence.score.
 * Returns null when the array is empty.
 */
function deriveBestAngle(angles: DocPositioningAngle[]): BestAngleProps | null {
  if (angles.length === 0) return null;
  const sorted = [...angles].sort(
    (a, b) => b.confidence.score - a.confidence.score,
  );
  const top = sorted[0] as DocPositioningAngle;
  return {
    angle_title: top.angle_title,
    suggested_message: top.suggested_message,
    pain_targeted: top.pain_targeted,
    competitor_weakness: top.competitor_weakness,
    competitor_strength_to_respect: top.competitor_strength_to_respect,
    best_channel_or_use_case: top.best_channel_or_use_case,
    risk_warning: top.risk_warning,
    confidence: top.confidence,
    evidence_refs: top.evidence_refs,
  };
}

/**
 * Normalise objection frequencies from integer counts to 0..1 floats.
 * Each item's frequency becomes frequency / max(all frequencies).
 * When all frequencies are 0 (or the list is empty) they stay at 0.
 */
function normaliseObjectionFrequencies(
  objections: DocObjectionItem[],
): ObjectionProps[] {
  if (objections.length === 0) return [];
  const maxFreq = Math.max(...objections.map((o) => o.frequency));
  return objections.map((o) => ({
    objection_title: o.objection_title,
    objection_type: o.objection_type,
    why_users_hesitate: o.why_users_hesitate,
    frequency: maxFreq > 0 ? o.frequency / maxFreq : 0,
    suggested_response: o.suggested_response,
    confidence: o.confidence,
    evidence_refs: o.evidence_refs,
  }));
}

function adaptCopyItem(c: DocCopyItem): CopyItemProps {
  return {
    copy: c.copy,
    signal_behind_it: c.signal_behind_it,
    best_use_case: c.best_use_case,
    confidence: c.confidence,
    evidence_refs: c.evidence_refs,
  };
}

function adaptCopyIdeas(ci: DocCopyIdeas): CopyIdeasProps {
  return {
    homepage_headlines: ci.homepage_headlines.map(adaptCopyItem),
    subheadlines: ci.subheadlines.map(adaptCopyItem),
    ad_hooks: ci.ad_hooks.map(adaptCopyItem),
    linkedin_hooks: ci.linkedin_hooks.map(adaptCopyItem),
    comparison_page_headlines: ci.comparison_page_headlines.map(adaptCopyItem),
    cta_ideas: ci.cta_ideas.map(adaptCopyItem),
  };
}

function adaptQuoteLibItem(q: DocQuoteLibraryItem): QuoteLibItemProps {
  return {
    quote: q.quote,
    source: q.source,
    source_date: q.source_date,
    sentiment: q.sentiment,
    // Contract has a single signal_type; wrap in a tuple for UI array-iteration.
    signals: [q.signal_type],
    related_positioning_angle: q.related_positioning_angle,
    copy_usefulness_score: q.copy_usefulness_score,
    source_url: q.source_url,
  };
}

// ── Main adapter ──────────────────────────────────────────────────────────────

/**
 * toMarketingViewProps
 *
 * Maps a doc-16 `MarketingViewSection` to `MarketingViewProps`.
 *
 * Key transformations:
 * - score factors object → `{ key, value }[]` (tone/note dropped)
 * - bestAngle derived from positioning_angles sorted by confidence.score desc
 * - language exposes all 5 user_language_bank sub-arrays
 * - objections[].frequency integer → normalised 0..1 share
 * - quoteLib[].signals: contract's single signal_type → `[signal_type]`
 * - Dropped: score.coverage, quoteLib[].score, comparison.chooseThem[]
 */
export function toMarketingViewProps(
  section: MarketingViewSection,
): MarketingViewProps {
  const bank = section.user_language_bank;

  return {
    role: "marketing",
    competitor_id: section.competitor_id,
    generated_at: section.generated_at,

    score: {
      score: section.messaging_opportunity_score.score,
      label: section.messaging_opportunity_score.label,
      explanation: section.messaging_opportunity_score.explanation,
      factors: adaptScoreFactors(section.messaging_opportunity_score.factors),
    },

    messaging_summary: section.messaging_summary,

    language: {
      positive_phrases: bank.positive_phrases.map(adaptPhraseItem),
      negative_phrases: bank.negative_phrases.map(adaptPhraseItem),
      alternative_seeking_phrases: bank.alternative_seeking_phrases.map(adaptPhraseItem),
      emotional_adjectives: bank.emotional_adjectives.map(adaptPhraseItem),
      category_language: bank.category_language.map(adaptPhraseItem),
    },

    bestAngle: deriveBestAngle(section.positioning_angles),

    angles: section.positioning_angles.map(adaptPositioningAngle),

    promiseReality: section.competitor_promise_vs_user_reality.map((r) => ({
      competitor_claim: r.competitor_claim,
      user_reality: r.user_reality,
      gap_summary: r.gap_summary,
      messaging_opportunity: r.messaging_opportunity,
      evidence_count: r.evidence_count,
      evidence_refs: r.evidence_refs,
    })),

    objections: normaliseObjectionFrequencies(section.objections_to_handle),

    // chooseThem[] is intentionally omitted — mock-only, no contract source.
    comparison: {
      hero_angle: section.comparison_page_bullets.hero_angle,
      why_users_look_for_alternatives: section.comparison_page_bullets.why_users_look_for_alternatives,
      where_competitor_is_strong: section.comparison_page_bullets.where_competitor_is_strong,
      where_users_struggle: section.comparison_page_bullets.where_users_struggle,
      who_should_choose_us: section.comparison_page_bullets.who_should_choose_us,
      objections_to_handle: section.comparison_page_bullets.objections_to_handle,
      proof_quotes: section.comparison_page_bullets.proof_quotes,
    },

    copy: adaptCopyIdeas(section.copy_ideas),

    quoteLib: section.quote_library.map(adaptQuoteLibItem),

    evidence_refs: section.evidence_refs,
  };
}
