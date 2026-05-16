import OpenAI from "openai";
import { z } from "zod";
import { buildStage2Prompt } from "../prompts";
import {
  computePainScore,
  computeClusterMetadata,
  type ClusterScores,
} from "../scoring";
import type { PipelineCtx, RawCluster, Stage1Output } from "./stage1";

// ---- OpenRouter client ----

const apiKey = process.env["OPENROUTER_API_KEY"];
if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

const openRouter = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---- Types ----

export type ScoredCluster = RawCluster & {
  scores: ClusterScores;
};

export type Stage2Output = {
  rankedClusters: ScoredCluster[];
  extraClusters: ScoredCluster[];
};

// ---- Constants ----

const DEFAULT_MODEL = "deepseek/deepseek-v3-0324:free";
const TOP_N = 8;

// ---- Zod schema for LLM output ----

const stage2LlmSchema = z.object({
  scores: z.array(
    z.object({
      cluster_id: z.string(),
      intensity: z.number().int().min(1).max(5),
      specificity: z.number().int().min(1).max(5),
    }),
  ),
});

type Stage2LlmOutput = z.infer<typeof stage2LlmSchema>;

// ---- Helpers ----

/**
 * Strip markdown code fences from an LLM response.
 * Handles: ```json ... ```, ``` ... ```, and bare JSON.
 */
function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

async function callStage2Llm(
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
  if (!content) throw new Error("[stage2] empty LLM response");
  return content;
}

type ParseResult =
  | { success: true; data: Stage2LlmOutput }
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
  const result = stage2LlmSchema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: { message: String(result.error) },
  };
}

// ---- Main export ----

export async function runStage2(
  ctx: PipelineCtx,
  stage1Output: Stage1Output,
  mentions: Array<{ externalId: string; createdAt: Date | string | number }>,
): Promise<Stage2Output> {
  const model =
    ctx.stage2Model ?? process.env["STAGE2_MODEL"] ?? DEFAULT_MODEL;

  const { rawClusters } = stage1Output;

  // 1. Build prompt input — use first voice_phrase from each cluster as top_quotes
  const { system, user } = buildStage2Prompt({
    clusters: rawClusters.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      top_quotes: c.voice_phrases.slice(0, 5),
    })),
  });

  // 2. LLM call with one retry on validation failure
  const raw = await callStage2Llm(system, user, model);
  const parsed = parseAndValidate(raw);

  let llmScores: Stage2LlmOutput["scores"];

  if (parsed.success) {
    llmScores = parsed.data.scores;
  } else {
    // Retry once with validation error prepended
    const retryUser =
      `Previous response failed validation: ${parsed.error.message}. Try again. Output valid JSON only.\n\n` +
      user;

    const retryRaw = await callStage2Llm(system, retryUser, model);
    const retryParsed = parseAndValidate(retryRaw);

    if (retryParsed.success) {
      llmScores = retryParsed.data.scores;
    } else {
      throw new Error(`Stage2ValidationError: ${retryParsed.error.message}`);
    }
  }

  // 3. Build lookup map for LLM scores by cluster_id
  const llmScoreMap = new Map(
    llmScores.map((s) => [s.cluster_id, s]),
  );

  // 4. Merge deterministic metadata with LLM ratings → compute pain score
  const scoredClusters: ScoredCluster[] = rawClusters.map((cluster) => {
    const llmEntry = llmScoreMap.get(cluster.id);
    const intensity = llmEntry?.intensity ?? 3;
    const specificity = llmEntry?.specificity ?? 3;

    const { frequency, recencyDays } = computeClusterMetadata(
      cluster.evidence_post_ids,
      mentions,
    );

    const painScore = computePainScore({
      frequency,
      intensity,
      recencyDays,
      specificity,
    });

    return {
      ...cluster,
      scores: {
        pain_score: painScore,
        intensity,
        specificity,
        recency_days: recencyDays,
        frequency,
      },
    };
  });

  // 5. Sort all clusters by pain_score desc
  scoredClusters.sort((a, b) => b.scores.pain_score - a.scores.pain_score);

  // 6. Partition: top N → rankedClusters, rest → extraClusters
  const rankedClusters = scoredClusters.slice(0, TOP_N);
  const extraClusters = scoredClusters.slice(TOP_N);

  return { rankedClusters, extraClusters };
}
