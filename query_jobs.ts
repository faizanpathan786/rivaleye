import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { reportPlatformJobs } from "./packages/api/src/db/schema/pipeline.ts";
import { eq, desc } from "drizzle-orm";

const connStr = process.env.CONNECTION_STRING;
if (!connStr) {
  console.error("CONNECTION_STRING not set");
  process.exit(1);
}

const sql = postgres(connStr);
const db = drizzle(sql);

const failedJobs = await db
  .select()
  .from(reportPlatformJobs)
  .where(eq(reportPlatformJobs.status, 'failed'))
  .orderBy(desc(reportPlatformJobs.updatedAt))
  .limit(5);

console.log("=== Last 5 Failed Jobs ===");
failedJobs.forEach((job, i) => {
  console.log(`\n[${i+1}] Platform: ${job.platform}, Status: ${job.status}`);
  console.log(`    Error: ${job.error || 'none'}`);
  console.log(`    Attempts: ${job.attempt}/${job.maxAttempts}`);
  console.log(`    Updated: ${job.updatedAt}`);
});

await sql.end();
