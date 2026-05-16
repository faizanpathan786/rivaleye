import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { MergedClusters, PipelineCtx, SynthOutput } from "../prompts/shared";
import { buildRefine } from "../prompts/cross/refine";
import { log } from "../logger.js";

const MAX_TOKENS = 16000;

export interface StageEInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  merged: MergedClusters;
  draft: SynthOutput;
}

export interface StageEOutput {
  refined: SynthOutput;
  fellBackToDraft: boolean;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function runStageERefine(input: StageEInput, opts?: LlmCallOptions): Promise<StageEOutput> {
  const built = buildRefine({ ctx: input.ctx, merged: input.merged, draft: input.draft });
  try {
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
      maxTokens: MAX_TOKENS,
    }, opts);
    return {
      refined: res.parsed as SynthOutput,
      fellBackToDraft: false,
      usage: res.usage,
      model: res.model,
    };
  } catch (err) {
    await log(input.ctx.reportId, "warn", "E", null, "stage E refine failed, falling back to draft", {
      error: asMessage(err),
    });
    return {
      refined: input.draft,
      fellBackToDraft: true,
      usage: { promptTokens: 0, completionTokens: 0 },
      model: "(stage-e-fallback)",
    };
  }
}
