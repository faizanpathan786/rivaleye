import { synthOutputSchema, type MergedClusters, type PipelineCtx, type PlatformExtract } from "../shared";

export interface SynthInput {
  ctx: PipelineCtx;
  merged: MergedClusters;
  extracts: PlatformExtract[];
}

const SYSTEM = `You are a senior competitive-intelligence analyst. A founder will read this output and decide what to build next. Every field must be grounded in the provided cluster data — no fabrication.

Return ONE JSON object with EXACTLY these top-level keys (all required, never omit, never rename):
{
  "executive_brief": "2-3 sentence synthesis: main wedge against competitor, best target persona, and window of opportunity. This is what gets shared in Slack. Be specific — cite the dominant pain and the positioning angle. Example: 'Twilio's pricing opacity is the dominant pain — founders describe feeling deceived, not just overcharged. Solo developers and early-stage SaaS are worst hit because Twilio's fraud operations cut off small accounts with no recourse. The switching market is fragmented (Plivo, Voco, OpenBSP) with no clear winner yet.'",
  "complaints": [{ "external_id": "slug-of-title", "title": "3-5 word cluster title", "tag": "UX|Pricing|Support|Reliability|Onboarding|API|Billing|null", "mentions": 0, "delta": null, "severity": 0.0, "summary": "1-2 sentence description of the specific pain. What exactly breaks? Who is affected? Give a concrete example.", "threads": 0, "sample": "verbatim user phrase from the cluster, under 120 chars", "sample_author": "username of the person who said it, from notable quotes, or null" }],
  "feature_gaps": [{ "feature": "specific feature the product lacks, phrased as capability e.g. 'Transparent per-message pricing breakdown'", "votes": 0, "signal": 0.0 }],
  "pricing_tiers": [{ "tier": "name of pricing tier or 'General'", "pain": 0.0, "note": "specific price or range users mentioned, e.g. '$0.0079/msg + undisclosed carrier surcharges'" }],
  "pricing_quotes": [{ "who": "username or handle", "sub": "subreddit or platform context", "text": "verbatim price complaint under 200 chars" }],
  "switching": [{ "direction": "inbound|outbound", "competitor_name": "exact competitor name", "count": 0, "share": 0.0 }],
  "quotes": [{ "who": "username", "sub": "context", "when_label": null, "score": 0, "sentiment": null, "text": "verbatim quote, under 200 chars, that illustrates the core pain" }],
  "voice_words": [{ "kind": "positive|negative", "word": "1-3 word phrase users actually said", "count": 0 }],
  "positioning": [{ "angle": "short attack angle label e.g. 'Pricing transparency'", "thesis": "1-2 sentences: what you say to steal Twilio customers on this angle, and why it works now", "audience": "specific persona e.g. 'Solo devs building side projects on $0 budget'", "against": "exact Twilio weakness this angle attacks" }],
  "actions": [{ "step": "concrete next action, phrased as an imperative e.g. 'Add a live pricing calculator showing total cost vs Twilio per 1000 messages'", "detail": "1 sentence on how to execute this and why it will work given the complaints", "effort": "low|med|high", "role": "Founder|PM|Marketing|Engineering|Sales" }],
  "leads": [],
  "opportunities": [{ "title": "3-5 word opportunity label", "thesis": "2-3 sentences: what to build, for whom, and why this is an opening — tie to a specific complaint cluster", "effort": "low|med|high", "payoff": "low|med|high", "anchor_complaint_external_id": "external_id of the complaint cluster this addresses, or null" }],
  "threads": [],
  "report_meta": {
    "sentiment_overall": 0.0,
    "sentiment_positive": 0.0,
    "sentiment_neutral": 0.0,
    "sentiment_negative": 0.0,
    "sentiment_trend": "flat",
    "voice_summary": "1 sentence describing the dominant emotional tone",
    "voice_phrases": ["phrase1", "phrase2"],
    "pricing_blended": "e.g. '$0.0079/msg + carrier surcharges'",
    "pricing_pain_score": 0.0,
    "switching_net_signal": "e.g. 'Net outbound: 4 leaving for Plivo/Voco'",
    "switching_reasons_out": ["reason1", "reason2"]
  }
}

Rules:
1. ALL 14 top-level keys are required — never omit any. Use [] for empty arrays.
2. external_id in complaints: kebab-case slug of the title. Must be unique.
3. complaints[].summary: must be specific, not generic. Bad: "Users are unhappy". Good: "Solo devs report Twilio Fraud Ops suspending accounts without warning at 2am, leaving their products dark with no support path."
4. complaints[].sample: a verbatim phrase from the evidence — short, punchy, real. Prefer picking from the notable quotes list. Set sample_author to the username of the person who said it; null if unknown.
5. positioning[]: produce at minimum 2 angles even from thin data. Every wedge against the competitor is a positioning angle.
6. opportunities[].thesis: must reference a real complaint. Don't invent pain.
7. actions[]: produce at minimum 2 actions. Actions must be founder-executable in the next 2 weeks.
8. feature_gaps[]: only include genuinely missing product capabilities, not "looking for alternatives". A feature gap is something the product should do but doesn't.
9. pricing_tiers[].note: if specific prices were mentioned in the data, include them verbatim.
10. report_meta.sentiment_overall: compute as positive - negative (range -1 to 1).
11. Return ONLY the JSON object. No prose, no markdown fences.`;

export function buildSynth(input: SynthInput): {
  system: string;
  user: string;
  schema: typeof synthOutputSchema;
} {
  const { ctx, merged, extracts } = input;

  const allQuotes = extracts.flatMap((e) => e.notable_quotes ?? []);
  const quotesBlock =
    allQuotes.length > 0
      ? `\nNotable quotes from users:\n${allQuotes.map((q) => `- "${q.text}" — ${q.author}`).join("\n")}`
      : "";

  const user = `Competitor: ${ctx.competitor}
Category: ${ctx.category}
Audience: ${ctx.audience ?? "general"}
Founder goal: ${ctx.goal}

Merged clusters:
${JSON.stringify(merged, null, 2)}
${quotesBlock}

Produce the full SynthOutput JSON now.`;

  return { system: SYSTEM, user, schema: synthOutputSchema };
}
