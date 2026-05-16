import OpenAI from "openai";
import { z } from "zod";
import { buildStage4Prompt } from "../prompts";
import { StageValidationError } from "./errors";
import type { PipelineCtx } from "./stage1";
import type { Stage3Output } from "./stage3";

// ---- OpenRouter client (same singleton pattern as stage1/stage2/stage3) ----

const apiKey = process.env["OPENROUTER_API_KEY"];
if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

const openRouter = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---- Constants ----

const DEFAULT_MODEL = "deepseek/deepseek-v3-0324:free";

// ---- Zod schema ----

const stage4Schema = z.object({
  actions: z
    .array(
      z.object({
        action: z.string().min(5),
        cluster_ids: z.array(z.string()).min(1),
        why: z.string(),
      }),
    )
    .min(3)
    .max(7),
});

// ---- Types ----

export type NextAction = {
  action: string;
  cluster_ids: string[];
  why: string;
};

// ---- Helpers ----

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/im, "")
    .trim();
}

async function callStage4Llm(
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
  if (!content) throw new Error("[stage4] empty LLM response");
  return content;
}

type ParseResult =
  | { success: true; data: z.infer<typeof stage4Schema> }
  | { success: false; error: { message: string }; raw: string };

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
      raw,
    };
  }
  const result = stage4Schema.safeParse(json);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: { message: String(result.error) },
    raw,
  };
}

// ---- Main export ----

export async function runStage4(
  ctx: PipelineCtx,
  stage3Output: Stage3Output,
): Promise<NextAction[]> {
  const model =
    ctx.stage4Model ?? process.env["STAGE4_MODEL"] ?? DEFAULT_MODEL;

  // 1. Build Stage4Input
  const stage4Input = {
    stage3Summary: {
      topOpportunities: stage3Output.topOpportunities.map((o) => o.title),
      bestWedge: stage3Output.bestWedge,
      topPainClusters: stage3Output.topOpportunities.map((o) => o.title),
    },
    founderGoal: ctx.founderGoal,
    competitor: ctx.competitor,
  };

  // 2. Build prompt
  const { system, user } = buildStage4Prompt(stage4Input);

  // 3. LLM call
  const raw = await callStage4Llm(system, user, model);
  let parsed = parseAndValidate(raw);

  // 4. Retry once on failure
  if (!parsed.success) {
    const retryUser =
      `Previous response failed validation: ${parsed.error.message}. Try again. Output valid JSON only.\n\n` +
      user;
    const retryRaw = await callStage4Llm(system, retryUser, model);
    parsed = parseAndValidate(retryRaw);

    if (!parsed.success) {
      throw new StageValidationError(4, parsed.error.message, parsed.raw);
    }
  }

  const actions = parsed.data.actions;

  // 5. Filter out actions with empty cluster_ids after trim; log warnings but don't throw
  const validActions: NextAction[] = [];
  for (const action of actions) {
    const trimmedIds = action.cluster_ids.map((id) => id.trim()).filter((id) => id.length > 0);
    if (trimmedIds.length === 0) {
      console.warn(
        `[stage4] dropping action "${action.action.slice(0, 60)}" — cluster_ids empty after trim`,
      );
      continue;
    }
    validActions.push({
      action: action.action,
      cluster_ids: trimmedIds,
      why: action.why,
    });
  }

  return validActions;
}
