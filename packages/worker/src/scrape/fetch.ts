import { and, eq } from "drizzle-orm";
import { getScraper } from "@rivaleye/scrapers";
import { NonRetriableError } from "inngest";
import { db } from "../db.js";
import { inngest } from "../inngest/client.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs } from "../../../api/src/db/schema/pipeline.js";
import { emit } from "../events/emit.js";
import { PermanentError } from "../errors.js";

const CHUNK_SIZE = 500;

export const scrapeFetch = inngest.createFunction(
  {
    id: "scrape-fetch",
    concurrency: [
      { limit: 8 },
      { limit: 1, key: "event.data.reportId + ':' + event.data.platform" },
    ],
    retries: 3,
    idempotency: "event.data.reportId + ':' + event.data.platform",
    onFailure: async ({ event, error }) => {
      const data = event.data.event.data as { reportId: string; platform: string };
      const { onFailureFinalize } = await import("./fetch.js");
      const { fanInCheck } = await import("../llm/fan-in.js");
      await onFailureFinalize(data.reportId, data.platform, error.message);
      await fanInCheck(data.reportId);
    },
  },
  { event: "scrape.fetch" },
  async ({ event, step, attempt }) => {
    const { reportId, platform, competitor, category, keywords } = event.data;
    const startedAt = Date.now();

    await step.run("emit-started", async () => {
      await emit({
        reportId,
        platform,
        stage: "scrape.fetch",
        event: attempt > 0 ? "retrying" : "started",
        attempt: attempt + 1,
      });
      await db
        .update(report_platform_jobs)
        .set({
          status: "running",
          started_at: new Date(),
          attempt_count: attempt + 1,
          last_event_at: new Date(),
        })
        .where(
          and(
            eq(report_platform_jobs.report_id, reportId),
            eq(report_platform_jobs.platform, platform),
          ),
        );
    });

    try {
      const posts = await step.run("fetch-posts", async () => {
        const scraper = getScraper(platform);
        return scraper.fetch({ competitor, category, keywords });
      });

      await step.run("persist-mentions", async () => {
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
                posted_at: new Date(p.createdAt as unknown as string),
                raw: p.raw as Record<string, unknown>,
              })),
            )
            .onConflictDoNothing();
        }
        await db
          .update(reports)
          .set({ status: "running", updated_at: new Date() })
          .where(eq(reports.id, reportId));
      });

      await step.run("mark-stage-a", async () => {
        await db
          .update(report_platform_jobs)
          .set({ stage: "stage_a", last_event_at: new Date() })
          .where(
            and(
              eq(report_platform_jobs.report_id, reportId),
              eq(report_platform_jobs.platform, platform),
            ),
          );
      });

      await step.run("emit-completed", async () => {
        await emit({
          reportId,
          platform,
          stage: "scrape.fetch",
          event: "completed",
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          metadata: { posts_count: posts.length },
        });
      });

      await step.sendEvent("enqueue-stage-a", {
        name: "llm.stage-a",
        data: { reportId, platform },
      });

      return { posts: posts.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await emit({
        reportId,
        platform,
        stage: "scrape.fetch",
        event: "failed",
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      if (err instanceof PermanentError) {
        await markPlatformFailed(reportId, platform, message);
        const { fanInCheck } = await import("../llm/fan-in.js");
        await fanInCheck(reportId);
        throw new NonRetriableError(message);
      }
      throw err;
    }
  },
);

async function markPlatformFailed(reportId: string, platform: string, error: string) {
  await db
    .update(report_platform_jobs)
    .set({
      status: "failed",
      stage: "failed",
      last_error: error,
      completed_at: new Date(),
    })
    .where(
      and(
        eq(report_platform_jobs.report_id, reportId),
        eq(report_platform_jobs.platform, platform),
      ),
    );
}

export async function onFailureFinalize(reportId: string, platform: string, error: string) {
  await markPlatformFailed(reportId, platform, error);
}
