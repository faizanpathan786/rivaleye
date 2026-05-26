/**
 * Process a single source job: fetch, extract, and summarize.
 *
 * Handles the complete pipeline for one platform (e.g., Reddit):
 * 1. Fetch posts from the scraper
 * 2. Persist mentions to the database
 * 3. Run Stage A extraction (LLM)
 * 4. Run Stage B summarization (LLM)
 * 5. Mark job completed and check fan-in
 *
 * On error: retry with exponential backoff until max_attempts exceeded.
 */

import { and, eq } from "drizzle-orm";
import type { NormalizedPost } from "@rivaleye/scrapers";
import { getScraper } from "@rivaleye/scrapers";
import { LLM_MODEL, LlmSchemaError, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import pino from "pino";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs, report_platform_briefs } from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";
import { fanInCheck } from "./fan-in";
import { PermanentError, RateLimitError } from "../errors";
import type { SourceJobRow } from "./types";
import type { PlatformExtract, StageAExtract } from "../prompts/shared";
import { emptyStageAExtract, mergeStageAExtracts, toLegacyExtract } from "../pipeline/signal-adapters";

const log = pino({ name: "source-worker" });
const CHUNK_SIZE = 500;

/**
 * Lazy-initialize OpenRouterClient to avoid connection overhead if not needed.
 */
let _llm: OpenRouterClient | null = null;
function getLlm(): OpenRouterClient {
  if (_llm) return _llm;
  _llm = new OpenRouterClient({
    apiKey: readOpenRouterApiKey(),
    model: LLM_MODEL,
  });
  return _llm;
}

/**
 * Exponential backoff: 30s, 2m, 5m for attempts 0, 1, 2+
 */
function getBackoffMs(attemptCount: number): number {
  const seconds = [30, 120, 300]; // 30s, 2m, 5m
  return (seconds[attemptCount] ?? 300) * 1000;
}

/**
 * Process a claimed source job: fetch → extract → summarize → fan-in.
 *
 * All steps run sequentially within a single process. If any step fails:
 * - If attempt_count < max_attempts: reset to queued with exponential backoff
 * - If attempt_count >= max_attempts: mark failed and still call fan-in
 *
 * @param job - The claimed source job from report_platform_jobs
 * @param reportRow - The report record (loaded by caller)
 * @param workerId - Unique worker identifier for logging
 */
export async function processSourceJob(
  job: SourceJobRow,
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string; website_url?: string | null },
  workerId: string,
): Promise<void> {
  const startedAt = Date.now();
  let posts: NormalizedPost[] = [];

  try {
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Starting source job processing");

    // Step 1: Emit started event
    await emit({
      reportId: job.report_id,
      platform: job.platform,
      stage: "scrape.fetch",
      event: "started",
      attempt: job.attempt_count,
    });

    // Step 2: Fetch from scraper
    log.info({ jobId: job.id, platform: job.platform, competitor: reportRow.primary_competitor_name, category: reportRow.category }, "Fetching posts from scraper");
    posts = await fetchPosts(job.platform, reportRow);
    const scores = posts.map((p) => p.score ?? 0);
    log.info({
      jobId: job.id, platform: job.platform, count: posts.length,
      withBody: posts.filter((p) => (p.body?.length ?? 0) > 20).length,
      scoreMin: Math.min(...scores), scoreMax: Math.max(...scores), scoreMed: scores.sort((a,b)=>a-b)[Math.floor(scores.length/2)] ?? 0,
    }, "Fetched posts");

    // Step 3: Persist mentions to database
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform, count: posts.length, chunks: Math.ceil(posts.length / CHUNK_SIZE) }, "Persisting mentions to DB");
    await persistMentions(job.report_id, job.platform, posts);
    log.info({ jobId: job.id, platform: job.platform }, "Mentions persisted");

    // Step 4: Update report status to "running" + stage to "scraping"
    log.info({ jobId: job.id, reportId: job.report_id }, "Updating report status to running/scraping");
    await db
      .update(reports)
      .set({ status: "running", stage: "scraping", updated_at: new Date() })
      .where(eq(reports.id, job.report_id));

    // Step 4b: Skip A/B and complete early if no posts found
    if (posts.length === 0) {
      log.warn({ jobId: job.id, platform: job.platform }, "No posts found; skipping Stage A/B and marking completed");
      const durationMs = Date.now() - startedAt;
      await db
        .update(report_platform_jobs)
        .set({
          status: "completed",
          stage: "completed",
          completed_at: new Date(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));
      await emit({
        reportId: job.report_id,
        platform: job.platform,
        stage: "scrape.fetch",
        event: "completed",
        attempt: job.attempt_count,
        durationMs,
        metadata: { posts_count: 0 },
      });
      await fanInCheck(job.report_id);
      return;
    }

    // Step 5: Run Stage A extraction (skips LLM calls if brief already cached from prior attempt)
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage A extraction");
    const stageA = await runStageAExtractionStep(job.report_id, job.platform, posts, reportRow);

    // Step 6: Run Stage B summarization + persist brief (skipped if Stage A returned cached result)
    if (stageA.cached) {
      log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Stage A/B already cached; skipping LLM re-run");
    } else {
      log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage B summarization");
      await runStageBSummarizationStep(job.report_id, job.platform, stageA.legacy, stageA.signals, reportRow);
    }

    // Step 7: Mark job completed
    const durationMs = Date.now() - startedAt;
    log.info({ jobId: job.id, durationMs }, "Marking job completed");
    await db
      .update(report_platform_jobs)
      .set({
        status: "completed",
        stage: "completed",
        completed_at: new Date(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date(),
      })
      .where(eq(report_platform_jobs.id, job.id));

    // Step 8: Emit completed event
    await emit({
      reportId: job.report_id,
      platform: job.platform,
      stage: "scrape.fetch",
      event: "completed",
      attempt: job.attempt_count,
      durationMs,
      metadata: { posts_count: posts.length },
    });

    // Step 9: Check fan-in (may trigger synthesis job creation)
    log.info({ reportId: job.report_id }, "Checking fan-in for synthesis job");
    await fanInCheck(job.report_id);

    log.info({ jobId: job.id, reportId: job.report_id }, "Source job completed successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;

    log.error(
      { jobId: job.id, reportId: job.report_id, platform: job.platform, error: errorMsg, durationMs },
      "Source job failed"
    );

    // Emit failed event
    await emit({
      reportId: job.report_id,
      platform: job.platform,
      stage: "scrape.fetch",
      event: "failed",
      attempt: job.attempt_count,
      durationMs,
      error: errorMsg,
    });

    // Determine if we should retry or fail permanently
    const isPermanent = err instanceof PermanentError;
    const canRetry = !isPermanent && job.attempt_count < job.max_attempts;

    if (canRetry) {
      const backoffMs = err instanceof RateLimitError
        ? err.retryAfterMs
        : getBackoffMs(job.attempt_count);
      log.info(
        { jobId: job.id, attemptCount: job.attempt_count, maxAttempts: job.max_attempts, backoffMs, isRateLimit: err instanceof RateLimitError },
        "Retrying job with backoff"
      );

      await db
        .update(report_platform_jobs)
        .set({
          status: "queued",
          run_after: new Date(Date.now() + backoffMs),
          locked_at: null,
          locked_by: null,
          last_error: errorMsg,
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));
    } else {
      log.error(
        { jobId: job.id, attemptCount: job.attempt_count, maxAttempts: job.max_attempts, isPermanent },
        "Job exceeded max attempts or is permanent failure; marking as failed"
      );

      await db
        .update(report_platform_jobs)
        .set({
          status: "failed",
          stage: "failed",
          locked_at: null,
          locked_by: null,
          last_error: errorMsg,
          completed_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));

      // Still call fan-in in case other sources succeeded (partial report)
      await fanInCheck(job.report_id);
    }

    // Re-throw so caller knows job failed
    throw err;
  }
}

/**
 * Fetch posts from the scraper for the given platform.
 *
 * @param platform - Platform identifier (e.g., "reddit")
 * @param reportRow - Report metadata (competitor, category, etc.)
 * @returns Array of normalized posts
 */
async function fetchPosts(
  platform: string,
  reportRow: { primary_competitor_name: string | null; category: string; website_url?: string | null }
): Promise<NormalizedPost[]> {
  const scraper = getScraper(platform as any);
  const posts = await scraper.fetch({
    competitor: reportRow.primary_competitor_name ?? "",
    category: reportRow.category,
    keywords: [],
    websiteUrl: reportRow.website_url ?? undefined,
  });
  return posts;
}

/**
 * Persist normalized posts to the mentions table.
 *
 * Uses onConflictDoNothing to handle duplicate posts gracefully
 * (same platform + external_id combination).
 *
 * @param reportId - Report UUID
 * @param platform - Platform identifier
 * @param posts - Array of normalized posts
 */
async function persistMentions(reportId: string, platform: string, posts: NormalizedPost[]): Promise<void> {
  for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
    const chunk = posts.slice(i, i + CHUNK_SIZE);
    if (chunk.length === 0) continue;

    await db
      .insert(mentions)
      .values(
        chunk.map((p) => ({
          report_id: reportId,
          platform: p.platform,
          external_id: p.externalId,
          url: p.url,
          author: p.author,
          title: p.title,
          body: p.body,
          score: p.score,
          num_comments: p.numComments,
          posted_at: new Date(p.createdAt),
          raw: p.raw as Record<string, unknown>,
        }))
      )
      .onConflictDoNothing();
  }
}

/**
 * Run Stage A extraction (LLM-powered signal extraction).
 *
 * Returns both the new signal-centric extract and the legacy-shaped extract
 * derived from it, so Stage B/C keep working unchanged.
 *
 * On retry: if a brief already exists in the DB for this report+platform,
 * the cached extract is returned without re-running LLM calls.
 */
async function runStageAExtractionStep(
  reportId: string,
  platform: string,
  posts: NormalizedPost[],
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string }
): Promise<{ legacy: PlatformExtract; signals: StageAExtract; cached: boolean }> {
  if (posts.length === 0) {
    log.warn({ reportId, platform }, "No posts found; skipping Stage A extraction");
    const empty = emptyStageAExtract();
    return { legacy: toLegacyExtract(empty), signals: empty, cached: false };
  }

  // Check if brief already exists (retry-safe cache: skip re-processing if already done)
  const [existingBrief] = await db
    .select({ extract: report_platform_briefs.extract })
    .from(report_platform_briefs)
    .where(
      and(
        eq(report_platform_briefs.report_id, reportId),
        eq(report_platform_briefs.platform, platform)
      )
    )
    .limit(1);

  if (existingBrief) {
    log.info({ reportId, platform }, "Stage A: brief already exists, returning cached extract");
    const raw = existingBrief.extract as Record<string, unknown> & { _signals?: StageAExtract };
    const signals: StageAExtract = raw._signals ?? emptyStageAExtract();
    const legacy = raw as unknown as PlatformExtract;
    return { legacy, signals, cached: true };
  }

  const ctx = {
    reportId,
    competitor: reportRow.primary_competitor_name ?? (reportRow.category ?? ""),
    category: reportRow.category,
    audience: reportRow.audience ?? null,
    goal: reportRow.goal,
  };

  const BATCH_SIZE = 50;
  const batches: NormalizedPost[][] = [];
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    batches.push(posts.slice(i, i + BATCH_SIZE));
  }

  log.info({ reportId, platform, totalPosts: posts.length, batches: batches.length, batchSize: BATCH_SIZE }, "Stage A: processing posts in parallel batches");

  // Run all batches in parallel to reduce total LLM latency
  const batchResults = await Promise.all(
    batches.map(async (batch, batchIdx) => {
      log.info({ reportId, platform, batchIdx: batchIdx + 1, totalBatches: batches.length, batchSize: batch.length }, "Stage A: running batch");
      try {
        return await runStageAExtract({
          llm: getLlm(),
          ctx,
          platform: platform as any,
          posts: batch,
        });
      } catch (err) {
        if (err instanceof LlmSchemaError) {
          log.error({ reportId, platform, batchIdx, issues: err.issues, rawJson: JSON.stringify(err.raw).slice(0, 2000) }, "Stage A: LLM batch failed schema validation");
        }
        throw err;
      }
    })
  );

  const allExtracts = batchResults.map((r) => r.extract);
  const totalPromptTokens = batchResults.reduce((sum, r) => sum + r.usage.promptTokens, 0);
  const totalCompletionTokens = batchResults.reduce((sum, r) => sum + r.usage.completionTokens, 0);

  const signals = mergeStageAExtracts(allExtracts);
  const legacy = toLegacyExtract(signals);

  log.info({
    reportId, platform,
    batches: batches.length,
    promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens,
    loveSignals: signals.love_signals.length,
    painSignals: signals.pain_signals.length,
    gapSignals: signals.gap_signals.length,
    switchSignals: signals.switch_signals.length,
    pricingSignals: signals.pricing_signals.length,
    featureSignals: signals.feature_signals.length,
    positioningSignals: signals.positioning_signals.length,
    evidenceQuotes: signals.evidence_quotes.length,
  }, "Stage A extraction completed");

  return { legacy, signals, cached: false };
}

/**
 * Run Stage B summarization (LLM-powered platform summary).
 *
 * Stage B consumes the legacy extract shape unchanged. The persisted
 * report_platform_briefs.extract column stores the legacy shape at its top
 * level (so Stage C's cast keeps working) plus the full signal extract
 * under the _signals key.
 */
async function runStageBSummarizationStep(
  reportId: string,
  platform: string,
  legacyExtract: PlatformExtract,
  signals: StageAExtract,
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string }
): Promise<void> {
  const ctx = {
    reportId,
    competitor: reportRow.primary_competitor_name ?? (reportRow.category ?? ""),
    category: reportRow.category,
    audience: reportRow.audience ?? null,
    goal: reportRow.goal,
  };

  log.info({ reportId, platform, complaints: legacyExtract.complaints.length }, "Stage B: running LLM summarization");
  const stageBResult = await runStageBSummarize({
    llm: getLlm(),
    ctx,
    platform: platform as any,
    extract: legacyExtract,
  });

  log.info({
    reportId, platform,
    promptTokens: stageBResult.usage.promptTokens,
    completionTokens: stageBResult.usage.completionTokens,
    headline: stageBResult.brief.headline,
    topThemes: stageBResult.brief.top_themes.length,
    sentiment: stageBResult.brief.sentiment,
  }, "Stage B summarization completed");

  const extractColumn = { ...legacyExtract, _signals: signals } as unknown as Record<string, unknown>;

  // Persist brief to DB so synthesis (Stage C) can load it
  log.info({ reportId, platform }, "Stage B: persisting brief to DB");
  await db
    .insert(report_platform_briefs)
    .values({
      report_id: reportId,
      platform,
      extract: extractColumn,
      summary: stageBResult.brief as unknown as Record<string, unknown>,
      model_used: stageBResult.model,
      prompt_tokens: stageBResult.usage.promptTokens,
      completion_tokens: stageBResult.usage.completionTokens,
    })
    .onConflictDoUpdate({
      target: [report_platform_briefs.report_id, report_platform_briefs.platform],
      set: {
        extract: extractColumn,
        summary: stageBResult.brief as unknown as Record<string, unknown>,
        model_used: stageBResult.model,
        prompt_tokens: stageBResult.usage.promptTokens,
        completion_tokens: stageBResult.usage.completionTokens,
      },
    });

  log.info({ reportId, platform }, "Stage B: brief persisted");
}
