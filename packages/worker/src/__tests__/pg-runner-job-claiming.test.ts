/**
 * Test suite: Concurrent job claiming with SELECT...FOR UPDATE SKIP LOCKED
 *
 * Verifies that:
 * - Same job is never claimed twice
 * - Multiple workers claim different jobs atomically
 * - FOR UPDATE SKIP LOCKED prevents race conditions
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../../api/src/db/schema/users.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { ENABLED_PLATFORMS } from "@rivaleye/shared";
import { claimSourceJob, claimSynthesisJob } from "../pg-runner/claim";

let testUserId: string;
let testReportId: string;

describe("PG Runner: Concurrent Job Claiming", () => {
  beforeAll(async () => {
    console.log("\n=== Setup: Creating test user and report ===");

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name: "Job Claiming Test User",
        email: `job-claiming-${Date.now()}@example.com`,
        email_verified: true,
        image: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;
    console.log(`✓ Test user created: ${testUserId}`);

    // Create test report
    const [report] = await db
      .insert(reports)
      .values({
        owner_id: testUserId,
        category: "Job Claiming Test",
        competitors: ["Test1", "Test2"],
        audience: "Test",
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
        primary_competitor_name: "Test1",
      })
      .returning({ id: reports.id });

    if (!report) throw new Error("Failed to create test report");
    testReportId = report.id;
    console.log(`✓ Test report created: ${testReportId}`);
  });

  afterAll(async () => {
    console.log("\n=== Cleanup ===");
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
      console.log(`✓ Test user cleaned up`);
    }
  });

  it("source job: claims next queued job and transitions to running", async () => {
    console.log("\n--- Test: Source job claiming ===");

    // Create jobs
    const platform = ENABLED_PLATFORMS[0] ?? "reddit";
    await db.insert(report_platform_jobs).values({
      report_id: testReportId,
      platform,
      status: "queued",
      stage: "scrape",
      attempt_count: 0,
    });

    // Claim the job within a transaction
    const claimedJob = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-1:12345:abc123"),
    );

    expect(claimedJob).toBeDefined();
    expect(claimedJob?.status).toBe("running");
    expect(claimedJob?.locked_by).toBe("worker-1:12345:abc123");
    expect(claimedJob?.attempt_count).toBe(1);
    expect(claimedJob?.locked_at).toBeTruthy();
    expect(claimedJob?.started_at).toBeTruthy();

    console.log(`✓ Job claimed and transitioned to running`);
    console.log(`  - Worker ID: ${claimedJob?.locked_by}`);
    console.log(`  - Attempt count: ${claimedJob?.attempt_count}`);
  });

  it("source job: same job cannot be claimed twice", async () => {
    console.log("\n--- Test: Duplicate claiming prevention ===");

    // Create a job
    const [job] = await db
      .insert(report_platform_jobs)
      .values({
        report_id: testReportId,
        platform: ENABLED_PLATFORMS[1] ?? "g2",
        status: "queued",
        stage: "scrape",
        attempt_count: 0,
      })
      .returning({ id: report_platform_jobs.id });

    if (!job) throw new Error("Failed to create test job");

    // First worker claims it
    const firstClaim = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-1:12345:abc123"),
    );

    expect(firstClaim?.id).toBe(job.id);
    console.log(`✓ Worker-1 claimed job: ${job.id}`);

    // Second worker attempts to claim - should get a different job (or null)
    const secondClaim = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-2:67890:def456"),
    );

    // Should NOT be the same job
    if (secondClaim) {
      expect(secondClaim.id).not.toBe(job.id);
      console.log(`✓ Worker-2 claimed different job: ${secondClaim.id}`);
    } else {
      console.log(`✓ Worker-2 got no job (all available jobs already claimed)`);
    }
  });

  it("source job: multiple workers claim different jobs atomically", async () => {
    console.log("\n--- Test: Multiple workers claiming different jobs ===");

    // Create 3 jobs
    const platforms = ENABLED_PLATFORMS.slice(0, 3);
    const jobIds: string[] = [];

    for (const platform of platforms) {
      const [job] = await db
        .insert(report_platform_jobs)
        .values({
          report_id: testReportId,
          platform,
          status: "queued",
          stage: "scrape",
          attempt_count: 0,
        })
        .returning({ id: report_platform_jobs.id });

      if (job) jobIds.push(job.id);
    }

    console.log(`✓ Created ${jobIds.length} test jobs`);

    // Simulate 3 concurrent workers claiming jobs
    const claims = await Promise.all([
      db.transaction(async (tx) => claimSourceJob(tx as any, "worker-1:111:aaa")),
      db.transaction(async (tx) => claimSourceJob(tx as any, "worker-2:222:bbb")),
      db.transaction(async (tx) => claimSourceJob(tx as any, "worker-3:333:ccc")),
    ]);

    const claimedIds = claims.filter((c) => c !== null).map((c) => c!.id);

    console.log(`✓ Claimed ${claimedIds.length} jobs across 3 workers`);

    // Verify no duplicates
    const uniqueIds = new Set(claimedIds);
    expect(uniqueIds.size).toBe(claimedIds.length);
    console.log(`✓ All claimed job IDs are unique`);

    // Verify each claimed by different worker
    const claimedByWorker = claims.filter((c) => c !== null).map((c) => c!.locked_by);
    const uniqueWorkers = new Set(claimedByWorker);
    expect(uniqueWorkers.size).toBe(claimedByWorker.length);
    console.log(`✓ Each job claimed by a different worker`);
  });

  it("source job: respects run_after timestamp for job scheduling", async () => {
    console.log("\n--- Test: run_after scheduling ===");

    const now = new Date();
    const future = new Date(now.getTime() + 60000); // 1 minute in future

    // Create a job with run_after in the future
    const [futureJob] = await db
      .insert(report_platform_jobs)
      .values({
        report_id: testReportId,
        platform: ENABLED_PLATFORMS[2] ?? "capterra",
        status: "queued",
        stage: "scrape",
        attempt_count: 0,
        run_after: future,
      })
      .returning({ id: report_platform_jobs.id });

    if (!futureJob) throw new Error("Failed to create future job");

    // Try to claim - should return null (job not yet eligible)
    const claim = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-future:123:xyz"),
    );

    expect(claim).toBeNull();
    console.log(`✓ Future job was not claimed (run_after in future)`);

    // Update job's run_after to now (or past)
    await db
      .update(report_platform_jobs)
      .set({ run_after: new Date(now.getTime() - 1000) })
      .where(eq(report_platform_jobs.id, futureJob.id));

    // Now try to claim - should succeed
    const updatedClaim = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-future:123:xyz"),
    );

    expect(updatedClaim).toBeDefined();
    expect(updatedClaim?.id).toBe(futureJob.id);
    console.log(`✓ Job claimed after run_after timestamp passed`);
  });

  it("synthesis job: claims and transitions correctly", async () => {
    console.log("\n--- Test: Synthesis job claiming ===");

    // Create a synthesis job
    const [synthJob] = await db
      .insert(synthesis_jobs)
      .values({
        report_id: testReportId,
        status: "queued",
        attempt_count: 0,
      })
      .returning({ id: synthesis_jobs.id });

    if (!synthJob) throw new Error("Failed to create synthesis job");

    // Claim it
    const claimedSynthJob = await db.transaction(async (tx) =>
      claimSynthesisJob(tx as any, "synth-worker:456:def"),
    );

    expect(claimedSynthJob).toBeDefined();
    expect(claimedSynthJob?.id).toBe(synthJob.id);
    expect(claimedSynthJob?.status).toBe("running");
    expect(claimedSynthJob?.locked_by).toBe("synth-worker:456:def");
    expect(claimedSynthJob?.attempt_count).toBe(1);

    console.log(`✓ Synthesis job claimed and transitioned to running`);
  });

  it("synthesis job: only one synthesis job per report", async () => {
    console.log("\n--- Test: Synthesis job uniqueness per report ===");

    // Try to create a second synthesis job for same report
    let caught = false;
    try {
      await db.insert(synthesis_jobs).values({
        report_id: testReportId,
        status: "queued",
        attempt_count: 0,
      });
    } catch (e) {
      caught = true;
      const err = e as { message?: string };
      expect(
        err.message?.includes("unique") || err.message?.includes("UNIQUE"),
      ).toBeTruthy();
      console.log(`✓ Uniqueness constraint prevents second synthesis job`);
    }

    expect(caught).toBeTruthy();
  });

  it("source job: FOR UPDATE SKIP LOCKED prevents race conditions", async () => {
    console.log("\n--- Test: FOR UPDATE SKIP LOCKED behavior ===");

    // Create multiple jobs
    const jobCount = 5;
    const createdJobs = [];

    for (let i = 0; i < jobCount; i++) {
      const platform = `test-platform-${i}`;
      const [job] = await db
        .insert(report_platform_jobs)
        .values({
          report_id: testReportId,
          platform,
          status: "queued",
          stage: "scrape",
          attempt_count: 0,
        })
        .returning({ id: report_platform_jobs.id });

      if (job) createdJobs.push(job);
    }

    console.log(`✓ Created ${createdJobs.length} test jobs`);

    // Simulate 10 workers trying to claim jobs simultaneously
    const claimAttempts = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        db.transaction(async (tx) =>
          claimSourceJob(tx as any, `worker-stress-${i}:999:stress`),
        ),
      ),
    );

    const successfulClaims = claimAttempts.filter((claim) => claim !== null);
    console.log(`✓ ${successfulClaims.length} workers claimed jobs`);
    console.log(`  Available jobs: ${createdJobs.length}`);

    // Should claim at most as many as we created
    expect(successfulClaims.length).toBeLessThanOrEqual(createdJobs.length);

    // All claimed jobs should be unique
    const claimedIds = successfulClaims.map((c) => c!.id);
    const uniqueClaimedIds = new Set(claimedIds);
    expect(uniqueClaimedIds.size).toBe(claimedIds.length);
    console.log(`✓ All claimed jobs are unique (no duplicates)`);
  });

  it("source job: increments attempt_count on each claim", async () => {
    console.log("\n--- Test: Attempt count increment ===");

    // Create a job
    const [job] = await db
      .insert(report_platform_jobs)
      .values({
        report_id: testReportId,
        platform: "attempt-test-platform",
        status: "queued",
        stage: "scrape",
        attempt_count: 0,
      })
      .returning({ id: report_platform_jobs.id });

    if (!job) throw new Error("Failed to create test job");

    // First claim
    const claim1 = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-attempt-1:111:aaa"),
    );

    expect(claim1?.attempt_count).toBe(1);
    console.log(`✓ First claim: attempt_count = 1`);

    // Mark as queued again (simulating a failure and re-queue)
    await db
      .update(report_platform_jobs)
      .set({ status: "queued", locked_at: null, locked_by: null })
      .where(eq(report_platform_jobs.id, job.id));

    // Second claim
    const claim2 = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-attempt-2:222:bbb"),
    );

    expect(claim2?.attempt_count).toBe(2);
    console.log(`✓ Second claim: attempt_count = 2`);
  });

  it("returns null when no jobs available", async () => {
    console.log("\n--- Test: Empty job queue handling ===");

    // Create a report with no jobs
    const [emptyReport] = await db
      .insert(reports)
      .values({
        owner_id: testUserId,
        category: "Empty Report",
        competitors: ["Test"],
        audience: "Test",
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
      })
      .returning({ id: reports.id });

    if (!emptyReport) throw new Error("Failed to create empty report");

    // Try to claim from empty queue
    const claim = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "worker-empty:999:zzz"),
    );

    expect(claim).toBeNull();
    console.log(`✓ Claiming from empty queue returns null`);
  });
});
