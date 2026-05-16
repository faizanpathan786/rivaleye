import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { MergedClusters, PipelineCtx, PlatformBrief, PlatformExtract } from "../prompts/shared";
import { buildMerge } from "../prompts/cross/merge";
import { PipelineError } from "./errors";

export interface StageCInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  briefs: PlatformBrief[];
  extracts: PlatformExtract[];
}

export interface StageCOutput {
  merged: MergedClusters;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageCMerge(input: StageCInput, opts?: LlmCallOptions): Promise<StageCOutput> {
  const built = buildMerge({ ctx: input.ctx, briefs: input.briefs, extracts: input.extracts });
  try {
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
    }, opts);
    return { merged: res.parsed as MergedClusters, usage: res.usage, model: res.model };
  } catch (err) {
    throw new PipelineError("C", "merge failed", err);
  }
}
