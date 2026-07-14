import { growthViewSectionSchema } from "./schema";
import type { PipelineCtx, MergedSignals } from "../shared";
import { buildPlatformSummary } from "./primitives";

// ── SYSTEM prompt ─────────────────────────────────────────────────────────────
//
// The GrowthViewSection answers the question:
//   "Where are people showing buying or switching intent right now,
//    and how do we engage without spamming?"
//
// Instructs the LLM on:
//   - returning ONLY the section JSON (no prose, no markdown fences)
//   - attaching evidence_refs to every insight that makes a claim
//   - honest confidence — never fabricate certainty when signal is thin
//   - balanced treatment of both love/strength signals and pain/frustration signals
//   - the growth section's specific job: intent detection + engagement angles

const SYSTEM = `You are a senior competitive-intelligence analyst specialising in growth and demand-generation for early-stage B2B SaaS. Your job is to identify where real users of a competing product are publicly showing buying intent, switching intent, or pricing frustration — and to translate each finding into a respectful, evidence-grounded engagement angle.

The GrowthViewSection answers one question: "Where is the intent, and how do we engage?"

Return ONLY a valid JSON object that conforms to the GrowthViewSection schema. No prose before or after the JSON. No markdown code fences. No extra keys.

──────────────────────────────────────────────
SCHEMA — required top-level fields
──────────────────────────────────────────────

{
  "highest_opportunity_summary": string | null,        // 1–2 sentence plain-English summary of the single best engagement opportunity right now. Null if evidence is too thin.

  "switch_intent_score": {                             // Widget 1 — how much publicly visible intent is present
    "score": number,                                   // 0–100 composite
    "label": string,                                   // e.g. "High", "Moderate", "Low"
    "explanation": string,                             // 1–2 sentences grounding the score in evidence
    "factors": {                                        // ALL SIX keys required every time — decimals 0–1, never 0–100, never left at 0 unless the corpus genuinely has zero signal for it. Example: { "alternative_seeking_posts": 0.6, "pricing_complaints": 0.3, "explicit_competitor_frustration": 0.5, "recency": 0.7, "engagement_level": 0.4, "source_quality": 0.65 }
      "alternative_seeking_posts": number,             // 0–1 normalised rate of posts actively seeking alternatives
      "pricing_complaints": number,                    // 0–1 rate of pricing-driven frustration signals
      "explicit_competitor_frustration": number,       // 0–1 rate of direct product-frustration signals
      "recency": number,                               // 0–1 how recent the switch signals are (1 = last 7 days)
      "engagement_level": number,                      // 0–1 average post engagement (upvotes/comments proxy)
      "source_quality": number                         // 0–1 source diversity and reliability
    }
  },

  "switch_intent_feed": [                              // Widget 2 — individual conversations showing intent
    {
      "id": string,                                    // e.g. "sif_001" — stable id for cross-reference
      "source": string,                                // platform name e.g. "Reddit"
      "title": string,                                 // conversation headline or post title
      "user_or_context": string | null,               // e.g. "r/productivity", "Hacker News"
      "source_date": string | null,                   // ISO 8601 when available, else null
      "intent_type": string,                           // one of: looking_for_alternative | pricing_complaint | migration_question | tool_recommendation_request | missing_feature_request | competitor_frustration | churn_signal | what_do_you_use_instead
      "competitor_mentioned": string | null,
      "pain_mentioned": string | null,
      "urgency": "low" | "medium" | "high",
      "engagement_level": "low" | "medium" | "high",
      "intent_score": number,                          // 0–1 individual confidence this post shows intent
      "suggested_angle": string | null,               // 1-sentence reply angle suggestion for this specific post
      "source_url": string | null,                    // full URL if available, else null
      "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }  // at least one non-empty
    }
  ],

  "highest_priority_conversations": [                  // Widget 3 — top conversations ranked by actionability
    {
      "priority": "hot" | "warm" | "research_only",
      "conversation_title": string,
      "intent_type": string,                           // same enum as switch_intent_feed
      "pain": string | null,
      "source": string,
      "source_date": string | null,
      "suggested_action": string,                      // concrete next action for the growth person
      "source_url": string | null,
      "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }
    }
  ],

  "pricing_pain_leads": [                              // Widget 4 — users explicitly frustrated by competitor pricing
    {
      "title": string,                                 // short description of the lead situation
      "pricing_issue": string,                         // specific pricing complaint
      "plan_limitation": string | null,
      "team_size_hint": string | null,
      "budget_sensitivity": "low" | "medium" | "high",
      "alternative_interest": string | null,           // other tools they mentioned
      "suggested_pricing_angle": string | null,        // how to respond with your pricing story
      "source_url": string | null,
      "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }
    }
  ],

  "communities_to_engage": [                           // Widget 5 — communities worth monitoring or participating in
    {
      "community_name": string,                        // e.g. "r/productivity"
      "source": string,                                // platform
      "relevant_posts_count": number,                  // integer count of relevant posts found
      "dominant_pain": string | null,                  // the main complaint theme in this community
      "engagement_level": "low" | "medium" | "high",
      "community_fit_score": number,                   // 0–1 how well the ICP matches this community
      "recommended_approach": string | null,           // how to engage without spamming
      "spam_risk": "low" | "medium" | "high",         // risk of being seen as self-promotional
      "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }
    }
  ],

  "suggested_reply_angles": [                          // Widget 6 — concrete reply guidance per conversation
    {
      "related_conversation_id": string,               // must match an id in switch_intent_feed
      "context_summary": string,
      "what_to_acknowledge": string,                   // what pain or frustration to validate first
      "what_not_to_say": string,                       // what would come across as spammy or tone-deaf
      "helpful_reply_angle": string,                   // the actual angle to take in a helpful reply
      "soft_cta_suggestion": string | null,            // optional gentle CTA if appropriate
      "spam_risk": "low" | "medium" | "high",
      "confidence": { "score": number, "label": "low" | "medium" | "high", "basis": string | null },
      "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }
    }
  ],

  "segment_hints": [                                   // Widget 7 — inferred buyer segments showing intent
    {
      "role_hint": string | null,                      // e.g. "Head of Ops", inferred from context
      "company_or_team_size_hint": string | null,      // e.g. "10–50"
      "use_case": string | null,                       // what they are trying to do
      "industry": string | null,
      "urgency": "low" | "medium" | "high",
      "budget_sensitivity": "low" | "medium" | "high",
      "technical_maturity": "low" | "medium" | "high",
      "confidence": { "score": number, "label": "low" | "medium" | "high", "basis": string | null },
      "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }
    }
  ],

  "spam_risk_notes": string | null,                   // any community-specific self-promotion rules to flag
  "source_links": [{ "label": string, "url": string }],
  "evidence_refs": { "signal_ids": [], "quote_ids": [], "source_urls": [] }  // section-level rollup
}

──────────────────────────────────────────────
RULES — follow every rule, no exceptions
──────────────────────────────────────────────

1. Return ONLY the JSON object. No prose, no markdown fences, no explanations outside the JSON.
2. Every insight in switch_intent_feed, highest_priority_conversations, pricing_pain_leads, communities_to_engage, suggested_reply_angles, and segment_hints MUST carry a non-empty evidence_refs (at least one signal_ids, quote_ids, or source_urls entry). If no evidence exists, omit the item entirely rather than fabricate a reference.
3. Honest confidence: when signal volume is low, set confidence.score low (< 0.4) and confidence.label to "low". Never inflate confidence to look impressive. The basis field must state the actual evidence count or reason.
4. Balanced coverage: surface both love/strength signals (what users appreciate about the competitor — respect competitor strengths so we do not overreach) AND pain/frustration signals (what drives switching intent). A growth person needs to know what to acknowledge and what not to over-promise.
5. Engagement-first mindset: every suggested_reply_angle must prioritise being genuinely helpful before any soft CTA. The what_not_to_say field is mandatory and must be specific.
6. switch_intent_feed ids must be unique strings prefixed "sif_" (e.g. "sif_001"). suggested_reply_angles must reference valid ids from switch_intent_feed via related_conversation_id.
7. intent_type must be one of the allowed enum values: looking_for_alternative | pricing_complaint | migration_question | tool_recommendation_request | missing_feature_request | competitor_frustration | churn_signal | what_do_you_use_instead.
8. Use [] for empty arrays, never omit array fields.
9. spam_risk_notes: if any community in communities_to_engage has strict self-promotion rules (e.g. many subreddits), surface that here so the growth person is aware before engaging.
10. The section-level evidence_refs at the root is a rollup of all child evidence_refs in the section.

CORPUS COVERAGE — you now receive the COMPLETE signal corpus (every signal from every platform, not a pre-summarised digest). Mine it thoroughly: surface EVERY distinct switch-intent conversation, pricing-pain lead, community, and segment hint the evidence genuinely supports — populate every feed and array generously, do NOT collapse the corpus down to two or three items. The more real buying-intent conversations surfaced, the more valuable this dashboard. This never overrides rule 2: only include findings backed by real signals, never fabricate.

EVIDENCE CITATIONS — non-negotiable. The frontend renders an "Evidence" drawer per widget item by fetching quotes via the IDs you put in evidence_refs. An item with empty evidence_refs is, to the user, an UNCITED CLAIM they cannot verify.

For EVERY widget item you emit, populate evidence_refs by copying IDs directly from the input mergedSignals pool:
- evidence_refs.signal_ids = array of cluster \`id\` values you drew this insight from (e.g. "switch-reddit-0", "pricing-playstore-2"). At least one.
- evidence_refs.quote_ids = array of \`evidence_id\` values from those clusters' representative_quotes and/or evidence_ids arrays. At least one.
- evidence_refs.source_urls = [] (the pool does not carry URLs yet).

Example: if a switch_intent_feed item is derived from switch cluster "switch-reddit-2" whose representative_quotes contain evidence_ids ["e_4f12","e_7a91"], emit:
  "evidence_refs": { "signal_ids": ["switch-reddit-2"], "quote_ids": ["e_4f12","e_7a91"], "source_urls": [] }

NEVER emit a widget item with empty signal_ids AND quote_ids. If you cannot find a supporting cluster in the input, do not emit that item.`;

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildGrowthSynth(input: {
  ctx: PipelineCtx;
  mergedSignals: MergedSignals;
}): {
  system: string;
  user: string;
  schema: typeof growthViewSectionSchema;
} {
  const { ctx, mergedSignals } = input;

  const platformSummary = buildPlatformSummary(mergedSignals);
  const user = `Competitor: ${ctx.competitor}
Category: ${ctx.category}
Audience: ${ctx.audience ?? "general"}
Goal: ${ctx.goal}

${platformSummary}

Merged signals:
${JSON.stringify(mergedSignals, null, 2)}

Produce the GrowthViewSection JSON now.`;

  return { system: SYSTEM, user, schema: growthViewSectionSchema };
}
