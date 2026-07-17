import type { NormalizedPost, PlatformId } from "@rivaleye/scrapers";
import type { LlmCallOptions, LlmClient } from "@rivaleye/shared";
import type { PipelineCtx, StageAExtract } from "../prompts/shared";
import { stageAExtractSchema } from "../prompts/shared";
import { buildAppStoreExtract } from "../prompts/platform/appstore/extract";
import { buildPlayStoreExtract } from "../prompts/platform/playstore/extract";
import { buildHackerNewsExtract } from "../prompts/platform/hackernews/extract";
import { buildDevToExtract } from "../prompts/platform/devto/extract";
import { buildProductHuntExtract } from "../prompts/platform/producthunt/extract";
import { buildRedditExtract } from "../prompts/platform/reddit/extract";
import { buildWebsiteExtract } from "../prompts/platform/website/extract";
import { buildLinkedInExtract } from "../prompts/platform/linkedin/extract";
import { buildTwitterExtract } from "../prompts/platform/twitter/extract";

export interface StageAInput {
  llm: LlmClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  posts: NormalizedPost[];
}

export interface StageAOutput {
  extract: StageAExtract;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageAExtract(input: StageAInput, opts?: LlmCallOptions): Promise<StageAOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder(input);
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  }, opts);
  return { extract: res.parsed as StageAExtract, usage: res.usage, model: res.model };
}

type Builder = (input: StageAInput) => {
  system: string;
  user: string;
  schema: typeof stageAExtractSchema;
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
            author: post.author ?? null,
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
            author: post.author ?? null,
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
            author: post.author ?? null,
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
            author: post.author ?? null,
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
            author: post.author ?? null,
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
            author: post.author ?? null,
          })),
        });
    case "website":
      return ({ ctx, posts }) =>
        buildWebsiteExtract({
          ctx,
          pages: posts.map((post) => ({
            id: post.externalId,
            url: post.url,
            body: post.body,
          })),
        });
    case "linkedin":
      return ({ ctx, posts }) =>
        buildLinkedInExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            body: post.body,
            score: post.score,
            author: post.author ?? null,
          })),
        });
    case "twitter":
      return ({ ctx, posts }) =>
        buildTwitterExtract({
          ctx,
          tweets: posts.map((post) => ({
            id: post.externalId,
            body: post.body,
            score: post.score,
            author: post.author ?? null,
          })),
        });
    default:
      throw new Error(`Stage A: no extract builder for platform "${p}" yet`);
  }
}
