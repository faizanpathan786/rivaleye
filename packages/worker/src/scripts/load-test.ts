/**
 * Load test for the RivalEye pipeline on the ZERO-COST path (mock LLM + fixture
 * scrapers). Seeds many reports under a controlled arrival pattern, then measures
 * throughput, end-to-end latency percentiles, queue-depth behaviour, and the
 * first resource to saturate. Requires scrape + synth workers running against the
 * same DB with LLM_PROVIDER=mock, SCRAPER_PROVIDER=fixtures.
 *
 * Usage:
 *   bun --env-file=.env.e2e src/scripts/load-test.ts <numReports> <platformsPerReport> <arrivalMode>
 *   arrivalMode: "burst" (all at once) | "ramp:<perSec>" (N/sec)
 * Example:
 *   bun --env-file=.env.e2e src/scripts/load-test.ts 100 5 burst
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../../api/src/db/schema/users.js";
import { user_credits } from "../../../api/src/db/schema/billing.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { llm_usage } from "../../../api/src/db/schema/ops.js";

const NUM = Number(process.argv[2] ?? 50);
const PLATFORMS_PER = Number(process.argv[3] ?? 5);
const ARRIVAL = process.argv[4] ?? "burst";
const ALL_PLATFORMS = ["reddit", "hackernews", "devto", "producthunt", "appstore", "playstore", "twitter", "linkedin", "website"];
const PLATFORMS = ALL_PLATFORMS.slice(0, PLATFORMS_PER);

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i]!;
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const [u] = await db.insert(users).values({ name: "Load", email: `load+${randomUUID().slice(0, 8)}@example.com`, email_verified: true }).returning({ id: users.id });
  const ownerId = u!.id;
  await db.insert(user_credits).values({ user_id: ownerId, balance: 1_000_000, free_scan_used: true });

  console.log(`[load] seeding ${NUM} reports x ${PLATFORMS.length} platforms, arrival=${ARRIVAL}`);
  const reportIds: string[] = [];
  const enqueuedAt = new Map<string, number>();

  const seedOne = async (): Promise<void> => {
    const [r] = await db.insert(reports).values({
      owner_id: ownerId, category: "productivity software", competitors: ["LoadCorp"],
      audience: "teams", goal: "find_weaknesses", status: "queued", stage: "queued",
      primary_competitor_name: `LoadCorp-${reportIds.length}`,
    }).returning({ id: reports.id });
    const id = r!.id;
    await db.insert(report_platform_jobs).values(
      PLATFORMS.map((platform) => ({ report_id: id, platform, status: "queued" as const, stage: "queued" as const, attempt_count: 0, max_attempts: 3, run_after: new Date() })),
    );
    reportIds.push(id);
    enqueuedAt.set(id, Date.now());
  };

  const t0 = Date.now();
  if (ARRIVAL.startsWith("ramp:")) {
    const perSec = Number(ARRIVAL.split(":")[1] ?? 10);
    for (let i = 0; i < NUM; i++) {
      await seedOne();
      if ((i + 1) % perSec === 0) await sleep(1000);
    }
  } else {
    // burst: seed as fast as possible in parallel batches
    for (let i = 0; i < NUM; i += 20) {
      await Promise.all(Array.from({ length: Math.min(20, NUM - i) }, () => seedOne()));
    }
  }
  const seedMs = Date.now() - t0;
  console.log(`[load] seeded ${reportIds.length} reports in ${(seedMs / 1000).toFixed(1)}s`);

  // Poll to completion, sampling queue depth every second.
  const completedAt = new Map<string, number>();
  let maxQueued = 0, maxRunning = 0;
  const samples: Array<{ t: number; queued: number; running: number; done: number }> = [];
  const deadline = Date.now() + 20 * 60 * 1000;

  while (Date.now() < deadline) {
    const rows = await db.select({ id: reports.id, status: reports.status }).from(reports).where(inArray(reports.id, reportIds));
    const now = Date.now();
    for (const row of rows) {
      if ((row.status === "completed" || row.status === "failed") && !completedAt.has(row.id)) {
        completedAt.set(row.id, now);
      }
    }
    const [jobAgg] = await db
      .select({ queued: sql<number>`count(*) filter (where status='queued')::int`, running: sql<number>`count(*) filter (where status='running')::int` })
      .from(report_platform_jobs)
      .where(inArray(report_platform_jobs.report_id, reportIds));
    const [synthAgg] = await db
      .select({ queued: sql<number>`count(*) filter (where status='queued')::int`, running: sql<number>`count(*) filter (where status='running')::int` })
      .from(synthesis_jobs)
      .where(inArray(synthesis_jobs.report_id, reportIds));
    const queued = (jobAgg?.queued ?? 0) + (synthAgg?.queued ?? 0);
    const running = (jobAgg?.running ?? 0) + (synthAgg?.running ?? 0);
    maxQueued = Math.max(maxQueued, queued);
    maxRunning = Math.max(maxRunning, running);
    samples.push({ t: Math.round((now - t0) / 1000), queued, running, done: completedAt.size });

    if (completedAt.size >= reportIds.length) break;
    await sleep(1000);
  }

  const latencies = [...completedAt.entries()].map(([id, done]) => done - (enqueuedAt.get(id) ?? t0)).sort((a, b) => a - b);
  const totalWallMs = Date.now() - t0;
  const completedCount = completedAt.size;
  const failedRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reports)
    .where(and(inArray(reports.id, reportIds), eq(reports.status, "failed")));
  const failedCount = failedRows[0]?.n ?? 0;

  const usageRows = await db
    .select({ calls: sql<number>`count(*)::int`, tokens: sql<string>`coalesce(sum(prompt_tokens+completion_tokens),0)::text`, cost: sql<string>`coalesce(sum(est_cost_usd),0)::text` })
    .from(llm_usage);
  const calls = usageRows[0]?.calls ?? 0;
  const tokens = usageRows[0]?.tokens ?? "0";
  const cost = usageRows[0]?.cost ?? "0";

  console.log("\n===== LOAD TEST RESULT =====");
  console.log(`config:            ${NUM} reports x ${PLATFORMS.length} platforms, arrival=${ARRIVAL}`);
  console.log(`seed time:         ${(seedMs / 1000).toFixed(1)}s`);
  console.log(`completed:         ${completedCount}/${reportIds.length}  (failed=${failedCount})`);
  console.log(`total wall time:   ${(totalWallMs / 1000).toFixed(1)}s`);
  console.log(`throughput:        ${(completedCount / (totalWallMs / 1000) * 60).toFixed(1)} reports/min`);
  console.log(`E2E latency p50:   ${(pct(latencies, 50) / 1000).toFixed(1)}s`);
  console.log(`E2E latency p95:   ${(pct(latencies, 95) / 1000).toFixed(1)}s`);
  console.log(`E2E latency p99:   ${(pct(latencies, 99) / 1000).toFixed(1)}s`);
  console.log(`E2E latency max:   ${(pct(latencies, 100) / 1000).toFixed(1)}s`);
  console.log(`max queue depth:   ${maxQueued} queued jobs`);
  console.log(`max running:       ${maxRunning} jobs`);
  console.log(`llm calls (total in db): ${calls}  tokens=${tokens}  cost=$${cost}`);
  console.log(`\nqueue-depth timeline (t=s: queued/running/done):`);
  const step = Math.max(1, Math.floor(samples.length / 20));
  for (let i = 0; i < samples.length; i += step) {
    const s = samples[i]!;
    console.log(`  t=${s.t}s  q=${s.queued}  r=${s.running}  done=${s.done}`);
  }
  process.exit(completedCount === reportIds.length ? 0 : 1);
}

main().catch((e) => { console.error("[load] error:", e); process.exit(1); });
