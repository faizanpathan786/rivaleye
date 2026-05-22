import type { PlatformExtract, StageAExtract } from "../prompts/shared";

export function emptyStageAExtract(): StageAExtract {
  return {
    love_signals: [],
    pain_signals: [],
    gap_signals: [],
    switch_signals: [],
    pricing_signals: [],
    feature_signals: [],
    positioning_signals: [],
    voice_phrases: { positive: [], negative: [] },
    evidence_quotes: [],
  };
}

export function mergeStageAExtracts(extracts: StageAExtract[]): StageAExtract {
  return {
    love_signals: extracts.flatMap((e) => e.love_signals),
    pain_signals: extracts.flatMap((e) => e.pain_signals),
    gap_signals: extracts.flatMap((e) => e.gap_signals),
    switch_signals: extracts.flatMap((e) => e.switch_signals),
    pricing_signals: extracts.flatMap((e) => e.pricing_signals),
    feature_signals: extracts.flatMap((e) => e.feature_signals),
    positioning_signals: extracts.flatMap((e) => e.positioning_signals),
    voice_phrases: {
      positive: extracts.flatMap((e) => e.voice_phrases.positive),
      negative: extracts.flatMap((e) => e.voice_phrases.negative),
    },
    evidence_quotes: extracts.flatMap((e) => e.evidence_quotes),
  };
}

export function toLegacyExtract(e: StageAExtract): PlatformExtract {
  return {
    complaints: e.pain_signals.map((s) => ({
      text: s.summary,
      severity: s.strength_or_severity,
      evidence_ids: s.evidence_ids,
    })),
    features_requested: e.gap_signals.map((s) => ({
      feature: s.title,
      evidence_ids: s.evidence_ids,
    })),
    pricing_signals: e.pricing_signals.map((s) => ({
      note: s.summary,
      evidence_ids: s.evidence_ids,
    })),
    switching_signals: e.switch_signals.map((s) => ({
      direction: s.direction,
      competitor: s.alternatives_mentioned.find((a) => a.length > 0) ?? s.title,
      evidence_ids: s.evidence_ids,
    })),
    voice_phrases: {
      positive: e.voice_phrases.positive,
      negative: e.voice_phrases.negative,
    },
    notable_quotes: e.evidence_quotes.map((q) => ({
      author: q.author,
      text: q.text,
      evidence_id: q.evidence_id,
    })),
  };
}
