/**
 * One-shot script: run Stage A → B → fan-in for an existing report
 * using mentions already in the DB (skips scraping).
 *
 * Usage: bun --env-file=../../.env src/scripts/run-llm-from-db.ts <reportId> <platform>
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { LLM_MODEL, LlmSchemaError, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";
import { toLegacyExtract } from "../pipeline/signal-adapters";
import { fanInCheck } from "../pg-runner/fan-in";
import { report_platform_briefs } from "../../../api/src/db/schema/pipeline.js";
import type { NormalizedPost } from "@rivaleye/scrapers";
import pino from "pino";

const log = pino({ name: "run-llm-from-db" });

const [reportId, platform] = process.argv.slice(2);
if (!reportId || !platform) {
  console.error("Usage: bun run-llm-from-db.ts <reportId> <platform>");
  process.exit(1);
}

const llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });

// Load report
const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
if (!report) { console.error("Report not found"); process.exit(1); }

const ctx = {
  reportId,
  competitor: report.primary_competitor_name ?? report.category,
  category: report.category,
  audience: report.audience ?? null,
  goal: report.goal,
};

log.info({ reportId, platform, competitor: ctx.competitor }, "Loading mentions from DB");

// Load mentions
const rows = await db.select().from(mentions)
  .where(and(eq(mentions.report_id, reportId), eq(mentions.platform, platform)));

log.info({ count: rows.length }, "Mentions loaded");

const posts: NormalizedPost[] = rows.map((r) => ({
  platform: r.platform as any,
  externalId: r.external_id,
  url: r.url ?? "",
  title: r.title ?? "",
  body: r.body ?? "",
  author: r.author ?? "",
  score: r.score ?? null,
  numComments: r.num_comments ?? 0,
  createdAt: r.posted_at ?? new Date(),
  raw: r.raw ?? {},
}));

const postsForLlm = posts.slice(0, 50);
log.info({ total: posts.length, sending: postsForLlm.length }, "Running Stage A");

let legacyExtract;
try {
  const result = await runStageAExtract({ llm, ctx, platform: platform as any, posts: postsForLlm });
  legacyExtract = toLegacyExtract(result.extract);
  log.info({
    complaints: legacyExtract.complaints.length,
    features: legacyExtract.features_requested.length,
    pricing: legacyExtract.pricing_signals.length,
    switching: legacyExtract.switching_signals.length,
    quotes: legacyExtract.notable_quotes.length,
    tokens: result.usage,
  }, "Stage A complete");
} catch (err) {
  if (err instanceof LlmSchemaError) {
    log.error({ issues: err.issues, raw: JSON.stringify(err.raw).slice(0, 2000) }, "Stage A schema error");
  }
  throw err;
}

log.info("Running Stage B");
const stageBResult = await runStageBSummarize({ llm, ctx, platform: platform as any, extract: legacyExtract });
log.info({
  headline: stageBResult.brief.headline,
  themes: stageBResult.brief.top_themes.length,
  sentiment: stageBResult.brief.sentiment,
  tokens: stageBResult.usage,
}, "Stage B complete");

// Persist brief
await db.insert(report_platform_briefs).values({
  report_id: reportId, platform,
  extract: legacyExtract as unknown as Record<string, unknown>,
  summary: stageBResult.brief as unknown as Record<string, unknown>,
  model_used: stageBResult.model,
  prompt_tokens: stageBResult.usage.promptTokens,
  completion_tokens: stageBResult.usage.completionTokens,
}).onConflictDoUpdate({
  target: [report_platform_briefs.report_id, report_platform_briefs.platform],
  set: {
    extract: legacyExtract as unknown as Record<string, unknown>,
    summary: stageBResult.brief as unknown as Record<string, unknown>,
    model_used: stageBResult.model,
    prompt_tokens: stageBResult.usage.promptTokens,
    completion_tokens: stageBResult.usage.completionTokens,
  },
});
log.info("Brief persisted");

// Mark source job completed
await db.update(report_platform_jobs)
  .set({ status: "completed", stage: "completed", completed_at: new Date(), locked_at: null, locked_by: null })
  .where(and(eq(report_platform_jobs.report_id, reportId), eq(report_platform_jobs.platform, platform)));

// Mark report running
await db.update(reports).set({ status: "running" }).where(eq(reports.id, reportId));

log.info("Job marked complete, running fan-in");
await fanInCheck(reportId);
log.info("Done — synthesis job should now be queued");

process.exit(0);
