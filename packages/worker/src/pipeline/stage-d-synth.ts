import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { MergedClusters, PipelineCtx, SynthOutput } from "../prompts/shared";
import { buildSynth } from "../prompts/cross/synth";
import { PipelineError } from "./errors";

export interface StageDInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  merged: MergedClusters;
}

export interface StageDOutput {
  synth: SynthOutput;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

const MAX_TOKENS = 16000;

export async function runStageDSynth(input: StageDInput, opts?: LlmCallOptions): Promise<StageDOutput> {
  const built = buildSynth({ ctx: input.ctx, merged: input.merged });
  try {
    const res = await input.llm.complete({
      system: built.system,
      user: built.user,
      schema: built.schema,
      maxTokens: MAX_TOKENS,
    }, opts);
    return { synth: res.parsed as SynthOutput, usage: res.usage, model: res.model };
  } catch (err) {
    throw new PipelineError("D", "synth failed", err);
  }
}
