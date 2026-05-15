import { getScraper } from "@rivaleye/scrapers";
import type { ScrapePlatformJob } from "../queue";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { boss, QUEUES } from "../queue";
import { eq } from "drizzle-orm";

const CHUNK_SIZE = 500;

export async function handleScrapePlatform(data: ScrapePlatformJob) {
  const scraper = getScraper(data.platform);
  const posts = await scraper.fetch({
    competitor: data.competitor,
    category: data.category,
    keywords: data.keywords,
  });

  // Bulk-insert in chunks, skip conflicts (idempotent)
  for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
    const chunk = posts.slice(i, i + CHUNK_SIZE);
    await db
      .insert(mentions)
      .values(
        chunk.map((p) => ({
          reportId: data.reportId,
          platform: p.platform,
          externalId: p.externalId,
          url: p.url,
          author: p.author,
          title: p.title,
          body: p.body,
          score: p.score,
          numComments: p.numComments,
          postedAt: p.createdAt,
          raw: p.raw as Record<string, unknown>,
        })),
      )
      .onConflictDoNothing();
  }

  // Transition report to "running" if still queued
  await db
    .update(reports)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(reports.id, data.reportId));

  // Fan-in: for MVP (Reddit only), enqueue generate-report immediately
  await boss.send(QUEUES.generateReport, { reportId: data.reportId });

  return { count: posts.length };
}
