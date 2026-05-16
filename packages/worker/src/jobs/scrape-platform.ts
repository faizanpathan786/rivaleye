import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import { getScraper } from "@rivaleye/scrapers";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_briefs,
  report_platform_jobs,
} from "../../../api/src/db/schema/pipeline.js";
import { boss, QUEUES } from "../queue.js";
import type { ScrapePlatformJob } from "../queue.js";
import { db } from "../db.js";
import { runStageAExtract } from "../pipeline/stage-a-extract.js";
import { runStageBSummarize } from "../pipeline/stage-b-summarize.js";
import { and, eq } from "drizzle-orm";

const CHUNK_SIZE = 500;

let _llm: OpenRouterClient | null = null;

function getLlm(): OpenRouterClient {
  if (!_llm) {
    _llm = new OpenRouterClient({
      apiKey: readOpenRouterApiKey(),
      model: LLM_MODEL,
    });
  }
  return _llm;
}

export async function handleScrapePlatform(data: ScrapePlatformJob): Promise<void> {
  console.log(
    `[scrape] start reportId=${data.reportId} platform=${data.platform} competitor="${data.competitor}"`,
  );

  await markRunning(data.reportId, data.platform);

  let postCount = 0;

  try {
    const report = await loadReport(data.reportId);

    const scraper = getScraper(data.platform);
    const posts = await scraper.fetch({
      competitor: data.competitor,
      category: data.category,
      keywords: data.keywords,
    });

    postCount = posts.length;
    console.log(`[scrape] fetched ${postCount} posts for ${data.platform}/${data.competitor}`);

    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      const chunk = posts.slice(i, i + CHUNK_SIZE);
      await db
        .insert(mentions)
        .values(
          chunk.map((p) => ({
            report_id: data.reportId,
            platform: p.platform,
            external_id: p.externalId,
            url: p.url,
            author: p.author,
            title: p.title,
            body: p.body,
            score: p.score,
            num_comments: p.numComments,
            posted_at: p.createdAt,
            raw: p.raw as Record<string, unknown>,
          })),
        )
        .onConflictDoNothing();
    }

    await db
      .update(reports)
      .set({ status: "running", updated_at: new Date() })
      .where(eq(reports.id, data.reportId));

    if (posts.length > 0) {
      const llm = getLlm();
      const ctx = {
        reportId: data.reportId,
        competitor: data.competitor,
        category: data.category ?? "",
        audience: report.audience ?? null,
        goal: report.goal,
      };

      const stageA = await runStageAExtract({ llm, ctx, platform: data.platform, posts });
      console.log(
        `[scrape] stage A done platform=${data.platform} tokens=${stageA.usage.promptTokens}+${stageA.usage.completionTokens}`,
      );

      const stageB = await runStageBSummarize({
        llm,
        ctx,
        platform: data.platform,
        extract: stageA.extract,
      });
      console.log(
        `[scrape] stage B done platform=${data.platform} tokens=${stageB.usage.promptTokens}+${stageB.usage.completionTokens}`,
      );

      const totalPrompt = stageA.usage.promptTokens + stageB.usage.promptTokens;
      const totalCompletion = stageA.usage.completionTokens + stageB.usage.completionTokens;

      await db
        .insert(report_platform_briefs)
        .values({
          report_id: data.reportId,
          platform: data.platform,
          extract: stageA.extract as Record<string, unknown>,
          summary: stageB.brief as Record<string, unknown>,
          model_used: stageB.model,
          prompt_tokens: totalPrompt,
          completion_tokens: totalCompletion,
        })
        .onConflictDoNothing();
    }

    await markCompleted(data.reportId, data.platform);
    await fanIn(data.reportId);
  } catch (err) {
    await markFailed(data.reportId, data.platform, asMessage(err));
    await fanIn(data.reportId);
    throw err;
  }
}

async function loadReport(reportId: string) {
  const rows = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  const report = rows[0];
  if (!report) throw new Error(`Report ${reportId} not found`);
  return report;
}

async function markRunning(reportId: string, platform: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "running", started_at: new Date() })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

async function markCompleted(reportId: string, platform: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "completed", completed_at: new Date() })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

async function markFailed(reportId: string, platform: string, error: string): Promise<void> {
  await db
    .update(report_platform_jobs)
    .set({ status: "failed", error, completed_at: new Date() })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

async function fanIn(reportId: string): Promise<void> {
  const rows = await db
    .select({ status: report_platform_jobs.status })
    .from(report_platform_jobs)
    .where(eq(report_platform_jobs.report_id, reportId));

  const stillActive = rows.filter((r) => r.status === "queued" || r.status === "running");

  if (stillActive.length === 0) {
    await boss.send(QUEUES.generateReport, { reportId });
    console.log(`[scrape] fan-in: enqueued generate-report for reportId=${reportId}`);
  } else {
    console.log(
      `[scrape] fan-in: ${stillActive.length} platform job(s) still active for reportId=${reportId}`,
    );
  }
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
