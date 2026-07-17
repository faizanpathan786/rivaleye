/**
 * Local end-to-end pipeline driver for the ZERO-COST verification path.
 *
 * Seeds a user + a queued report with N platform jobs, then polls until the
 * report reaches a terminal state. Requires the scrape + synth workers to be
 * running against the same DB with LLM_PROVIDER=mock and SCRAPER_PROVIDER=fixtures.
 *
 * Usage:
 *   bun --env-file=.env.e2e src/scripts/e2e-local.ts "Notion" reddit,hackernews,devto
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../../api/src/db/schema/users.js";
import { user_credits } from "../../../api/src/db/schema/billing.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import {
  report_platform_jobs,
  report_platform_briefs,
} from "../../../api/src/db/schema/pipeline.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import {
  report_complaints,
  report_opportunities,
  report_actions,
} from "../../../api/src/db/schema/reports.js";

const competitor = process.argv[2] ?? "Notion";
const platforms = (process.argv[3] ?? "reddit,hackernews,devto").split(",").map((p) => p.trim());

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const email = `e2e+${randomUUID().slice(0, 8)}@example.com`;
  const [user] = await db
    .insert(users)
    .values({ id: randomUUID(), name: "E2E", email, emailVerified: true })
    .returning({ id: users.id });
  const ownerId = user!.id;
  await db.insert(user_credits).values({ user_id: ownerId, balance: 100, free_scan_used: false });

  const [report] = await db
    .insert(reports)
    .values({
      owner_id: ownerId,
      category: "productivity software",
      competitors: [competitor],
      audience: "product teams",
      goal: "find_weaknesses",
      status: "queued",
      stage: "queued",
      primary_competitor_name: competitor,
    })
    .returning({ id: reports.id });
  const reportId = report!.id;

  await db.insert(report_platform_jobs).values(
    platforms.map((platform) => ({
      report_id: reportId,
      platform,
      status: "queued" as const,
      stage: "queued",
      attempt_count: 0,
      max_attempts: 3,
      run_after: new Date(),
    })),
  );

  console.log(`[e2e] reportId=${reportId} platforms=${platforms.join(",")} — waiting for workers…`);

  const deadline = Date.now() + 5 * 60 * 1000;
  let last = "";
  while (Date.now() < deadline) {
    const [r] = await db
      .select({ status: reports.status, stage: reports.stage })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);
    const jobs = await db
      .select({ status: report_platform_jobs.status })
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));
    const jobSummary = jobs.reduce<Record<string, number>>((acc, j) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {});
    const line = `status=${r?.status} stage=${r?.stage} jobs=${JSON.stringify(jobSummary)}`;
    if (line !== last) {
      console.log(`[e2e] +${((Date.now() - t0) / 1000).toFixed(1)}s ${line}`);
      last = line;
    }
    if (r?.status === "completed" || r?.status === "failed") break;
    await sleep(1000);
  }

  const [final] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);

  const counts = {
    mentions: await count(mentions, reportId),
    briefs: await count(report_platform_briefs, reportId),
    complaints: await count(report_complaints, reportId),
    opportunities: await count(report_opportunities, reportId),
    actions: await count(report_actions, reportId),
  };

  console.log("\n===== E2E RESULT =====");
  console.log(`reportId:      ${reportId}`);
  console.log(`status:        ${final?.status}  stage: ${final?.stage}`);
  console.log(`partial:       ${final?.partial}  total_sources: ${final?.total_sources}`);
  console.log(`error:         ${final?.error ?? "(none)"}`);
  console.log(`elapsed:       ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`row counts:    ${JSON.stringify(counts)}`);

  const ok =
    final?.status === "completed" &&
    counts.mentions > 0 &&
    counts.briefs > 0 &&
    (counts.complaints > 0 || counts.opportunities > 0);
  console.log(`\n${ok ? "✅ PASS" : "❌ FAIL"} — full mock pipeline ${ok ? "produced a populated report" : "did not complete correctly"}`);
  process.exit(ok ? 0 : 1);
}

async function count(table: { report_id: unknown }, reportId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table as never)
    .where(eq((table as { report_id: never }).report_id, reportId as never));
  return row?.n ?? 0;
}

main().catch((err) => {
  console.error("[e2e] driver error:", err);
  process.exit(1);
});
