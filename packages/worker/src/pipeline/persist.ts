import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  report_actions,
  report_complaints,
  report_feature_gaps,
  report_leads,
  report_opportunities,
  report_platform_stats,
  report_positioning,
  report_pricing_quotes,
  report_pricing_tiers,
  report_quotes,
  report_role_sections,
  report_section_type_enum,
  report_subreddits,
  report_switching,
  report_thread_messages,
  report_threads,
  report_voice_words,
  reports,
} from "../../../api/src/db/schema/index.js";
import type { SynthOutput } from "../prompts/shared";
import type { RoleSections } from "../prompts/role-sections/schema";
import { PipelineError } from "./errors";

export interface PlatformStatRow {
  platform: string;
  label: string;
  count: number;
}

export interface SubredditRow {
  subreddit: string;
  count: number;
}

export interface PersistInput {
  reportId: string;
  synth: SynthOutput;
  platformStats: PlatformStatRow[];
  subreddits: SubredditRow[];
  roleSections?: RoleSections;
}

export async function persistReport(input: PersistInput): Promise<void> {
  const { reportId, synth, platformStats, subreddits, roleSections } = input;

  try {
    await db.transaction(async (tx) => {
      await tx.delete(report_complaints).where(eq(report_complaints.report_id, reportId));
      await tx.delete(report_feature_gaps).where(eq(report_feature_gaps.report_id, reportId));
      await tx.delete(report_pricing_tiers).where(eq(report_pricing_tiers.report_id, reportId));
      await tx.delete(report_pricing_quotes).where(eq(report_pricing_quotes.report_id, reportId));
      await tx.delete(report_switching).where(eq(report_switching.report_id, reportId));
      await tx.delete(report_quotes).where(eq(report_quotes.report_id, reportId));
      await tx.delete(report_voice_words).where(eq(report_voice_words.report_id, reportId));
      await tx.delete(report_positioning).where(eq(report_positioning.report_id, reportId));
      await tx.delete(report_actions).where(eq(report_actions.report_id, reportId));
      await tx.delete(report_leads).where(eq(report_leads.report_id, reportId));
      await tx.delete(report_opportunities).where(eq(report_opportunities.report_id, reportId));
      await tx.delete(report_platform_stats).where(eq(report_platform_stats.report_id, reportId));
      await tx.delete(report_subreddits).where(eq(report_subreddits.report_id, reportId));

      // Threads cascade-deletes messages via FK, so delete threads last of the child cleanup
      await tx.delete(report_threads).where(eq(report_threads.report_id, reportId));

      if (synth.complaints.length > 0) {
        await tx.insert(report_complaints).values(
          synth.complaints.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.feature_gaps.length > 0) {
        await tx.insert(report_feature_gaps).values(
          synth.feature_gaps.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.pricing_tiers.length > 0) {
        await tx.insert(report_pricing_tiers).values(
          synth.pricing_tiers.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.pricing_quotes.length > 0) {
        await tx.insert(report_pricing_quotes).values(
          synth.pricing_quotes.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.switching.length > 0) {
        await tx.insert(report_switching).values(
          synth.switching.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.quotes.length > 0) {
        await tx.insert(report_quotes).values(
          synth.quotes.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.voice_words.length > 0) {
        await tx.insert(report_voice_words).values(
          synth.voice_words.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.positioning.length > 0) {
        await tx.insert(report_positioning).values(
          synth.positioning.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.actions.length > 0) {
        await tx.insert(report_actions).values(
          synth.actions.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.leads.length > 0) {
        await tx.insert(report_leads).values(
          synth.leads.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (synth.opportunities.length > 0) {
        await tx.insert(report_opportunities).values(
          synth.opportunities.map((item, i) => ({
            report_id: reportId,
            ...item,
            sort_order: i,
          })),
        );
      }

      if (platformStats.length > 0) {
        await tx.insert(report_platform_stats).values(
          platformStats.map((item, i) => ({
            report_id: reportId,
            platform_id: item.platform,
            name: item.label,
            posts: item.count,
            sort_order: i,
          })),
        );
      }

      if (subreddits.length > 0) {
        await tx.insert(report_subreddits).values(
          subreddits.map((item, i) => ({
            report_id: reportId,
            name: item.subreddit,
            posts: item.count,
            sort_order: i,
          })),
        );
      }

      for (let i = 0; i < synth.threads.length; i++) {
        const thread = synth.threads[i];
        if (!thread) continue;

        const { messages, posted_at, ...threadFields } = thread;

        const [insertedThread] = await tx
          .insert(report_threads)
          .values({
            report_id: reportId,
            ...threadFields,
            posted_at: posted_at ? new Date(posted_at) : null,
            sort_order: i,
          })
          .returning({ id: report_threads.id });

        if (!insertedThread) continue;

        if (messages.length > 0) {
          await tx.insert(report_thread_messages).values(
            messages.map((msg, j) => ({
              thread_id: insertedThread.id,
              author: msg.author,
              body: msg.body,
              posted_at: msg.posted_at ? new Date(msg.posted_at) : null,
              score: msg.score,
              sort_order: j,
            })),
          );
        }
      }

      if (roleSections !== undefined) {
        for (const sectionType of report_section_type_enum.enumValues) {
          const data = roleSections[sectionType] as Record<string, unknown> | undefined;
          if (data === undefined) continue;
          await tx
            .insert(report_role_sections)
            .values({
              report_id: reportId,
              section_type: sectionType,
              data,
              updated_at: new Date(),
            })
            .onConflictDoUpdate({
              target: [report_role_sections.report_id, report_role_sections.section_type],
              set: { data, updated_at: new Date() },
            });
        }
      }

      const totalThreads = synth.threads.length;
      const totalSources = platformStats.reduce((s, p) => s + p.count, 0);
      const { report_meta: meta } = synth;

      await tx
        .update(reports)
        .set({
          status: "completed",
          stage: "done",
          sentiment_overall: meta.sentiment_overall,
          sentiment_positive: meta.sentiment_positive,
          sentiment_neutral: meta.sentiment_neutral,
          sentiment_negative: meta.sentiment_negative,
          sentiment_trend: meta.sentiment_trend,
          voice_summary: meta.voice_summary,
          executive_brief: synth.executive_brief || null,
          voice_phrases: meta.voice_phrases,
          pricing_blended: meta.pricing_blended,
          pricing_pain_score: meta.pricing_pain_score,
          switching_net_signal: meta.switching_net_signal,
          switching_reasons_out: meta.switching_reasons_out,
          total_threads: totalThreads,
          total_sources: totalSources,
          scanned_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(reports.id, reportId));
    });
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    throw new PipelineError("persist", "transaction failed", err);
  }
}
