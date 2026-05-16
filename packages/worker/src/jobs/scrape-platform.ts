import { LLM_MODEL, OpenRouterClient, readOpenRouterApiKey } from "@rivaleye/shared";
import type { LlmCallOptions } from "@rivaleye/shared";
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
import { log } from "../logger.js";
import { runStageAExtract } from "../pipeline/stage-a-extract.js";
import { runStageBSummarize } from "../pipeline/stage-b-summarize.js";
import { and, eq } from "drizzle-orm";

const CHUNK_SIZE = 500;
const LLM_OPTS_AB: LlmCallOptions = { timeoutMs: 45_000, maxAttempts: 3 };

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
  const { reportId, platform, competitor } = data;

  await log(reportId, "info", "scrape", platform, `start competitor="${competitor}"`);
  await markRunning(reportId, platform);

  try {
    const report = await loadReport(reportId);

    const scraper = getScraper(platform);
    const posts = await scraper.fetch({
      competitor,
      category: data.category,
      keywords: data.keywords,
    });

    await log(reportId, "info", "scrape", platform, `fetched posts`, { postCount: posts.length });

    for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
      const chunk = posts.slice(i, i + CHUNK_SIZE);
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
            posted_at: p.createdAt,
            raw: p.raw as Record<string, unknown>,
          })),
        )
        .onConflictDoNothing();
    }

    await db
      .update(reports)
      .set({ status: "running", updated_at: new Date() })
      .where(eq(reports.id, reportId));

    if (posts.length > 0) {
      const llm = getLlm();
      const ctx = {
        reportId,
        competitor,
        category: data.category ?? "",
        audience: report.audience ?? null,
        goal: report.goal,
      };

      const stageA = await runStageAExtract({ llm, ctx, platform, posts }, LLM_OPTS_AB);
      await log(reportId, "info", "A", platform, `stage A done`, {
        promptTokens: stageA.usage.promptTokens,
        completionTokens: stageA.usage.completionTokens,
      });

      const stageB = await runStageBSummarize(
        { llm, ctx, platform, extract: stageA.extract },
        LLM_OPTS_AB,
      );
      await log(reportId, "info", "B", platform, `stage B done`, {
        promptTokens: stageB.usage.promptTokens,
        completionTokens: stageB.usage.completionTokens,
      });

      const totalPrompt = stageA.usage.promptTokens + stageB.usage.promptTokens;
      const totalCompletion = stageA.usage.completionTokens + stageB.usage.completionTokens;

      await db
        .insert(report_platform_briefs)
        .values({
          report_id: reportId,
          platform,
          extract: stageA.extract as Record<string, unknown>,
          summary: stageB.brief as Record<string, unknown>,
          model_used: stageB.model,
          prompt_tokens: totalPrompt,
          completion_tokens: totalCompletion,
        })
        .onConflictDoNothing();
    }

    await markCompleted(reportId, platform);
    await fanIn(reportId);
  } catch (err) {
    await log(reportId, "error", "scrape", platform, "scrape failed", { error: asMessage(err) });
    await markFailed(reportId, platform, asMessage(err));
    await fanIn(reportId);
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
    await log(reportId, "info", "scrape", null, `fan-in: enqueued generate-report`);
  } else {
    await log(reportId, "info", "scrape", null, `fan-in: waiting`, {
      stillActive: stillActive.length,
    });
  }
}

function asMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
