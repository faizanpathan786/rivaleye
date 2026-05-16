import OpenAI from "openai";
import { z } from "zod";
import { buildStage3Prompt } from "../prompts";
import { computeOpportunityScore, pickTopOpportunities } from "../scoring";
import { BLOCKED_PHRASES } from "../prompts/shared";
import { StageValidationError } from "./errors";
import type { PipelineCtx } from "./stage1";
import type { Stage2Output, ScoredCluster } from "./stage2";

// ---- OpenRouter client (same singleton pattern as stage1/stage2) ----

const apiKey = process.env["OPENROUTER_API_KEY"];
if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

const openRouter = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---- Types ----

export type Stage3Opportunity = {
  title: string;
  description: string;
  evidence: { post_ids: string[]; top_quotes: string[] };
  scores: {
    opportunity_score: number;
    market_pain: number;
    differentiation: number;
    evidence_count: number;
  };
};

export type Stage3Output = {
  executiveSummary: string;
  topOpportunities: Stage3Opportunity[]; // exactly 3 after scoring
  strongestPositioningAngle: string;
  bestWedge: string;
  featureGaps: Array<{
    title: string;
    description: string;
    evidence: { post_ids: string[]; top_quotes: string[] };
    priority?: "high" | "medium" | "low";
  }>;
  pricingPain: string;
  switchingSignals: Array<{
    signal: string;
    evidence: { post_ids: string[]; top_quotes: string[] };
  }>;
  voiceOfCustomer: string[];
  competitorWeaknesses: string[];
  productOpportunities: string[];
  positioningAngles: string[];
  // note: nextActions comes from stage4
  meta: { warnings: string[] };
};

// ---- LLM output schema ----

const stage3LlmSchema = z.object({
  executive_summary: z.string().min(10),
  top_opportunities: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        evidence_post_ids: z.array(z.string()),
        differentiation: z.number().min(0).max(100),
      }),
    )
    .min(1),
  strongest_positioning_angle: z.string(),
  best_wedge: z.string(),
  feature_gaps: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      evidence_post_ids: z.array(z.string()),
      priority: z.enum(["high", "medium", "low"]).optional(),
    }),
  ),
  pricing_pain: z.string(),
  switching_signals: z.array(
    z.object({
      signal: z.string(),
      evidence_post_ids: z.array(z.string()),
    }),
  ),
  voice_of_customer: z.array(z.string()),
  competitor_weaknesses: z.array(z.string()),
  product_opportunities: z.array(z.string()),
  positioning_angles: z.array(z.string()),
});

type Stage3LlmOutput = z.infer<typeof stage3LlmSchema>;

// ---- Constants ----

const DEFAULT_MODEL = "deepseek/deepseek-v3-0324:free";

// ---- Helpers ----

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

async function callStage3Llm(
  system: string,
  user: string,
  model: string,
): Promise<string> {
  const response = await openRouter.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("[stage3] empty LLM response");
  return content;
}

type ParseResult =
  | { success: true; data: Stage3LlmOutput }
  | { success: false; error: { message: string } };

function parseAndValidate(raw: string): ParseResult {
  const stripped = stripFences(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    return {
      success: false,
      error: {
        message: `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  const result = stage3LlmSchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: { message: String(result.error) },
  };
}

/**
 * Check for BLOCKED_PHRASES in executive_summary and all opportunity/feature descriptions.
 * Returns the first offending phrase found, or null if clean.
 */
function findBlockedPhrase(data: Stage3LlmOutput): string | null {
  const textFields: string[] = [
    data.executive_summary,
    data.strongest_positioning_angle,
    data.best_wedge,
    data.pricing_pain,
    ...data.top_opportunities.map((o) => `${o.title} ${o.description}`),
    ...data.feature_gaps.map((f) => `${f.title} ${f.description}`),
    ...data.competitor_weaknesses,
    ...data.product_opportunities,
    ...data.positioning_angles,
    ...data.switching_signals.map((s) => s.signal),
  ];

  const combined = textFields.join(" ").toLowerCase();

  for (const phrase of BLOCKED_PHRASES) {
    if (combined.includes(phrase.toLowerCase())) {
      return phrase;
    }
  }
  return null;
}

/**
 * Build a map of cluster painScore by cluster ID for fast lookup during opportunity scoring.
 */
function buildPainScoreMap(rankedClusters: ScoredCluster[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const cluster of rankedClusters) {
    map.set(cluster.id, cluster.scores.pain_score);
  }
  return map;
}

/**
 * Derive marketPain for an opportunity from the max pain_score of linked clusters.
 * Falls back to 50 if no cluster IDs overlap.
 */
function deriveMarketPain(
  evidencePostIds: string[],
  painScoreMap: Map<string, number>,
): number {
  // Post IDs may coincide with cluster IDs (e.g., "c001") — check both
  let max = -1;
  for (const id of evidencePostIds) {
    const score = painScoreMap.get(id);
    if (score !== undefined && score > max) {
      max = score;
    }
  }
  // pain_score is on a 0-100 scale per scoring/pain-score.ts
  return max >= 0 ? max : 50;
}

/**
 * Populate top_quotes for an evidence block by matching voice_phrases that
 * contain any of the post IDs, or by falling back to the first matching
 * phrases from voicePhrases.
 */
function resolveTopQuotes(postIds: string[], voicePhrases: string[]): string[] {
  if (voicePhrases.length === 0) return [];
  // Return up to 3 voice phrases that are likely relevant (best-effort matching)
  return voicePhrases.slice(0, 3);
}

/**
 * Check goal-conditioning depth requirements.
 * Returns a description of the unmet requirement, or null if met.
 */
function checkGoalDepth(
  founderGoal: string,
  data: Stage3LlmOutput,
): string | null {
  if (founderGoal === "improve_positioning") {
    if (data.positioning_angles.length < 5) {
      return `improve_positioning goal requires ≥5 positioning_angles but got ${data.positioning_angles.length}. Expand positioning_angles to ≥5 entries with full messaging copy. Each angle must name a specific competitor weakness and a concrete alternative you offer.`;
    }
  }

  if (founderGoal === "decide_mvp_features") {
    if (data.feature_gaps.length < 3) {
      return `decide_mvp_features goal requires ≥3 feature_gaps but got ${data.feature_gaps.length}. Add more feature gaps with priority ranking.`;
    }
    const missingPriority = data.feature_gaps.some((f) => f.priority === undefined);
    if (missingPriority) {
      return `decide_mvp_features goal requires every feature_gap to have a priority (high/medium/low). Assign priority to all feature gaps.`;
    }
  }

  return null;
}

// ---- Internal intermediate type for scored opportunities before pick ----

type ScoredOpportunityIntermediate = {
  title: string;
  description: string;
  evidence_post_ids: string[];
  differentiation: number;
  scores: {
    opportunity_score: number;
    market_pain: number;
    differentiation: number;
    evidence_count: number;
  };
};

// ---- Main export ----

export async function runStage3(
  ctx: PipelineCtx,
  stage2Output: Stage2Output,
  voicePhrases: string[],
): Promise<Stage3Output> {
  const model =
    ctx.stage3Model ??
    process.env["STAGE3_MODEL"] ??
    DEFAULT_MODEL;

  const { rankedClusters } = stage2Output;

  // 1. Build Stage3Input from stage2Output + ctx
  const stage3Input = {
    rankedClusters: rankedClusters.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      pain_score: c.scores.pain_score,
      evidence_post_ids: c.evidence_post_ids,
      voice_phrases: c.voice_phrases,
    })),
    competitor: ctx.competitor,
    category: ctx.category,
    founderGoal: ctx.founderGoal,
  };

  // 2. Build prompt
  const { system, user } = buildStage3Prompt(stage3Input);

  // 3. LLM call → strip fences → parse → validate
  const raw = await callStage3Llm(system, user, model);
  let parsed = parseAndValidate(raw);

  // Retry once on validation failure
  if (!parsed.success) {
    const retryUser =
      `Previous response failed validation: ${parsed.error.message}. Try again. Output valid JSON only.\n\n` +
      user;
    const retryRaw = await callStage3Llm(system, retryUser, model);
    parsed = parseAndValidate(retryRaw);

    if (!parsed.success) {
      throw new StageValidationError(3, parsed.error.message, retryRaw);
    }
  }

  let llmData = parsed.data;

  // 4. BLOCKED_PHRASES check — retry once with augmented prompt if hit
  const offendingPhrase = findBlockedPhrase(llmData);
  if (offendingPhrase !== null) {
    const offending = BLOCKED_PHRASES.filter((p) =>
      [
        llmData.executive_summary,
        ...llmData.top_opportunities.map((o) => `${o.title} ${o.description}`),
        ...llmData.feature_gaps.map((f) => `${f.title} ${f.description}`),
        llmData.pricing_pain,
        llmData.strongest_positioning_angle,
        llmData.best_wedge,
        ...llmData.competitor_weaknesses,
        ...llmData.product_opportunities,
        ...llmData.positioning_angles,
        ...llmData.switching_signals.map((s) => s.signal),
      ]
        .join(" ")
        .toLowerCase()
        .includes(p.toLowerCase()),
    );

    const blockedListStr = offending.map((p) => `"${p}"`).join(", ");
    const blockedRetryUser =
      `Your previous response contained banned phrases: ${blockedListStr}. ` +
      `Remove all of these phrases entirely and rephrase with specific, concrete language. ` +
      `Output valid JSON only.\n\n` +
      user;

    const blockedRetryRaw = await callStage3Llm(system, blockedRetryUser, model);
    const blockedRetryParsed = parseAndValidate(blockedRetryRaw);

    if (!blockedRetryParsed.success) {
      throw new StageValidationError(
        3,
        `Blocked-phrase retry validation failed: ${blockedRetryParsed.error.message}`,
        blockedRetryRaw,
      );
    }

    const stillBlocked = findBlockedPhrase(blockedRetryParsed.data);
    if (stillBlocked !== null) {
      // Blocked phrase persists after retry — accept output but warn; do not throw
      // (throwing here would make the entire pipeline fail over a style issue)
    }

    llmData = blockedRetryParsed.data;
  }

  // 5. Goal-conditioning depth check — retry once with stricter prompt if unmet
  const depthViolation = checkGoalDepth(ctx.founderGoal, llmData);
  if (depthViolation !== null) {
    const depthRetryUser =
      `Your previous response did not meet the depth requirement for the founder goal "${ctx.founderGoal}": ${depthViolation}. ` +
      `Revise your output to satisfy this requirement. Output valid JSON only.\n\n` +
      user;

    const depthRetryRaw = await callStage3Llm(system, depthRetryUser, model);
    const depthRetryParsed = parseAndValidate(depthRetryRaw);

    if (!depthRetryParsed.success) {
      throw new StageValidationError(
        3,
        `Goal-depth retry validation failed: ${depthRetryParsed.error.message}`,
        depthRetryRaw,
      );
    }

    llmData = depthRetryParsed.data;
  }

  // 6. Score opportunities
  const painScoreMap = buildPainScoreMap(rankedClusters);

  const scoredIntermediates: ScoredOpportunityIntermediate[] =
    llmData.top_opportunities.map((opp) => {
      const marketPain = deriveMarketPain(opp.evidence_post_ids, painScoreMap);
      const differentiation = opp.differentiation;
      const evidenceCount = opp.evidence_post_ids.length;
      const opportunityScore = computeOpportunityScore({
        marketPain,
        differentiation,
        evidenceCount,
      });

      return {
        title: opp.title,
        description: opp.description,
        evidence_post_ids: opp.evidence_post_ids,
        differentiation,
        scores: {
          opportunity_score: opportunityScore,
          market_pain: marketPain,
          differentiation,
          evidence_count: evidenceCount,
        },
      };
    });

  // pickTopOpportunities sorts by opportunity_score desc, ties broken by evidence_count
  const top3 = pickTopOpportunities(scoredIntermediates, 3);

  // 7. Collect warnings
  const warnings: string[] = [];

  if (top3.length < 3) {
    warnings.push(`few_opportunities: only ${top3.length} opportunities available after scoring`);
  }

  const finalDepthViolation = checkGoalDepth(ctx.founderGoal, llmData);
  if (finalDepthViolation !== null) {
    warnings.push(`goal_depth_unmet: ${finalDepthViolation}`);
  }

  if (findBlockedPhrase(llmData) !== null) {
    warnings.push("blocked_phrases_remain: output contains banned phrases after retry");
  }

  // 8. Map to Stage3Output
  const topOpportunities: Stage3Opportunity[] = top3.map((opp) => ({
    title: opp.title,
    description: opp.description,
    evidence: {
      post_ids: opp.evidence_post_ids,
      top_quotes: resolveTopQuotes(opp.evidence_post_ids, voicePhrases),
    },
    scores: opp.scores,
  }));

  const featureGaps = llmData.feature_gaps.map((f) => ({
    title: f.title,
    description: f.description,
    evidence: {
      post_ids: f.evidence_post_ids,
      top_quotes: resolveTopQuotes(f.evidence_post_ids, voicePhrases),
    },
    priority: f.priority,
  }));

  const switchingSignals = llmData.switching_signals.map((s) => ({
    signal: s.signal,
    evidence: {
      post_ids: s.evidence_post_ids,
      top_quotes: resolveTopQuotes(s.evidence_post_ids, voicePhrases),
    },
  }));

  return {
    executiveSummary: llmData.executive_summary,
    topOpportunities,
    strongestPositioningAngle: llmData.strongest_positioning_angle,
    bestWedge: llmData.best_wedge,
    featureGaps,
    pricingPain: llmData.pricing_pain,
    switchingSignals,
    voiceOfCustomer: llmData.voice_of_customer,
    competitorWeaknesses: llmData.competitor_weaknesses,
    productOpportunities: llmData.product_opportunities,
    positioningAngles: llmData.positioning_angles,
    meta: { warnings },
  };
}
