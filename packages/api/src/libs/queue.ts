import PgBoss from "pg-boss";
import type { PlatformId } from "@rivaleye/scrapers";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

const boss = new PgBoss({ connectionString });
let started = false;

async function ensureStarted() {
  if (!started) {
    await boss.start();
    started = true;
  }
}

export const QUEUES = {
  scrapePlatform: "scrape-platform",
  generateReport: "generate-report",
} as const;

export interface ScrapePlatformJob {
  reportId: string;
  platform: PlatformId;
  competitor: string;
  category?: string;
  keywords?: string[];
}

export async function enqueueScrapePlatform(job: ScrapePlatformJob) {
  await ensureStarted();
  return boss.send(QUEUES.scrapePlatform, job);
}

export async function enqueueGenerateReport(reportId: string) {
  await ensureStarted();
  return boss.send(QUEUES.generateReport, { reportId });
}
