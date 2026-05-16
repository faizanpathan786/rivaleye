import type { NormalizedPost, PlatformId } from "@rivaleye/scrapers";
import type { OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformExtract } from "../prompts/shared";
import { buildAppStoreExtract } from "../prompts/platform/appstore/extract";
import { buildPlayStoreExtract } from "../prompts/platform/playstore/extract";
import { buildHackerNewsExtract } from "../prompts/platform/hackernews/extract";
import { buildDevToExtract } from "../prompts/platform/devto/extract";
import { buildProductHuntExtract } from "../prompts/platform/producthunt/extract";
import { buildMediumExtract } from "../prompts/platform/medium/extract";
import { buildTrustpilotExtract } from "../prompts/platform/trustpilot/extract";
import { buildRedditExtract } from "../prompts/platform/reddit/extract";

export interface StageAInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  posts: NormalizedPost[];
}

export interface StageAOutput {
  extract: PlatformExtract;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageAExtract(input: StageAInput): Promise<StageAOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder(input);
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  });
  return { extract: res.parsed as PlatformExtract, usage: res.usage, model: res.model };
}

type Builder = (input: StageAInput) => {
  system: string;
  user: string;
  schema: typeof import("../prompts/shared").platformExtractSchema;
};

function pickBuilder(p: PlatformId): Builder {
  switch (p) {
    case "appstore":
      return ({ ctx, posts }) =>
        buildAppStoreExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "playstore":
      return ({ ctx, posts }) =>
        buildPlayStoreExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: post.body,
          })),
        });
    case "hackernews":
      return ({ ctx, posts }) =>
        buildHackerNewsExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            score: post.score,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "devto":
      return ({ ctx, posts }) =>
        buildDevToExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            score: post.score,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "producthunt":
      return ({ ctx, posts }) =>
        buildProductHuntExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "medium":
      return ({ ctx, posts }) =>
        buildMediumExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "trustpilot":
      return ({ ctx, posts }) =>
        buildTrustpilotExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "reddit":
      return ({ ctx, posts }) =>
        buildRedditExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            score: post.score,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    default:
      throw new Error(`Stage A: no extract builder for platform "${p}" yet`);
  }
}
