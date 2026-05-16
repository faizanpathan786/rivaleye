import type { PlatformId } from "@rivaleye/scrapers";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../prompts/shared";
import { buildAppStoreSummarize } from "../prompts/platform/appstore/summarize";

export interface StageBInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  extract: PlatformExtract;
}

export interface StageBOutput {
  brief: PlatformBrief;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageBSummarize(input: StageBInput): Promise<StageBOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder({ ctx: input.ctx, extract: input.extract });
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  });
  return { brief: res.parsed, usage: res.usage, model: res.model };
}

type SummarizeBuilder = (input: {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}) => {
  system: string;
  user: string;
  schema: typeof import("../prompts/shared").platformBriefSchema;
};

function pickBuilder(p: PlatformId): SummarizeBuilder {
  switch (p) {
    case "appstore":
      return buildAppStoreSummarize;
    default:
      throw new Error(`Stage B: no summarize builder for platform "${p}" yet`);
  }
}
