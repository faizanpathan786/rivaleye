// bun --env-file=.env packages/worker/src/poll-report.ts
import { db } from "./db";
import { eq } from "drizzle-orm";
import { reports } from "../../api/src/db/schema/reports.js";
import { synthesis_jobs } from "../../api/src/db/schema/pipeline.js";

const REPORT_ID = process.argv[2] ?? "3d412886-2b8f-485a-ae6b-cb20571700bc";
let lastLog = "";

while (true) {
  const [report] = await db.select().from(reports).where(eq(reports.id, REPORT_ID)).limit(1);
  const synthJobs = await db.select().from(synthesis_jobs).where(eq(synthesis_jobs.report_id, REPORT_ID));
  const synth = synthJobs[0];

  const line = `[${new Date().toLocaleTimeString()}] report=${report?.status}/${report?.stage} | synth=${synth?.status ?? "none"} (attempt ${synth?.attempt_count ?? 0}/${synth?.max_attempts ?? 0})`;
  if (line !== lastLog) { console.log(line); lastLog = line; }

  if (report?.status === "completed" || report?.status === "failed") {
    console.log("\n── DONE ──");
    console.log(`Status: ${report.status}`);
    if (report.status === "failed") console.log(`Error: ${report.error}`);
    else {
      console.log(`Sentiment overall: ${report.sentiment_overall}`);
      console.log(`Total sources: ${report.total_sources}`);
      console.log(`Executive brief: ${String(report.executive_brief ?? "").slice(0, 200)}`);
    }
    break;
  }
  if (synth?.status === "failed") {
    console.log(`\nSynth failed: ${synth.last_error}`);
    break;
  }
  await new Promise(r => setTimeout(r, 8000));
}
process.exit(0);
