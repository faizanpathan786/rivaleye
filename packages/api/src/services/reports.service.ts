import { db } from "@/db/client";
import {
  reports,
  report_complaints,
  report_feature_gaps,
  report_pricing_tiers,
  report_pricing_quotes,
  report_switching,
  report_quotes,
  report_voice_words,
  report_positioning,
  report_actions,
  report_leads,
  report_opportunities,
  report_platform_stats,
  report_subreddits,
  report_threads,
  report_thread_messages,
  type Report,
} from "@/db/schema/reports";
import { report_platform_jobs, report_platform_briefs, synthesis_jobs, report_pipeline_checkpoints } from "@/db/schema/pipeline";
import { report_logs } from "@/db/schema/logs";
import { pipeline_events } from "@/db/schema/pipeline-events";
import { mentions } from "@/db/schema/mentions";
import { report_role_sections } from "@/db/schema/report-role-sections";
import { inngest } from "@/libs/inngest";
import { and, asc, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { createLlmClient, ENABLED_PLATFORMS } from "@rivaleye/shared";
import type { EnabledPlatformId, LlmClient } from "@rivaleye/shared";
import { expandKeywords } from "./keyword-expander";
import type { CreateReportInput } from "@rivaleye/shared";
import { getPipelineEngine } from "@/config/engine";
import { consumeCreditForScan, PaymentRequiredError } from "./billing.service";
export { PaymentRequiredError };

let _llm: LlmClient | null = null;

function getLlm(): LlmClient {
  if (!_llm) {
    _llm = createLlmClient();
  }
  return _llm;
}

const RETRY_MAX_PER_HOUR = Number(process.env.REPORT_RETRY_MAX_PER_HOUR ?? 10);

/**
 * Per-report retry throttle. Retry endpoints re-queue a full platform scrape or
 * the whole synthesis chain (paid scraper + LLM work) and are owner-authenticated
 * but were otherwise unbounded — a user (or a stolen session) could spam retries
 * for unlimited re-runs. We record each retry as a report_logs row and cap the
 * count per rolling hour. Uses the existing (report_id, created_at) index; no new
 * table. The per-report LLM token budget (worker side) is the hard cost ceiling;
 * this is the request-rate guard.
 */
async function checkAndRecordRetry(reportId: string, kind: string): Promise<boolean> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(report_logs)
    .where(
      and(
        eq(report_logs.report_id, reportId),
        eq(report_logs.stage, "retry"),
        gt(report_logs.created_at, sql`now() - interval '1 hour'`),
      ),
    );
  if ((rows[0]?.count ?? 0) >= RETRY_MAX_PER_HOUR) return false;
  await db.insert(report_logs).values({
    report_id: reportId,
    level: "info",
    stage: "retry",
    message: `retry requested: ${kind}`,
  });
  return true;
}

async function assertReportOwned(id: string, owner_id: string): Promise<Report | null> {
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.owner_id !== owner_id) return null;
  return row;
}

export async function listReports(owner_id: string) {
  return db
    .select({
      id: reports.id,
      primary_competitor_name: reports.primary_competitor_name,
      primary_competitor_domain: reports.primary_competitor_domain,
      category: reports.category,
      status: reports.status,
      stage: reports.stage,
      created_at: reports.created_at,
      sentiment_overall: reports.sentiment_overall,
      total_sources: reports.total_sources,
    })
    .from(reports)
    .where(eq(reports.owner_id, owner_id))
    .orderBy(desc(reports.created_at));
}

function inferCompetitorDomain(name: string, websiteUrl?: string): string | null {
  if (websiteUrl) {
    try {
      return new URL(websiteUrl).hostname.replace(/^www\./, "");
    } catch {
      // fall through
    }
  }
  // Don't guess a .com domain — the frontend's KNOWN_DOMAINS map handles
  // well-known SaaS tools (e.g. linear → linear.app, not linear.com).
  return null;
}

/**
 * Smart rescan: Check for existing successful platform data for a competitor.
 * Returns platforms that already have data (don't need to rescrape).
 */
async function findExistingPlatformData(
  owner_id: string,
  competitor: string,
): Promise<{ platform: string; reportId: string; mentionCount: number }[]> {
  const recentReports = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.owner_id, owner_id),
        eq(reports.primary_competitor_name, competitor),
        gt(reports.created_at, sql`now() - interval '30 days'`),
      ),
    )
    .orderBy(desc(reports.created_at))
    .limit(5);

  if (recentReports.length === 0) return [];

  // reportIds are ordered most-recent-first; we use that order to pick the
  // freshest report when a platform has data in more than one past report.
  const reportIds = recentReports.map((r) => r.id);

  const platformData = await db
    .select({
      platform: report_platform_jobs.platform,
      reportId: report_platform_jobs.report_id,
      mentionCount: sql<number>`count(${mentions.id})::int`,
    })
    .from(report_platform_jobs)
    .innerJoin(
      mentions,
      and(
        eq(report_platform_jobs.report_id, mentions.report_id),
        eq(report_platform_jobs.platform, mentions.platform),
      ),
    )
    .where(
      and(
        inArray(report_platform_jobs.report_id, reportIds),
        eq(report_platform_jobs.status, "completed"),
        // Only reuse a platform that also has a Stage A/B brief — synthesis
        // (Stage C) merges briefs, not raw mentions. Reusing a platform without
        // a brief would make Stage C fail with "no platform briefs found".
        sql`EXISTS (SELECT 1 FROM ${report_platform_briefs} b WHERE b.report_id = ${report_platform_jobs.report_id} AND b.platform = ${report_platform_jobs.platform})`,
      ),
    )
    .groupBy(report_platform_jobs.platform, report_platform_jobs.report_id)
    .having(sql`count(${mentions.id}) > 0`);

  // Dedupe to one entry per platform, keeping the most recent report (reportIds
  // is ordered most-recent-first). Prevents duplicate report_platform_jobs rows.
  const reportRank = new Map(reportIds.map((id, idx) => [id, idx]));
  const bestByPlatform = new Map<string, { platform: string; reportId: string; mentionCount: number }>();
  for (const row of platformData) {
    const existing = bestByPlatform.get(row.platform);
    if (!existing || (reportRank.get(row.reportId) ?? Infinity) < (reportRank.get(existing.reportId) ?? Infinity)) {
      bestByPlatform.set(row.platform, row);
    }
  }

  return [...bestByPlatform.values()];
}

/**
 * Copy a platform's data (mentions + Stage A/B brief) from a previous successful
 * scan into a new report, so synthesis can run without re-scraping or re-running
 * the per-platform LLM stages.
 */
async function copyPlatformDataFromPreviousScan(
  newReportId: string,
  previousReportId: string,
  platform: string,
  tx: any,
): Promise<number> {
  const { randomUUID } = await import("node:crypto");

  // Copy the Stage A/B brief — Stage C (merge) reads briefs, not raw mentions.
  const previousBriefs = await tx
    .select()
    .from(report_platform_briefs)
    .where(
      and(
        eq(report_platform_briefs.report_id, previousReportId),
        eq(report_platform_briefs.platform, platform),
      ),
    );

  if (previousBriefs.length > 0) {
    await tx.insert(report_platform_briefs).values(
      previousBriefs.map((b: any) => ({
        ...b,
        id: randomUUID(),
        report_id: newReportId,
        created_at: new Date(),
      })),
    );
  }

  // Copy raw mentions so the report's source-evidence views still resolve.
  const previousMentions = await tx
    .select()
    .from(mentions)
    .where(and(eq(mentions.report_id, previousReportId), eq(mentions.platform, platform)));

  if (previousMentions.length > 0) {
    await tx.insert(mentions).values(
      previousMentions.map((m: any) => ({
        ...m,
        id: randomUUID(),
        report_id: newReportId,
        created_at: new Date(),
      })),
    );
  }

  return previousMentions.length;
}

export async function createReport(
  owner_id: string,
  input: CreateReportInput,
  resumeFromReportId?: string,
): Promise<{ id: string }> {
  const engine = getPipelineEngine();
  const competitor = input.competitors[0] ?? input.category;

  // Rate limit: max 10 scans per hour per user
  const recentCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(eq(reports.owner_id, owner_id), gt(reports.created_at, sql`now() - interval '1 hour'`)));
  if ((recentCount[0]?.count ?? 0) >= 10) throw new Error("Rate limit exceeded: max 10 scans per hour");

  // Infer competitor domain for logo display — non-fatal
  const inferredDomain = inferCompetitorDomain(competitor, input.website_url);

  // Expand keywords BEFORE any DB writes — non-fatal, fall back to competitor name
  let keywords: string[];
  try {
    keywords = await expandKeywords(getLlm(), {
      competitor,
      category: input.category,
      audience: input.target_audience,
      goal: input.founder_goal,
    });
  } catch {
    keywords = [competitor];
  }

  // If resuming from a previous scan, copy successful platform data and only rescan failed ones
  let existingData = [] as Array<{ platform: string; reportId: string }>;
  if (resumeFromReportId) {
    const previousReport = await db
      .select({
        id: reports.id,
      })
      .from(reports)
      .where(and(eq(reports.id, resumeFromReportId), eq(reports.owner_id, owner_id)))
      .limit(1);

    if (previousReport.length === 0) {
      throw new Error("Resume report not found or unauthorized");
    }

    // Get failed platforms from the previous report
    const failedPlatforms = await db
      .select({ platform: report_platform_jobs.platform })
      .from(report_platform_jobs)
      .where(and(
        eq(report_platform_jobs.report_id, resumeFromReportId),
        ne(report_platform_jobs.status, "completed" as const),
      ));

    // Get completed platforms from the previous report to copy data from
    const completedPlatforms = await db
      .select({ platform: report_platform_jobs.platform })
      .from(report_platform_jobs)
      .where(and(
        eq(report_platform_jobs.report_id, resumeFromReportId),
        eq(report_platform_jobs.status, "completed" as const),
      ));

    existingData = completedPlatforms.map((p) => ({
      platform: p.platform,
      reportId: resumeFromReportId,
    }));
  } else {
    // Smart rescan: check for existing platform data from any successful previous scan
    existingData = await findExistingPlatformData(owner_id, competitor);
  }

  const platformsWithData = new Set(existingData.map((p) => p.platform));
  const platformsToScan = input.selected_platforms.filter((p) => !platformsWithData.has(p));

  // Transaction: report + jobs atomic (credit check is inside — atomic with report insert)
  const row = await db.transaction(async (tx) => {
    await consumeCreditForScan(owner_id, competitor, tx);

    const [reportRow] = await tx
      .insert(reports)
      .values({
        owner_id,
        category: input.category,
        competitors: input.competitors,
        audience: input.target_audience,
        goal: input.founder_goal,
        status: "queued",
        stage: "queued",
        primary_competitor_name: competitor,
        primary_competitor_domain: inferredDomain,
        website_url: input.website_url ?? null,
      })
      .returning({ id: reports.id });

    if (!reportRow) throw new Error("Failed to insert report");

    // Copy mentions from previous successful scans for platforms with existing data
    for (const { platform, reportId } of existingData) {
      await copyPlatformDataFromPreviousScan(reportRow.id, reportId, platform, tx);
      await tx.insert(report_platform_jobs).values({
        report_id: reportRow.id,
        platform,
        status: "completed" as const,
        stage: "done" as const,
        completed_at: new Date(),
      });
    }

    if (engine === "postgres") {
      if (platformsToScan.length > 0) {
        await tx.insert(report_platform_jobs).values(
          platformsToScan.map((platform) => ({
            report_id: reportRow.id,
            platform,
            status: "queued" as const,
            // No retries: a failed platform is final and the report proceeds
            // with whatever platforms succeeded, instead of retrying and stalling.
            max_attempts: 1,
          })),
        );
      }
    } else if (engine === "inngest") {
      // Keep existing behavior: all platforms via Inngest
      if (platformsToScan.length > 0) {
        await tx.insert(report_platform_jobs).values(
          platformsToScan.map((platform) => ({
            report_id: reportRow.id,
            platform,
            status: "queued" as const,
            max_attempts: 1,
          })),
        );

        await inngest.send(
          platformsToScan.map((platform) => ({
            name: "scrape.fetch" as const,
            data: {
              reportId: reportRow.id,
              platform,
              competitor,
              category: input.category,
              keywords,
            },
          })),
        );
      }
    }

    return reportRow;
  });

  return { id: row.id };
}

export async function getReport(id: string, owner_id: string) {
  return assertReportOwned(id, owner_id);
}

export async function getProgress(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;

  const [platformRows, events, mentionCount, complaintCount, quoteCount, commentSum] =
    await Promise.all([
      db
        .select({
          platform: report_platform_jobs.platform,
          status: report_platform_jobs.status,
          stage: report_platform_jobs.stage,
          attempt_count: report_platform_jobs.attempt_count,
          last_error: report_platform_jobs.last_error,
          last_event_at: report_platform_jobs.last_event_at,
        })
        .from(report_platform_jobs)
        .where(eq(report_platform_jobs.report_id, id))
        .orderBy(asc(report_platform_jobs.platform)),
      db
        .select({
          stage: pipeline_events.stage,
          event: pipeline_events.event,
          platform: pipeline_events.platform,
          attempt: pipeline_events.attempt,
          duration_ms: pipeline_events.duration_ms,
          created_at: pipeline_events.created_at,
        })
        .from(pipeline_events)
        .where(eq(pipeline_events.report_id, id))
        .orderBy(desc(pipeline_events.created_at))
        .limit(20),
      db.select({ v: sql<number>`count(*)::int` }).from(mentions).where(eq(mentions.report_id, id)),
      db
        .select({ v: sql<number>`count(*)::int` })
        .from(report_complaints)
        .where(eq(report_complaints.report_id, id)),
      db
        .select({ v: sql<number>`count(*)::int` })
        .from(report_quotes)
        .where(eq(report_quotes.report_id, id)),
      db
        .select({ v: sql<number>`coalesce(sum(num_comments), 0)::int` })
        .from(mentions)
        .where(eq(mentions.report_id, id)),
    ]);

  return {
    report: {
      id: owned.id,
      status: owned.status,
      partial: owned.partial,
      failed_platforms: owned.failed_platforms,
    },
    platforms: platformRows,
    events,
    metrics: {
      mentions: Number(mentionCount[0]?.v ?? 0),
      comments: Number(commentSum[0]?.v ?? 0),
      quotes: Number(quoteCount[0]?.v ?? 0),
      complaints: Number(complaintCount[0]?.v ?? 0),
    },
  };
}

export async function getComplaints(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_complaints)
    .where(eq(report_complaints.report_id, id))
    .orderBy(asc(report_complaints.sort_order));
}

export async function getFeatureGaps(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_feature_gaps)
    .where(eq(report_feature_gaps.report_id, id))
    .orderBy(asc(report_feature_gaps.sort_order));
}

export async function getPricing(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  const [tiers, quotes] = await Promise.all([
    db
      .select()
      .from(report_pricing_tiers)
      .where(eq(report_pricing_tiers.report_id, id))
      .orderBy(asc(report_pricing_tiers.sort_order)),
    db
      .select()
      .from(report_pricing_quotes)
      .where(eq(report_pricing_quotes.report_id, id))
      .orderBy(asc(report_pricing_quotes.sort_order)),
  ]);
  return {
    tiers,
    quotes,
    blended: owned.pricing_blended,
    pain_score: owned.pricing_pain_score,
  };
}

export async function getSwitching(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  const rows = await db
    .select()
    .from(report_switching)
    .where(eq(report_switching.report_id, id))
    .orderBy(asc(report_switching.sort_order));
  return {
    inbound: rows.filter((r) => r.direction === "inbound"),
    outbound: rows.filter((r) => r.direction === "outbound"),
    net_signal: owned.switching_net_signal,
    reasons_out: owned.switching_reasons_out ?? [],
  };
}

export async function getQuotes(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_quotes)
    .where(eq(report_quotes.report_id, id))
    .orderBy(asc(report_quotes.sort_order));
}

export async function getVoice(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  const words = await db
    .select()
    .from(report_voice_words)
    .where(eq(report_voice_words.report_id, id))
    .orderBy(asc(report_voice_words.sort_order));
  return {
    summary: owned.voice_summary,
    phrases: owned.voice_phrases ?? [],
    positive: words.filter((w) => w.kind === "positive"),
    negative: words.filter((w) => w.kind === "negative"),
  };
}

export async function getPositioning(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_positioning)
    .where(eq(report_positioning.report_id, id))
    .orderBy(asc(report_positioning.sort_order));
}

export async function getActions(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_actions)
    .where(eq(report_actions.report_id, id))
    .orderBy(asc(report_actions.sort_order));
}

export async function getLeads(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_leads)
    .where(eq(report_leads.report_id, id))
    .orderBy(asc(report_leads.sort_order));
}

export async function getOpportunities(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_opportunities)
    .where(eq(report_opportunities.report_id, id))
    .orderBy(asc(report_opportunities.sort_order));
}

export async function getPlatforms(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_platform_stats)
    .where(eq(report_platform_stats.report_id, id))
    .orderBy(asc(report_platform_stats.sort_order));
}

export async function getSubreddits(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_subreddits)
    .where(eq(report_subreddits.report_id, id))
    .orderBy(asc(report_subreddits.sort_order));
}

export async function getSentimentSeries(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return owned.sentiment_series ?? [];
}

export async function getThreads(id: string, owner_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  return db
    .select()
    .from(report_threads)
    .where(eq(report_threads.report_id, id))
    .orderBy(asc(report_threads.sort_order));
}

export async function getLogs(id: string, owner_id: string, since?: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  const sinceDate = since ? new Date(since) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) {
    throw new Error("invalid 'since' timestamp");
  }
  return db
    .select({
      id: report_logs.id,
      level: report_logs.level,
      stage: report_logs.stage,
      platform: report_logs.platform,
      message: report_logs.message,
      meta: report_logs.meta,
      created_at: report_logs.created_at,
    })
    .from(report_logs)
    .where(
      sinceDate
        ? and(eq(report_logs.report_id, id), gt(report_logs.created_at, sinceDate))
        : eq(report_logs.report_id, id),
    )
    .orderBy(asc(report_logs.created_at));
}

export async function getThread(id: string, owner_id: string, thread_id: string) {
  const owned = await assertReportOwned(id, owner_id);
  if (!owned) return null;
  const threadRows = await db
    .select()
    .from(report_threads)
    .where(and(eq(report_threads.id, thread_id), eq(report_threads.report_id, id)))
    .limit(1);
  const thread = threadRows[0];
  if (!thread) return null;
  const messages = await db
    .select()
    .from(report_thread_messages)
    .where(eq(report_thread_messages.thread_id, thread_id))
    .orderBy(asc(report_thread_messages.sort_order));
  return { thread, messages };
}

export async function retryPlatform(
  owner_id: string,
  reportId: string,
  platform: EnabledPlatformId,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const engine = getPipelineEngine();
  const report = await assertReportOwned(reportId, owner_id);
  if (!report) return { ok: false, reason: "not_found" };

  const [job] = await db
    .select()
    .from(report_platform_jobs)
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    )
    .limit(1);
  if (!job) return { ok: false, reason: "platform_not_in_report" };
  if (job.status === "running") return { ok: false, reason: "already_running" };
  if (!(await checkAndRecordRetry(reportId, `platform:${platform}`))) {
    return { ok: false, reason: "retry_rate_limited" };
  }

  await db
    .update(report_platform_jobs)
    .set({
      status: "queued",
      stage: "scrape",
      attempt_count: 0,
      last_error: null,
      started_at: null,
      completed_at: null,
    })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );

  if (engine === "inngest") {
    await inngest.send({
      name: "scrape.fetch",
      data: {
        reportId,
        platform,
        competitor: report.competitors[0] ?? "",
        category: report.category,
        keywords: [],
      },
    });
  }
  // postgres mode: job is queued in DB; worker will claim it

  return { ok: true };
}

export async function retrySynthesis(
  owner_id: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const report = await assertReportOwned(reportId, owner_id);
  if (!report) return { ok: false, reason: "not_found" };
  if (!(await checkAndRecordRetry(reportId, "synthesis"))) {
    return { ok: false, reason: "retry_rate_limited" };
  }

  // Find an existing synthesis job in a terminal or stuck state.
  const [job] = await db
    .select()
    .from(synthesis_jobs)
    .where(eq(synthesis_jobs.report_id, reportId))
    .limit(1);

  if (job) {
    // Block retry only if the job is actively running AND was locked recently
    // (i.e. genuinely in-flight). A queued job or a running job that has been
    // locked for >15 min is considered stuck and should be force-retried.
    const STUCK_THRESHOLD_MS = 15 * 60 * 1000;
    const lockedRecently =
      job.locked_at !== null &&
      Date.now() - new Date(job.locked_at).getTime() < STUCK_THRESHOLD_MS;

    if (job.status === "running" && lockedRecently) {
      return { ok: false, reason: "already_running" };
    }

    // Reset queued/stuck-running/failed/cancelled job back to queued.
    await db
      .update(synthesis_jobs)
      .set({
        status: "queued",
        run_after: new Date(),
        locked_at: null,
        locked_by: null,
        last_error: null,
        attempt_count: 0,
        updated_at: new Date(),
      })
      .where(eq(synthesis_jobs.id, job.id));
  } else {
    // No synthesis job exists yet — create one so the worker can run it.
    await db.insert(synthesis_jobs).values({
      report_id: reportId,
      status: "queued",
      run_after: new Date(),
      attempt_count: 0,
      max_attempts: 3,
    });
  }

  // Clear D and E checkpoints so the synthesis stages re-run completely fresh.
  // Role synthesis failure is silently swallowed by the pipeline, meaning the
  // D checkpoint can be saved with no _role_sections — every retry would then
  // re-enter the same failure loop. Deleting these checkpoints forces a clean
  // re-run of stages C→D→E from the already-saved B briefs.
  await db
    .delete(report_pipeline_checkpoints)
    .where(
      and(
        eq(report_pipeline_checkpoints.report_id, reportId),
        inArray(report_pipeline_checkpoints.stage, ["C", "D", "E"]),
      ),
    );

  // Ensure the report itself is back in a running state.
  await db
    .update(reports)
    .set({ status: "running", stage: "clustering", updated_at: new Date() })
    .where(eq(reports.id, reportId));

  return { ok: true };
}

export async function cancelReport(
  owner_id: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const report = await assertReportOwned(reportId, owner_id);
  if (!report) return { ok: false, reason: "not_found" };
  await db.transaction(async (tx) => {
    await tx
      .update(reports)
      .set({ status: "cancelled", stage: "cancelled", updated_at: new Date() })
      .where(eq(reports.id, reportId));
    await tx
      .update(report_platform_jobs)
      .set({ status: "cancelled" })
      .where(eq(report_platform_jobs.report_id, reportId));
    // Also cancel any queued/in-flight synthesis job so resynthesis/recovery
    // doesn't keep working (or resurrect) a cancelled report.
    await tx
      .update(synthesis_jobs)
      .set({ status: "cancelled" })
      .where(eq(synthesis_jobs.report_id, reportId));
  });
  return { ok: true };
}

export async function getReportSections(reportId: string, owner_id: string): Promise<{
  overview: unknown | null;
  summary: unknown | null;
  founder: unknown | null;
  product: unknown | null;
  marketing: unknown | null;
  growth: unknown | null;
  evidence: unknown | null;
} | null> {
  const owned = await assertReportOwned(reportId, owner_id);
  if (!owned) return null;

  const rows = await db
    .select()
    .from(report_role_sections)
    .where(eq(report_role_sections.report_id, reportId));

  const byType = new Map(rows.map((r) => [r.section_type, r.data]));

  return {
    overview: byType.get("overview") ?? null,
    summary: byType.get("summary") ?? null,
    founder: byType.get("founder") ?? null,
    product: byType.get("product") ?? null,
    marketing: byType.get("marketing") ?? null,
    growth: byType.get("growth") ?? null,
    evidence: byType.get("evidence") ?? null,
  };
}
