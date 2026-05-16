import PgBoss from "pg-boss";
import type { PlatformId } from "@rivaleye/scrapers";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

console.log(`[queue] connecting to ${connectionString.replace(/:\/\/.*@/, "://***@")}`);

const boss = new PgBoss({ connectionString });

boss.on("error", (err: unknown) => console.error("[queue] pg-boss error:", err));

export const QUEUES = {
  scrapePlatform: "scrape-platform",
  generateReport: "generate-report",
} as const;

let startPromise: Promise<void> | null = null;

async function ensureStarted() {
  if (!startPromise) {
    startPromise = (async () => {
      await boss.start();
      await boss.createQueue(QUEUES.scrapePlatform);
      await boss.createQueue(QUEUES.generateReport);
      console.log("[queue] pg-boss started, queues created");
    })().catch((err) => {
      console.error("[queue] pg-boss start failed:", err);
      startPromise = null;
      throw err;
    });
  }
  await startPromise;
}

export interface ScrapePlatformJob {
  reportId: string;
  platform: PlatformId;
  competitor: string;
  category?: string;
  keywords?: string[];
}

export async function enqueueScrapePlatform(job: ScrapePlatformJob) {
  await ensureStarted();
  const id = await boss.send(QUEUES.scrapePlatform, job);
  console.log(`[queue] sent scrape-platform job id=${id}`);
  return id;
}

export async function enqueueGenerateReport(reportId: string) {
  await ensureStarted();
  const id = await boss.send(QUEUES.generateReport, { reportId });
  console.log(`[queue] sent generate-report job id=${id}`);
  return id;
}
