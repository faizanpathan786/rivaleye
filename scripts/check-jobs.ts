// bun --env-file=.env scripts/check-jobs.ts
import { db } from "../packages/worker/src/db";
import { sql } from "drizzle-orm";

const jobs = await db.execute(sql`
  SELECT id, report_id, platform, status, stage, attempt_count, max_attempts,
         run_after, locked_at, locked_by, last_error, created_at
  FROM report_platform_jobs
  WHERE report_id = '3d412886-2b8f-485a-ae6b-cb20571700bc'
  ORDER BY created_at
`);

console.log("Jobs for report 3d412886:");
jobs.rows.forEach(j => {
  console.log(`\n  Platform: ${j.platform}`);
  console.log(`  Status: ${j.status} | Stage: ${j.stage}`);
  console.log(`  Attempts: ${j.attempt_count}/${j.max_attempts}`);
  console.log(`  run_after: ${j.run_after}`);
  console.log(`  locked_at: ${j.locked_at} | locked_by: ${j.locked_by}`);
  console.log(`  last_error: ${j.last_error}`);
});

process.exit(0);
