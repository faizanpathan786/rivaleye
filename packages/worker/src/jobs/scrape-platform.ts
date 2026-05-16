import { getScraper } from "@rivaleye/scrapers";
import type { ScrapePlatformJob } from "../queue";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { boss, QUEUES } from "../queue";
import { eq } from "drizzle-orm";

const CHUNK_SIZE = 500;

export async function handleScrapePlatform(data: ScrapePlatformJob) {
  console.log(`[scrape] start reportId=${data.reportId} platform=${data.platform} competitor="${data.competitor}"`);

  const scraper = getScraper(data.platform);
  const posts = await scraper.fetch({
    competitor: data.competitor,
    category: data.category,
    keywords: data.keywords,
  });

  console.log(`[scrape] fetched ${posts.length} posts for ${data.platform}/${data.competitor}`);

  // Bulk-insert in chunks, skip conflicts (idempotent)
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

  console.log(`[scrape] inserted mentions, updating report status → running`);

  // Transition report to "running" if still queued
  await db
    .update(reports)
    .set({ status: "running", updated_at: new Date() })
    .where(eq(reports.id, data.reportId));

  // Fan-in: for MVP (Reddit only), enqueue generate-report immediately
  await boss.send(QUEUES.generateReport, { reportId: data.reportId });
  console.log(`[scrape] enqueued generate-report for reportId=${data.reportId}`);

  return { count: posts.length };
}
