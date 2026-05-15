import PgBoss from "pg-boss";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

export const boss = new PgBoss({ connectionString });

export const QUEUES = {
  scrapePlatform: "scrape-platform",
  generateReport: "generate-report",
} as const;

export interface ScrapePlatformJob {
  reportId: string;
  platform: import("@rivaleye/scrapers").PlatformId;
  competitor: string;
  category?: string;
  keywords?: string[];
}

export interface GenerateReportJob {
  reportId: string;
}
