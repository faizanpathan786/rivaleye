// Trigger a full scan via API: sign-in → create report → poll until done
// Run: bun --env-file=.env scripts/trigger-scan.ts
import { db } from "../packages/worker/src/db";
import { eq } from "drizzle-orm";
import { reports } from "../packages/api/src/db/schema/reports.js";
import { synthesis_jobs, report_platform_jobs } from "../packages/api/src/db/schema/pipeline.js";
import { mentions } from "../packages/api/src/db/schema/mentions.js";
import { sql } from "drizzle-orm";

const API = "http://localhost:4000";
const EMAIL = "test@rivaleye.dev";
const PASSWORD = "TestPass123!";
const COMPETITOR = process.argv[2] ?? "notion";
const PLATFORMS = (process.argv[3] ?? "twitter").split(",");

// ── Sign in ────────────────────────────────────────────────────────────────
const loginRes = await fetch(`${API}/v1/auth/sign-in/email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const cookie = loginRes.headers.get("set-cookie") ?? "";
if (!loginRes.ok) { console.error("Login failed"); process.exit(1); }
console.log(`Signed in. Creating scan for "${COMPETITOR}" on [${PLATFORMS.join(", ")}]...`);

// ── Create report ──────────────────────────────────────────────────────────
const reportRes = await fetch(`${API}/v1/reports`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie },
  body: JSON.stringify({
    category: "productivity tools",
    competitors: [COMPETITOR],
    target_audience: "knowledge workers and developers",
    founder_goal: "find_user_pain",
    selected_platforms: PLATFORMS,
  }),
});
const reportData = await reportRes.json() as any;
if (!reportRes.ok) { console.error("Create report failed:", reportData); process.exit(1); }
const reportId = reportData.data?.id;
console.log(`Report ID: ${reportId}\n`);

// ── Poll until done ────────────────────────────────────────────────────────
let lastLine = "";
while (true) {
  await new Promise(r => setTimeout(r, 6000));

  const [report] = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  const jobs = await db.select().from(report_platform_jobs).where(eq(report_platform_jobs.report_id, reportId));
  const synthJobs = await db.select().from(synthesis_jobs).where(eq(synthesis_jobs.report_id, reportId));
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(mentions).where(eq(mentions.report_id, reportId));

  const jobSummary = jobs.map(j => `${j.platform}=${j.status}(${j.attempt_count})`).join(" ");
  const synthStatus = synthJobs[0] ? `synth=${synthJobs[0].status}(${synthJobs[0].attempt_count})` : "synth=none";
  const line = `[${new Date().toLocaleTimeString()}] ${report?.status}/${report?.stage} | mentions=${count} | ${jobSummary} | ${synthStatus}`;

  if (line !== lastLine) { console.log(line); lastLine = line; }

  if (report?.status === "completed") {
    console.log("\n══ REPORT COMPLETE ══════════════════════════════════════');");
    console.log(`Competitor:        ${report.primary_competitor_name}`);
    console.log(`Total sources:     ${report.total_sources}`);
    console.log(`Sentiment overall: ${report.sentiment_overall} (pos=${report.sentiment_positive} neg=${report.sentiment_negative})`);
    console.log(`Sentiment trend:   ${report.sentiment_trend}`);
    console.log(`\nExecutive brief:\n${report.executive_brief}\n`);
    console.log(`View at: http://localhost:4004/report/${reportId}`);
    break;
  }

  if (report?.status === "failed") {
    console.log(`\nFailed: ${report.error}`);
    jobs.forEach(j => { if (j.last_error) console.log(`  ${j.platform}: ${j.last_error.slice(0, 150)}`); });
    if (synthJobs[0]?.last_error) console.log(`  synth: ${synthJobs[0].last_error.slice(0, 150)}`);
    break;
  }
}
process.exit(0);
