import { db } from "./packages/api/src/db/index.ts";
import { reportPlatformJobs, reports } from "./packages/api/src/db/schema/pipeline.ts";
import { eq } from "drizzle-orm";

const reportId = "1f1aaf15-d589-4b14-9613-0c5e3ecf47e1";

const report = await db.select().from(reports).where(eq(reports.id, reportId));
console.log("\n=== Report ===");
console.log(report[0]);

const jobs = await db.select().from(reportPlatformJobs).where(eq(reportPlatformJobs.report_id, reportId));
console.log("\n=== Platform Jobs ===");
jobs.forEach(j => {
  console.log(`${j.platform}: ${j.status} - stage: ${j.stage} - error: ${j.error || j.last_error || 'none'}`);
});

process.exit(0);
