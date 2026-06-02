// bun --env-file=.env packages/worker/src/check-jobs.ts
import { db } from "./db";
import { eq } from "drizzle-orm";
import { report_platform_jobs, synthesis_jobs } from "../../api/src/db/schema/pipeline.js";
import { reports } from "../../api/src/db/schema/reports.js";
import { mentions } from "../../api/src/db/schema/mentions.js";
import { sql } from "drizzle-orm";

const REPORT_ID = process.argv[2] ?? "3d412886-2b8f-485a-ae6b-cb20571700bc";

const [reportRow] = await db.select().from(reports).where(eq(reports.id, REPORT_ID)).limit(1);
const jobs = await db.select().from(report_platform_jobs).where(eq(report_platform_jobs.report_id, REPORT_ID));
const synthJobs = await db.select().from(synthesis_jobs).where(eq(synthesis_jobs.report_id, REPORT_ID));
const [mentionCount] = await db.select({ count: sql<number>`count(*)` }).from(mentions).where(eq(mentions.report_id, REPORT_ID));

console.log(`\nReport: ${reportRow?.status} / ${reportRow?.stage}`);
console.log(`Mentions scraped: ${mentionCount?.count ?? 0}`);
console.log("\nPlatform jobs:");
jobs.forEach(j => {
  console.log(`  ${j.platform}: ${j.status} (attempt ${j.attempt_count}/${j.max_attempts})`);
  if (j.last_error) console.log(`    last_error: ${j.last_error.slice(0, 120)}`);
});
console.log("\nSynthesis jobs:");
if (synthJobs.length === 0) console.log("  NONE — fan-in has not triggered yet");
synthJobs.forEach(j => {
  console.log(`  ${j.id}: ${j.status} (attempt ${j.attempt_count}/${j.max_attempts})`);
  if (j.last_error) console.log(`    error: ${j.last_error}`);
});

process.exit(0);
