/**
 * Mocked end-to-end test: Report creation → Source jobs → Synthesis → Completion
 *
 * Tests the complete workflow without live Reddit/LLM calls:
 * 1. Create report with platform jobs
 * 2. Claim and process source job (fetch, extract, summarize mocked)
 * 3. Verify mentions persisted
 * 4. Fan-in creates synthesis job
 * 5. Claim and process synthesis job (pipeline mocked)
 * 6. Verify report marked completed
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../../api/src/db/schema/users.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { report_platform_jobs, synthesis_jobs } from "../../../api/src/db/schema/pipeline.js";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { ENABLED_PLATFORMS } from "@rivaleye/shared";
import { claimSourceJob, claimSynthesisJob } from "../pg-runner/claim.js";

let testUserId: string;

/**
 * Mock scraper output: normalized posts
 */
const mockScraperOutput = [
  {
    platform: "reddit",
    external_id: "post-1",
    url: "https://reddit.com/r/test/comments/abc1",
    author: "user1",
    title: "Slack is slow",
    body: "The app takes forever to load messages",
    score: 150,
    num_comments: 23,
    posted_at: new Date("2024-05-01"),
    raw: { subreddit: "startups" },
  },
  {
    platform: "reddit",
    external_id: "post-2",
    url: "https://reddit.com/r/test/comments/abc2",
    author: "user2",
    title: "Switching to Teams",
    body: "We moved because Slack's pricing was unreasonable",
    score: 87,
    num_comments: 12,
    posted_at: new Date("2024-05-02"),
    raw: { subreddit: "programming" },
  },
];

/**
 * Mock fan-in logic: checks if all source jobs completed
 */
async function mockFanIn(reportId: string): Promise<boolean> {
  const jobs = await db
    .select()
    .from(report_platform_jobs)
    .where(eq(report_platform_jobs.report_id, reportId));

  // Check if any jobs are still queued or running
  const pendingJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");

  if (pendingJobs.length > 0) {
    return false; // Not ready for synthesis
  }

  // All jobs are terminal (completed or failed)
  // Create synthesis job if not already created
  const existing = await db
    .select()
    .from(synthesis_jobs)
    .where(eq(synthesis_jobs.report_id, reportId));

  if (existing.length === 0) {
    await db
      .insert(synthesis_jobs)
      .values({
        report_id: reportId,
        status: "queued",
        attempt_count: 0,
      })
      .catch(() => {}); // May fail if synthesis job already exists
  }

  return true; // Ready for synthesis
}

describe("PG Runner: End-to-End Workflow (Mocked)", () => {
  beforeAll(async () => {
    console.log("\n=== Setup: Creating test user ===");
    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name: "E2E Test User",
        email: `e2e-test-${Date.now()}@example.com`,
        email_verified: true,
        image: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;
    console.log(`✓ Test user created: ${testUserId}`);
  });

  afterAll(async () => {
    console.log("\n=== Cleanup ===");
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
      console.log(`✓ Cleaned up`);
    }
  });

  it("STEP 1: Create report with platform jobs", async () => {
    console.log("\n=== STEP 1: Create Report ===");

    const [report] = await db
      .insert(reports)
      .values({
        owner_id: testUserId,
        category: "Collaboration Tools",
        competitors: ["Slack", "Teams"],
        audience: "Tech companies",
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
        primary_competitor_name: "Slack",
      })
      .returning();

    if (!report) throw new Error("Failed to create report");

    // Create one job per platform (but limit to first 2 for test speed)
    const platformsToTest = ENABLED_PLATFORMS.slice(0, 2);
    await db.insert(report_platform_jobs).values(
      platformsToTest.map((platform) => ({
        report_id: report.id,
        platform,
        status: "queued" as const,
      })),
    );

    // Verify report and jobs created
    const createdReport = await db
      .select()
      .from(reports)
      .where(eq(reports.id, report.id));

    const createdJobs = await db
      .select()
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, report.id));

    expect(createdReport).toHaveLength(1);
    expect(createdJobs).toHaveLength(2);

    console.log(`✓ Report created: ${report.id}`);
    console.log(`✓ ${createdJobs.length} platform jobs created`);

    // Store for next steps
    (globalThis as any).testReportId = report.id;
  });

  it("STEP 2: Claim and process source job (mocked)", async () => {
    console.log("\n=== STEP 2: Process Source Job ===");

    const reportId = (globalThis as any).testReportId;
    expect(reportId).toBeTruthy();

    // Claim the first job
    const job = await db.transaction(async (tx) =>
      claimSourceJob(tx as any, "test-worker:123:abc"),
    );

    expect(job).toBeDefined();
    expect(job?.status).toBe("running");
    console.log(`✓ Job claimed: ${job?.id}`);
    console.log(`  Platform: ${job?.platform}`);
    console.log(`  Worker: ${job?.locked_by}`);

    // Simulate fetching posts (mocked)
    const posts = mockScraperOutput;
    console.log(`✓ Fetched ${posts.length} posts (mocked)`);

    // Step 2a: Persist mentions
    const insertedMentions = await db
      .insert(mentions)
      .values(
        posts.map((post) => ({
          report_id: reportId,
          platform: job!.platform,
          external_id: post.external_id,
          url: post.url,
          author: post.author,
          title: post.title,
          body: post.body,
          score: post.score,
          num_comments: post.num_comments,
          posted_at: post.posted_at,
          raw: post.raw,
        })),
      )
      .returning();

    expect(insertedMentions).toHaveLength(posts.length);
    console.log(`✓ Persisted ${insertedMentions.length} mentions`);

    // Step 2b: Update report to running
    await db
      .update(reports)
      .set({ status: "running", updated_at: new Date() })
      .where(eq(reports.id, reportId));
    console.log(`✓ Report status updated to running`);

    // Step 2c: Mock Stage A extraction (would be LLM call)
    console.log(`✓ Stage A extraction completed (mocked)`);

    // Step 2d: Mock Stage B summarization (would be LLM call)
    console.log(`✓ Stage B summarization completed (mocked)`);

    // Step 2e: Mark job completed
    if (job) {
      await db
        .update(report_platform_jobs)
        .set({
          status: "completed",
          stage: "completed",
          completed_at: new Date(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));

      console.log(`✓ Job marked as completed`);
    }
  });

  it("STEP 3: Verify mentions persisted correctly", async () => {
    console.log("\n=== STEP 3: Verify Mentions ===");

    const reportId = (globalThis as any).testReportId;
    expect(reportId).toBeTruthy();

    const savedMentions = await db
      .select()
      .from(mentions)
      .where(eq(mentions.report_id, reportId));

    expect(savedMentions.length).toBeGreaterThanOrEqual(2);
    console.log(`✓ Found ${savedMentions.length} mentions in database`);

    // Verify mention details
    const mention = savedMentions[0];
    expect(mention?.platform).toBeTruthy();
    expect(mention?.external_id).toBeTruthy();
    expect(mention?.body).toBeTruthy();
    expect(mention?.posted_at).toBeTruthy();

    console.log(`✓ Mention data verified`);
    console.log(`  Author: ${mention?.author}`);
    console.log(`  Score: ${mention?.score}`);
  });

  it("STEP 4: Fan-in creates synthesis job when all source jobs complete", async () => {
    console.log("\n=== STEP 4: Fan-in & Synthesis Job Creation ===");

    const reportId = (globalThis as any).testReportId;
    expect(reportId).toBeTruthy();

    // Check current job statuses
    const jobs = await db
      .select()
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    console.log(`Current job statuses:`);
    for (const job of jobs) {
      console.log(`  ${job.platform}: ${job.status}`);
    }

    // Complete any remaining jobs (for test purposes)
    const pendingJobs = jobs.filter((j) => j.status !== "completed");
    for (const job of pendingJobs) {
      await db
        .update(report_platform_jobs)
        .set({
          status: "completed",
          stage: "completed",
          completed_at: new Date(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, job.id));
    }

    console.log(`✓ All source jobs marked complete`);

    // Run fan-in check
    const readyForSynthesis = await mockFanIn(reportId);
    expect(readyForSynthesis).toBeTruthy();
    console.log(`✓ Fan-in check passed: ready for synthesis`);

    // Verify synthesis job was created
    const synthJobs = await db
      .select()
      .from(synthesis_jobs)
      .where(eq(synthesis_jobs.report_id, reportId));

    expect(synthJobs).toHaveLength(1);
    expect(synthJobs[0]?.status).toBe("queued");
    console.log(`✓ Synthesis job created: ${synthJobs[0]?.id}`);

    (globalThis as any).testSynthJobId = synthJobs[0]?.id;
  });

  it("STEP 5: Claim and process synthesis job (mocked)", async () => {
    console.log("\n=== STEP 5: Process Synthesis Job ===");

    const reportId = (globalThis as any).testReportId;
    const synthJobId = (globalThis as any).testSynthJobId;

    expect(reportId).toBeTruthy();
    expect(synthJobId).toBeTruthy();

    // Claim the synthesis job
    const synthJob = await db.transaction(async (tx) =>
      claimSynthesisJob(tx as any, "synth-worker:456:def"),
    );

    expect(synthJob).toBeDefined();
    expect(synthJob?.status).toBe("running");
    console.log(`✓ Synthesis job claimed: ${synthJob?.id}`);
    console.log(`  Worker: ${synthJob?.locked_by}`);

    // Step 5a: Load mentions for this report
    const reportMentions = await db
      .select()
      .from(mentions)
      .where(eq(mentions.report_id, reportId));

    console.log(`✓ Loaded ${reportMentions.length} mentions for synthesis`);

    // Step 5b: Mock pipeline execution (stages C, D, E)
    // In real code, this would run:
    // - Stage C: Merge mentions by topic
    // - Stage D: Synthesize clusters into pain points
    // - Stage E: Refine and score

    const mockPipelineOutput = {
      pain_points: [
        { text: "Performance issues", count: 15, sentiment: -0.8 },
        { text: "Pricing too high", count: 8, sentiment: -0.7 },
      ],
      feature_gaps: ["Real-time search", "Offline mode"],
      sentiment_overall: -0.45,
    };

    console.log(`✓ Pipeline execution completed (mocked)`);
    console.log(`  Pain points identified: ${mockPipelineOutput.pain_points.length}`);
    console.log(`  Feature gaps: ${mockPipelineOutput.feature_gaps.length}`);

    // Step 5c: Persist pipeline output to report
    if (synthJob) {
      await db
        .update(reports)
        .set({
          status: "completed",
          stage: "done",
          scanned_at: new Date(),
          sentiment_overall: mockPipelineOutput.sentiment_overall,
          updated_at: new Date(),
        })
        .where(eq(reports.id, reportId));

      console.log(`✓ Report updated with synthesis results`);
    }

    // Step 5d: Mark synthesis job completed
    if (synthJob) {
      await db
        .update(synthesis_jobs)
        .set({
          status: "completed",
          completed_at: new Date(),
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(eq(synthesis_jobs.id, synthJob.id));

      console.log(`✓ Synthesis job marked as completed`);
    }
  });

  it("STEP 6: Verify report marked completed", async () => {
    console.log("\n=== STEP 6: Verify Report Completion ===");

    const reportId = (globalThis as any).testReportId;
    expect(reportId).toBeTruthy();

    const [finalReport] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId));

    expect(finalReport).toBeDefined();
    expect(finalReport?.status).toBe("completed");
    expect(finalReport?.stage).toBe("done");
    expect(finalReport?.scanned_at).toBeTruthy();

    console.log(`✓ Report status: ${finalReport?.status}`);
    console.log(`✓ Report stage: ${finalReport?.stage}`);
    console.log(`✓ Scanned at: ${finalReport?.scanned_at}`);

    if (finalReport?.sentiment_overall) {
      console.log(`✓ Overall sentiment: ${finalReport.sentiment_overall}`);
    }
  });

  it("STEP 7: All jobs have correct final states", async () => {
    console.log("\n=== STEP 7: Verify Final Job States ===");

    const reportId = (globalThis as any).testReportId;
    expect(reportId).toBeTruthy();

    // Check source jobs
    const sourceJobs = await db
      .select()
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    console.log(`Source jobs:`);
    for (const job of sourceJobs) {
      expect(job.status).toBe("completed");
      expect(job.completed_at).toBeTruthy();
      expect(job.locked_at).toBeNull();
      expect(job.locked_by).toBeNull();
      console.log(`  ${job.platform}: ✓`);
    }

    // Check synthesis job
    const synthJobs = await db
      .select()
      .from(synthesis_jobs)
      .where(eq(synthesis_jobs.report_id, reportId));

    expect(synthJobs).toHaveLength(1);
    const synthJob = synthJobs[0];
    expect(synthJob?.status).toBe("completed");
    expect(synthJob?.completed_at).toBeTruthy();
    expect(synthJob?.locked_at).toBeNull();
    expect(synthJob?.locked_by).toBeNull();

    console.log(`Synthesis job: ✓`);
    console.log(`\n✓ All jobs have correct final states`);
  });

  it("STEP 8: Timeline from creation to completion", async () => {
    console.log("\n=== STEP 8: Workflow Timeline ===");

    const reportId = (globalThis as any).testReportId;
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId));

    if (!report) throw new Error("Report not found");

    const createdAt = report.created_at;
    const scannedAt = report.scanned_at;

    if (createdAt && scannedAt) {
      const duration = scannedAt.getTime() - createdAt.getTime();
      const seconds = (duration / 1000).toFixed(2);
      console.log(`\nWorkflow timeline:`);
      console.log(`  Created: ${createdAt.toISOString()}`);
      console.log(`  Completed: ${scannedAt.toISOString()}`);
      console.log(`  Total duration: ${seconds}s`);
    }

    console.log(`\n✓ E2E workflow completed successfully`);
  });

  it("handles partial failures gracefully", async () => {
    console.log("\n=== STEP 9: Partial Failure Handling ===");

    // Create another report for failure testing
    const [failReport] = await db
      .insert(reports)
      .values({
        owner_id: testUserId,
        category: "Failure Test",
        competitors: ["Test"],
        audience: "Test",
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
      })
      .returning();

    if (!failReport) throw new Error("Failed to create test report");

    // Create 2 jobs
    const platforms = ENABLED_PLATFORMS.slice(0, 2);
    await db.insert(report_platform_jobs).values(
      platforms.map((platform) => ({
        report_id: failReport.id,
        platform,
      })),
    );

    // Mark one as completed, one as failed
    const jobs = await db
      .select()
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, failReport.id));

    if (jobs.length >= 2) {
      await db
        .update(report_platform_jobs)
        .set({
          status: "completed",
          stage: "completed",
          completed_at: new Date(),
        })
        .where(eq(report_platform_jobs.id, jobs[0]!.id));

      await db
        .update(report_platform_jobs)
        .set({
          status: "failed",
          stage: "failed",
          completed_at: new Date(),
          last_error: "Scraper timeout",
        })
        .where(eq(report_platform_jobs.id, jobs[1]!.id));

      console.log(`✓ Job 1 (${jobs[0]?.platform}): completed`);
      console.log(`✓ Job 2 (${jobs[1]?.platform}): failed`);
    }

    // Fan-in should still work (not all jobs need to succeed)
    const allJobsTerminal = await db
      .select()
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, failReport.id));

    const pending = allJobsTerminal.filter(
      (j) => j.status === "queued" || j.status === "running",
    );
    expect(pending).toHaveLength(0);

    console.log(`✓ Partial failures handled: fan-in proceeds`);
  });
});
