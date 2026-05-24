/**
 * growth.ts
 *
 * Adapter that converts the doc-16 GrowthViewSection (API contract) into
 * GrowthViewProps (UI-ready shape consumed by <GrowthPage data={...}>).
 *
 * Mapping decisions:
 *  - intent_score (0..1) multiplied by 100 for UI scale.
 *  - urgency contract "research_only" → UI "research".
 *  - budget_sensitivity / technical_maturity "low|medium|high" → "Low|"Medium"|"High".
 *  - community renames: community_name→name, relevant_posts_count→posts,
 *    community_fit_score→fit.
 *  - engagement_level enum is the source of truth; raw int counts are dropped.
 *  - source_date (ISO) → human-relative string via formatRelative().
 *  - topOpportunity derived from switch_intent_feed sorted by intent_score desc, [0].
 *  - Dropped mock-only fields: trends[], score.weeklyDelta, feed[].doNot/feed[].angle
 *    inline panels (belong to suggested_reply_angles), pricingLeads[].quote,
 *    segmentHints[].who.
 */

import { formatRelative } from "@/lib/format";
import type { Confidence, EvidenceRef } from "@/lib/dashboard-helpers";

// ─── Contract types (mirrors doc-16 GrowthViewSection) ───────────────────────

type LowMedHigh = "low" | "medium" | "high";

export type SwitchIntentType =
  | "looking_for_alternative"
  | "pricing_complaint"
  | "migration_question"
  | "tool_recommendation_request"
  | "missing_feature_request"
  | "competitor_frustration"
  | "churn_signal"
  | "what_do_you_use_instead";

export type ConversationPriority = "hot" | "warm" | "research_only";

export type GrowthViewSection = {
  highest_opportunity_summary: string | null;

  switch_intent_score: {
    score: number;
    label: string;
    explanation: string;
    factors: {
      alternative_seeking_posts: number;
      pricing_complaints: number;
      explicit_competitor_frustration: number;
      recency: number;
      engagement_level: number;
      source_quality: number;
    };
  };

  switch_intent_feed: SwitchIntentFeedItemContract[];
  highest_priority_conversations: HighestPriorityConversationContract[];
  pricing_pain_leads: PricingPainLeadContract[];
  communities_to_engage: CommunityToEngageContract[];
  suggested_reply_angles: SuggestedReplyAngleContract[];
  segment_hints: SegmentHintContract[];
  spam_risk_notes: string | null;
  source_links: Array<{ label: string; url: string }>;
  evidence_refs: EvidenceRef;
};

export type SwitchIntentFeedItemContract = {
  id: string;
  source: string;
  title: string;
  user_or_context: string | null;
  source_date: string | null;
  intent_type: SwitchIntentType;
  competitor_mentioned: string | null;
  pain_mentioned: string | null;
  urgency: LowMedHigh;
  engagement_level: LowMedHigh;
  intent_score: number;
  suggested_angle: string | null;
  source_url: string | null;
  evidence_refs: EvidenceRef;
};

export type HighestPriorityConversationContract = {
  priority: ConversationPriority;
  conversation_title: string;
  intent_type: SwitchIntentType;
  pain: string | null;
  source: string;
  source_date: string | null;
  suggested_action: string;
  source_url: string | null;
  evidence_refs: EvidenceRef;
};

export type PricingPainLeadContract = {
  title: string;
  pricing_issue: string;
  plan_limitation: string | null;
  team_size_hint: string | null;
  budget_sensitivity: LowMedHigh;
  alternative_interest: string | null;
  suggested_pricing_angle: string | null;
  source_url: string | null;
  evidence_refs: EvidenceRef;
};

export type CommunityToEngageContract = {
  community_name: string;
  source: string;
  relevant_posts_count: number;
  dominant_pain: string | null;
  engagement_level: LowMedHigh;
  community_fit_score: number;
  recommended_approach: string | null;
  spam_risk: LowMedHigh;
  evidence_refs: EvidenceRef;
};

export type SuggestedReplyAngleContract = {
  related_conversation_id: string;
  context_summary: string;
  what_to_acknowledge: string;
  what_not_to_say: string;
  helpful_reply_angle: string;
  soft_cta_suggestion: string | null;
  spam_risk: LowMedHigh;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

export type SegmentHintContract = {
  role_hint: string | null;
  company_or_team_size_hint: string | null;
  use_case: string | null;
  industry: string | null;
  urgency: LowMedHigh;
  budget_sensitivity: LowMedHigh;
  technical_maturity: LowMedHigh;
  confidence: Confidence;
  evidence_refs: EvidenceRef;
};

// ─── UI-ready props ───────────────────────────────────────────────────────────

/** Urgency values normalised for UI: "research_only" contract → "research" UI. */
export type UiUrgency = "hot" | "warm" | "research";

/** Display tier for budget/maturity enums. */
export type DisplayTier = "Low" | "Medium" | "High";

export type FeedItemProps = {
  id: string;
  source: string;
  title: string;
  userOrContext: string | null;
  /** Human-relative string, e.g. "3h ago". */
  sourceDate: string;
  intentType: SwitchIntentType;
  competitorMentioned: string | null;
  painMentioned: string | null;
  urgency: UiUrgency;
  engagementLevel: LowMedHigh;
  /** 0–100 UI scale (contract 0..1 × 100). */
  intentScore: number;
  suggestedAngle: string | null;
  sourceUrl: string | null;
  evidenceRefs: EvidenceRef;
};

export type PriorityConversationProps = {
  /** "hot" | "warm" | "research" */
  priority: UiUrgency;
  conversationTitle: string;
  intentType: SwitchIntentType;
  pain: string | null;
  source: string;
  sourceDate: string;
  suggestedAction: string;
  sourceUrl: string | null;
  evidenceRefs: EvidenceRef;
};

export type PricingLeadProps = {
  title: string;
  pricingIssue: string;
  planLimitation: string | null;
  teamSizeHint: string | null;
  /** Display string: "Low" | "Medium" | "High". */
  budgetSensitivity: DisplayTier;
  alternativeInterest: string | null;
  suggestedPricingAngle: string | null;
  sourceUrl: string | null;
  evidenceRefs: EvidenceRef;
};

export type CommunityProps = {
  /** Renamed from community_name. */
  name: string;
  source: string;
  /** Renamed from relevant_posts_count. */
  posts: number;
  dominantPain: string | null;
  engagementLevel: LowMedHigh;
  /** Renamed from community_fit_score (0..1). */
  fit: number;
  recommendedApproach: string | null;
  spamRisk: LowMedHigh;
  evidenceRefs: EvidenceRef;
};

export type ReplyAngleProps = {
  /** References FeedItemProps.id. */
  relatedConversationId: string;
  contextSummary: string;
  whatToAcknowledge: string;
  whatNotToSay: string;
  helpfulReplyAngle: string;
  softCtaSuggestion: string | null;
  spamRisk: LowMedHigh;
  confidence: Confidence;
  evidenceRefs: EvidenceRef;
};

export type SegmentHintProps = {
  roleHint: string | null;
  companyOrTeamSizeHint: string | null;
  useCase: string | null;
  industry: string | null;
  urgency: UiUrgency;
  /** Display string: "Low" | "Medium" | "High". */
  budgetSensitivity: DisplayTier;
  /** Display string: "Low" | "Medium" | "High". */
  technicalMaturity: DisplayTier;
  confidence: Confidence;
  evidenceRefs: EvidenceRef;
};

/** The top-ranked feed item by intent_score desc, already mapped to UI shape. */
export type TopOpportunityProps = FeedItemProps;

export type GrowthViewProps = {
  highestOpportunitySummary: string | null;

  switchIntentScore: {
    /** 0–100. */
    score: number;
    label: string;
    explanation: string;
    factors: {
      alternative_seeking_posts: number;
      pricing_complaints: number;
      explicit_competitor_frustration: number;
      recency: number;
      engagement_level: number;
      source_quality: number;
    };
  };

  /** Derived: switch_intent_feed[0] sorted by intent_score desc. */
  topOpportunity: TopOpportunityProps | null;

  feed: FeedItemProps[];
  priority: PriorityConversationProps[];
  pricingLeads: PricingLeadProps[];
  communities: CommunityProps[];
  replyAngles: ReplyAngleProps[];
  segmentHints: SegmentHintProps[];

  spamRiskNotes: string | null;
  sourceLinks: Array<{ label: string; url: string }>;
  evidenceRefs: EvidenceRef;
};

// ─── Normalisation helpers ────────────────────────────────────────────────────

/**
 * Normalise a ConversationPriority value to UiUrgency.
 * "research_only" → "research"; "hot" and "warm" pass through unchanged.
 */
export function normalizeUrgency(v: ConversationPriority): UiUrgency {
  if (v === "research_only") return "research";
  return v;
}

/**
 * Normalise a LowMedHigh urgency value to UiUrgency.
 * Used for feed items and segment hints where the contract emits low|medium|high.
 * Maps: high → hot, medium → warm, low → research.
 */
export function normalizeUrgencyLmh(v: LowMedHigh): UiUrgency {
  if (v === "high") return "hot";
  if (v === "medium") return "warm";
  return "research";
}

/**
 * Map contract enum "low"|"medium"|"high" to UI display strings
 * "Low"|"Medium"|"High".
 */
export function toDisplayTier(v: LowMedHigh): DisplayTier {
  const map: Record<LowMedHigh, DisplayTier> = {
    low: "Low",
    medium: "Medium",
    high: "High",
  };
  return map[v];
}

// ─── Feed item mapper ─────────────────────────────────────────────────────────

function mapFeedItem(item: SwitchIntentFeedItemContract): FeedItemProps {
  return {
    id: item.id,
    source: item.source,
    title: item.title,
    userOrContext: item.user_or_context,
    sourceDate: formatRelative(item.source_date),
    intentType: item.intent_type,
    competitorMentioned: item.competitor_mentioned,
    painMentioned: item.pain_mentioned,
    urgency: normalizeUrgencyLmh(item.urgency),
    engagementLevel: item.engagement_level,
    intentScore: Math.round(item.intent_score * 100),
    suggestedAngle: item.suggested_angle,
    sourceUrl: item.source_url,
    evidenceRefs: item.evidence_refs,
  };
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Convert a doc-16 GrowthViewSection (as stored in report_role_sections.data)
 * into GrowthViewProps ready for <GrowthPage data={...}>.
 */
export function toGrowthViewProps(section: GrowthViewSection): GrowthViewProps {
  const mappedFeed = section.switch_intent_feed.map(mapFeedItem);

  // Derive topOpportunity from the feed item with the highest intent_score.
  // Sort descending; pick first.
  const sortedFeed = [...section.switch_intent_feed].sort(
    (a, b) => b.intent_score - a.intent_score,
  );
  const topRaw = sortedFeed[0] ?? null;
  const topOpportunity = topRaw !== null ? mapFeedItem(topRaw) : null;

  const priority: PriorityConversationProps[] =
    section.highest_priority_conversations.map((c) => ({
      priority: normalizeUrgency(c.priority),
      conversationTitle: c.conversation_title,
      intentType: c.intent_type,
      pain: c.pain,
      source: c.source,
      sourceDate: formatRelative(c.source_date),
      suggestedAction: c.suggested_action,
      sourceUrl: c.source_url,
      evidenceRefs: c.evidence_refs,
    }));

  const pricingLeads: PricingLeadProps[] = section.pricing_pain_leads.map(
    (l) => ({
      title: l.title,
      pricingIssue: l.pricing_issue,
      planLimitation: l.plan_limitation,
      teamSizeHint: l.team_size_hint,
      budgetSensitivity: toDisplayTier(l.budget_sensitivity),
      alternativeInterest: l.alternative_interest,
      suggestedPricingAngle: l.suggested_pricing_angle,
      sourceUrl: l.source_url,
      evidenceRefs: l.evidence_refs,
    }),
  );

  const communities: CommunityProps[] = section.communities_to_engage.map(
    (c) => ({
      name: c.community_name,
      source: c.source,
      posts: c.relevant_posts_count,
      dominantPain: c.dominant_pain,
      engagementLevel: c.engagement_level,
      fit: c.community_fit_score,
      recommendedApproach: c.recommended_approach,
      spamRisk: c.spam_risk,
      evidenceRefs: c.evidence_refs,
    }),
  );

  const replyAngles: ReplyAngleProps[] = section.suggested_reply_angles.map(
    (r) => ({
      relatedConversationId: r.related_conversation_id,
      contextSummary: r.context_summary,
      whatToAcknowledge: r.what_to_acknowledge,
      whatNotToSay: r.what_not_to_say,
      helpfulReplyAngle: r.helpful_reply_angle,
      softCtaSuggestion: r.soft_cta_suggestion,
      spamRisk: r.spam_risk,
      confidence: r.confidence,
      evidenceRefs: r.evidence_refs,
    }),
  );

  const segmentHints: SegmentHintProps[] = section.segment_hints.map((s) => ({
    roleHint: s.role_hint,
    companyOrTeamSizeHint: s.company_or_team_size_hint,
    useCase: s.use_case,
    industry: s.industry,
    urgency: normalizeUrgencyLmh(s.urgency),
    budgetSensitivity: toDisplayTier(s.budget_sensitivity),
    technicalMaturity: toDisplayTier(s.technical_maturity),
    confidence: s.confidence,
    evidenceRefs: s.evidence_refs,
  }));

  return {
    highestOpportunitySummary: section.highest_opportunity_summary,

    switchIntentScore: {
      score: section.switch_intent_score.score,
      label: section.switch_intent_score.label,
      explanation: section.switch_intent_score.explanation,
      factors: section.switch_intent_score.factors,
    },

    topOpportunity,
    feed: mappedFeed,
    priority,
    pricingLeads,
    communities,
    replyAngles,
    segmentHints,

    spamRiskNotes: section.spam_risk_notes,
    sourceLinks: section.source_links,
    evidenceRefs: section.evidence_refs,
  };
}
