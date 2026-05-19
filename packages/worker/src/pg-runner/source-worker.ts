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
import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import pino from "pino";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit";
import { runStageAExtract } from "../pipeline/stage-a-extract";
import { runStageBSummarize } from "../pipeline/stage-b-summarize";
import { fanInCheck } from "../llm/fan-in";
import type { SourceJobRow } from "./types";

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
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string },
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
    log.info({ jobId: job.id, platform: job.platform }, "Fetching posts from scraper");
    posts = await fetchPosts(job.platform, reportRow);
    log.info({ jobId: job.id, platform: job.platform, count: posts.length }, "Fetched posts");

    // Step 3: Persist mentions to database
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform, count: posts.length }, "Persisting mentions");
    await persistMentions(job.report_id, job.platform, posts);

    // Step 4: Update report status to "running" if not already
    log.info({ jobId: job.id, reportId: job.report_id }, "Updating report status to running");
    await db
      .update(reports)
      .set({ status: "running", updated_at: new Date() })
      .where(eq(reports.id, job.report_id));

    // Step 5: Run Stage A extraction
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage A extraction");
    await runStageAExtractionStep(job.report_id, job.platform, posts, reportRow);

    // Step 6: Run Stage B summarization
    log.info({ jobId: job.id, reportId: job.report_id, platform: job.platform }, "Running Stage B summarization");
    await runStageBSummarizationStep(job.report_id, job.platform);

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
    await fanInCheck(job.report_id, "fan-in");

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
    if (job.attempt_count < job.max_attempts) {
      // Retry: reset to queued with exponential backoff
      const backoffMs = getBackoffMs(job.attempt_count);
      log.info(
        { jobId: job.id, attemptCount: job.attempt_count, maxAttempts: job.max_attempts, backoffMs },
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
      // Permanent failure: mark failed
      log.error(
        { jobId: job.id, attemptCount: job.attempt_count, maxAttempts: job.max_attempts },
        "Job exceeded max attempts; marking as failed"
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
      await fanInCheck(job.report_id, "fan-in");
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
  reportRow: { primary_competitor_name: string | null; category: string }
): Promise<NormalizedPost[]> {
  const scraper = getScraper(platform as any);
  const posts = await scraper.fetch({
    competitor: reportRow.primary_competitor_name ?? "",
    category: reportRow.category,
    keywords: [], // Phase 1: empty keywords
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
 * Run Stage A extraction (LLM-powered pain extraction).
 *
 * Loads mentions for the platform and runs the extraction pipeline.
 *
 * @param reportId - Report UUID
 * @param platform - Platform identifier
 * @param posts - Array of normalized posts (used to build context)
 * @param reportRow - Report metadata
 */
async function runStageAExtractionStep(
  reportId: string,
  platform: string,
  posts: NormalizedPost[],
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string }
): Promise<void> {
  if (posts.length === 0) {
    log.warn({ reportId, platform }, "No posts found; skipping Stage A extraction");
    return;
  }

  const ctx = {
    reportId,
    competitor: reportRow.primary_competitor_name ?? (reportRow.category ?? ""),
    category: reportRow.category,
    audience: reportRow.audience ?? null,
    goal: reportRow.goal,
  };

  // Cap to 50 posts — free-tier LLMs return empty content on large contexts
  const postsForLlm = posts.slice(0, 50);

  const result = await runStageAExtract({
    llm: getLlm(),
    ctx,
    platform: platform as any,
    posts: postsForLlm,
  });

  log.info(
    { reportId, platform, promptTokens: result.usage.promptTokens, completionTokens: result.usage.completionTokens },
    "Stage A extraction completed"
  );
}

/**
 * Run Stage B summarization (LLM-powered platform summary).
 *
 * Loads the Stage A extraction result and runs the summarization pipeline.
 *
 * @param reportId - Report UUID
 * @param platform - Platform identifier
 */
async function runStageBSummarizationStep(reportId: string, platform: string): Promise<void> {
  // Load mentions for the platform to reconstruct posts
  const mentions_rows = await db
    .select()
    .from(mentions)
    .where(and(eq(mentions.report_id, reportId), eq(mentions.platform, platform)));

  if (mentions_rows.length === 0) {
    log.warn({ reportId, platform }, "No mentions found; skipping Stage B summarization");
    return;
  }

  // Convert mentions to NormalizedPost format for context
  const posts: NormalizedPost[] = mentions_rows.map((m) => ({
    platform: m.platform as any,
    externalId: m.external_id,
    url: m.url ?? "",
    author: m.author ?? null,
    title: m.title ?? null,
    body: m.body ?? "",
    score: m.score ?? null,
    numComments: m.num_comments ?? null,
    createdAt: m.posted_at ?? new Date(),
    raw: (m.raw ?? {}) as unknown,
  }));

  // Load the report for context
  const [report] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  if (!report) {
    throw new Error(`Report ${reportId} not found`);
  }

  const ctx = {
    reportId,
    competitor: report.primary_competitor_name ?? (report.competitors[0] ?? ""),
    category: report.category,
    audience: report.audience ?? null,
    goal: report.goal,
  };

  // Run Stage A extraction first to get the extract for Stage B
  const stageAResult = await runStageAExtract({
    llm: getLlm(),
    ctx,
    platform: platform as any,
    posts: posts.slice(0, 50),
  });

  // Run Stage B summarization
  const stageBResult = await runStageBSummarize({
    llm: getLlm(),
    ctx,
    platform: platform as any,
    extract: stageAResult.extract,
  });

  log.info(
    {
      reportId,
      platform,
      promptTokens: stageBResult.usage.promptTokens,
      completionTokens: stageBResult.usage.completionTokens,
    },
    "Stage B summarization completed"
  );
}
