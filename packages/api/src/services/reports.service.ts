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
import { enqueueScrapePlatform } from "@/libs/queue";
import { and, asc, eq } from "drizzle-orm";
import type { CreateReportInput } from "@rivaleye/shared";

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
  const [row] = await db
    .insert(reports)
    .values({
      owner_id,
      category: input.category,
      competitors: input.competitors,
      audience: input.target_audience,
      goal: input.founder_goal,
      status: "queued",
      stage: "queued",
      primary_competitor_name: input.competitors[0] ?? null,
    })
    .returning({ id: reports.id });

  if (!row) throw new Error("Failed to insert report");

  await enqueueScrapePlatform({
    reportId: row.id,
    platform: "reddit",
    competitor: input.competitors[0] ?? input.category,
    category: input.category,
  });

  return { id: row.id };
}

export async function getReport(id: string, owner_id: string) {
  return assertReportOwned(id, owner_id);
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
