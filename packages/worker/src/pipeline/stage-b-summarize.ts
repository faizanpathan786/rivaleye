import type { PlatformId } from "@rivaleye/scrapers";
import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../prompts/shared";
import { buildAppStoreSummarize } from "../prompts/platform/appstore/summarize";
import { buildPlayStoreSummarize } from "../prompts/platform/playstore/summarize";
import { buildHackerNewsSummarize } from "../prompts/platform/hackernews/summarize";
import { buildDevToSummarize } from "../prompts/platform/devto/summarize";
import { buildProductHuntSummarize } from "../prompts/platform/producthunt/summarize";
import { buildMediumSummarize } from "../prompts/platform/medium/summarize";
import { buildRedditSummarize } from "../prompts/platform/reddit/summarize";

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

export async function runStageBSummarize(input: StageBInput, opts?: LlmCallOptions): Promise<StageBOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder({ ctx: input.ctx, extract: input.extract });
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  }, opts);
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
    case "playstore":
      return buildPlayStoreSummarize;
    case "hackernews":
      return buildHackerNewsSummarize;
    case "devto":
      return buildDevToSummarize;
    case "producthunt":
      return buildProductHuntSummarize;
    case "medium":
      return buildMediumSummarize;
    case "reddit":
      return buildRedditSummarize;
    default:
      throw new Error(`Stage B: no summarize builder for platform "${p}" yet`);
  }
}
