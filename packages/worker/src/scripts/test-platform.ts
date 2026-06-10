import { getScraper } from "@rivaleye/scrapers";
import type { PlatformId } from "@rivaleye/scrapers";
import { OpenRouterClient, LLM_MODEL, readOpenRouterApiKey } from "@rivaleye/shared";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";
import { toLegacyExtract } from "../pipeline/signal-adapters";
import type { PipelineCtx } from "../prompts/shared";

const [, , platform, competitor, category = "productivity"] = process.argv;

if (!platform || !competitor) {
  console.error("Usage: bun run src/scripts/test-platform.ts <platform> <competitor> [category]");
  process.exit(1);
}

(async () => {
  const scraper = getScraper(platform as PlatformId);

  console.log(`[test-platform] fetching posts from ${platform} for "${competitor}"...`);
  const posts = await scraper.fetch({ competitor, category });

  if (posts.length === 0) {
    console.warn(`[test-platform] no posts returned from ${platform} — aborting`);
    return;
  }

  console.log(`[test-platform] fetched ${posts.length} posts`);

  const apiKey = readOpenRouterApiKey();
  const llm = new OpenRouterClient({ apiKey, model: LLM_MODEL });

  const ctx: PipelineCtx = {
    reportId: "smoke-test",
    competitor,
    category,
    audience: null,
    goal: "identify pain points",
  };

  console.log("[test-platform] running Stage A extract...");
  const stageA = await runStageAExtract({ llm, ctx, platform: platform as PlatformId, posts });
  console.log(`[test-platform] Stage A complete — model: ${stageA.model}`);
  console.log(
    `[test-platform] Stage A tokens — prompt: ${stageA.usage.promptTokens}, completion: ${stageA.usage.completionTokens}`,
  );

  console.log("[test-platform] running Stage B summarize...");
  const stageB = await runStageBSummarize({
    llm,
    ctx,
    platform: platform as PlatformId,
    extract: toLegacyExtract(stageA.extract),
  });
  console.log(`[test-platform] Stage B complete — model: ${stageB.model}`);
  console.log(
    `[test-platform] Stage B tokens — prompt: ${stageB.usage.promptTokens}, completion: ${stageB.usage.completionTokens}`,
  );

  const totalPrompt = stageA.usage.promptTokens + stageB.usage.promptTokens;
  const totalCompletion = stageA.usage.completionTokens + stageB.usage.completionTokens;
  console.log(
    `[test-platform] total tokens — prompt: ${totalPrompt}, completion: ${totalCompletion}, combined: ${totalPrompt + totalCompletion}`,
  );
  console.log("[test-platform] brief:", JSON.stringify(stageB.brief, null, 2));
})().catch((err: unknown) => {
  console.error("[test-platform] fatal:", err);
  process.exit(1);
});
