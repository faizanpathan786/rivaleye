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
import { report_platform_jobs } from "@/db/schema/pipeline";
import { report_logs } from "@/db/schema/logs";
import { pipeline_events } from "@/db/schema/pipeline-events";
import { mentions } from "@/db/schema/mentions";
import { report_role_sections } from "@/db/schema/report-role-sections";
import { inngest } from "@/libs/inngest";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { OpenRouterClient, ENABLED_PLATFORMS, readOpenRouterApiKey, LLM_MODEL } from "@rivaleye/shared";
import type { EnabledPlatformId } from "@rivaleye/shared";
import { expandKeywords } from "./keyword-expander";
import type { CreateReportInput } from "@rivaleye/shared";
import { getPipelineEngine } from "@/config/engine";

let _llm: OpenRouterClient | null = null;

function getLlm(): OpenRouterClient {
  if (!_llm) {
    _llm = new OpenRouterClient({ apiKey: readOpenRouterApiKey(), model: LLM_MODEL });
  }
  return _llm;
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
      category: reports.category,
      status: reports.status,
      stage: reports.stage,
      created_at: reports.created_at,
      sentiment_overall: reports.sentiment_overall,
      total_sources: reports.total_sources,
    })
    .from(reports)
    .where(eq(reports.owner_id, owner_id))
    .orderBy(asc(reports.created_at));
}

export async function createReport(
  owner_id: string,
  input: CreateReportInput,
): Promise<{ id: string }> {
  const engine = getPipelineEngine();
  const competitor = input.competitors[0] ?? input.category;

  // Rate limit: max 10 scans per hour per user
  const recentCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(eq(reports.owner_id, owner_id), gt(reports.created_at, sql`now() - interval '1 hour'`)));
  if ((recentCount[0]?.count ?? 0) >= 10) throw new Error("Rate limit exceeded: max 10 scans per hour");

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

  // Transaction: report + jobs atomic
  const row = await db.transaction(async (tx) => {
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
        website_url: input.website_url ?? null,
      })
      .returning({ id: reports.id });

    if (!reportRow) throw new Error("Failed to insert report");

    if (engine === "postgres") {
      await tx.insert(report_platform_jobs).values(
        input.selected_platforms.map((platform) => ({
          report_id: reportRow.id,
          platform,
          status: "queued" as const,
        })),
      );
    } else if (engine === "inngest") {
      // Keep existing behavior: all platforms via Inngest
      await tx.insert(report_platform_jobs).values(
        input.selected_platforms.map((platform) => ({
          report_id: reportRow.id,
          platform,
          status: "queued" as const,
        })),
      );

      await inngest.send(
        input.selected_platforms.map((platform) => ({
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

export async function cancelReport(
  owner_id: string,
  reportId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const report = await assertReportOwned(reportId, owner_id);
  if (!report) return { ok: false, reason: "not_found" };
  await db
    .update(reports)
    .set({ status: "cancelled", stage: "cancelled", updated_at: new Date() })
    .where(eq(reports.id, reportId));
  return { ok: true };
}

export async function getReportSections(reportId: string): Promise<{
  overview: unknown | null;
  summary: unknown | null;
  founder: unknown | null;
  product: unknown | null;
  marketing: unknown | null;
  growth: unknown | null;
  evidence: unknown | null;
}> {
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
