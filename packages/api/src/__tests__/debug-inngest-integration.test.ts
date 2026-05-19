import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";
import { reports } from "@/db/schema/reports";
import { report_platform_jobs } from "@/db/schema/pipeline";
import { inngest } from "@/libs/inngest";
import { ENABLED_PLATFORMS } from "@rivaleye/shared";

let testUserId: string;

describe("DEBUG: Inngest Integration", () => {
  beforeAll(async () => {
    console.log("\n=== Inngest Debug Test ===\n");

    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        name: "Inngest Test User",
        email: `inngest-test-${Date.now()}@example.com`,
        email_verified: true,
        image: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!user) throw new Error("Failed to create test user");
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("Check if Inngest client is configured correctly", async () => {
    console.log("\n--- Inngest Client Configuration ---");

    console.log(`inngest object type: ${typeof inngest}`);
    console.log(`inngest.id: ${inngest.id}`);
    console.log(`inngest.appId: ${(inngest as any).appId ?? "undefined"}`);

    // Check if event key is set
    const eventKey = process.env.INNGEST_EVENT_KEY;
    console.log(`INNGEST_EVENT_KEY is set: ${eventKey ? "YES ✓" : "NO ✗"}`);

    if (!eventKey) {
      console.warn(`⚠ INNGEST_EVENT_KEY not set. Events won't be dispatched to Inngest server.`);
    }

    expect(inngest).toBeDefined();
    console.log(`✓ Inngest client exists`);
  });

  it("Test Inngest.send() with mock event", async () => {
    console.log("\n--- Testing inngest.send() ---");

    try {
      const reportId = crypto.randomUUID();
      const platform = ENABLED_PLATFORMS[0] ?? "reddit";

      console.log(`Sending test scrape.fetch event:`);
      console.log(`  reportId: ${reportId}`);
      console.log(`  platform: ${platform}`);

      const result = await inngest.send({
        name: "scrape.fetch",
        data: {
          reportId,
          platform,
          competitor: "Test Competitor",
          category: "testing",
          keywords: ["test"],
        },
      });

      console.log(`✓ inngest.send() succeeded`);
      console.log(`  Result: ${JSON.stringify(result, null, 2)}`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`✗ inngest.send() failed: ${errorMsg}`);

      if (
        errorMsg.includes("INNGEST_EVENT_KEY") ||
        errorMsg.includes("not configured") ||
        errorMsg.includes("401")
      ) {
        console.warn(`\n⚠ Inngest Auth Issue:`);
        console.warn(`  - Make sure INNGEST_EVENT_KEY is set in .env`);
        console.warn(`  - Make sure inngest-cli dev server is running`);
        console.warn(`  - Check that your API key is valid`);
      }

      if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("Cannot connect")) {
        console.warn(`\n⚠ Inngest Server Connection Issue:`);
        console.warn(`  - Run: npx inngest-cli@latest dev`);
        console.warn(`  - Make sure the dev server is listening on http://localhost:8288`);
      }

      throw e;
    }
  });

  it("Create a report and verify platform jobs + check Inngest queue behavior", async () => {
    console.log("\n--- Full Report Creation with Inngest Monitoring ---");

    const reportId = crypto.randomUUID();

    // Step 1: Create report
    console.log(`\n[1/3] Inserting report into database...`);
    const [reportRow] = await db
      .insert(reports)
      .values({
        id: reportId,
        owner_id: testUserId,
        category: "test-category",
        competitors: ["Test Competitor"],
        audience: "test audience",
        goal: "find_user_pain",
        status: "queued",
        stage: "queued",
        primary_competitor_name: "Test Competitor",
      })
      .returning({ id: reports.id });

    if (!reportRow) throw new Error("Failed to insert report");
    console.log(`✓ Report created: ${reportId}`);

    // Step 2: Create platform jobs
    console.log(`\n[2/3] Creating platform jobs...`);
    await db.insert(report_platform_jobs).values(
      ENABLED_PLATFORMS.map((platform) => ({
        report_id: reportId,
        platform,
        status: "queued" as const,
      })),
    );
    console.log(`✓ Created ${ENABLED_PLATFORMS.length} platform jobs`);

    // Step 3: Simulate sending Inngest events (what createReport does)
    console.log(`\n[3/3] Sending Inngest events...`);
    const eventPromises = ENABLED_PLATFORMS.map((platform) => {
      return inngest
        .send({
          name: "scrape.fetch",
          data: {
            reportId,
            platform,
            competitor: "Test Competitor",
            category: "test-category",
            keywords: ["test keyword"],
          },
        })
        .then(() => {
          console.log(`  ✓ scrape.fetch queued for ${platform}`);
          return { platform, success: true };
        })
        .catch((err: Error) => {
          console.log(`  ✗ scrape.fetch FAILED for ${platform}: ${err.message}`);
          return { platform, success: false, error: err.message };
        });
    });

    const results = await Promise.all(eventPromises);
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`\n📊 Inngest Send Results:`);
    console.log(`  Succeeded: ${succeeded}/${ENABLED_PLATFORMS.length}`);
    console.log(`  Failed: ${failed}/${ENABLED_PLATFORMS.length}`);

    if (failed > 0) {
      console.warn(`\n⚠ Some events failed to send. Check Inngest configuration.`);
      const failedPlatforms = results.filter((r) => !r.success);
      for (const result of failedPlatforms) {
        const errorMsg = result.success === false && "error" in result ? result.error : "Unknown error";
        console.warn(`  - ${result.platform}: ${errorMsg}`);
      }
    }

    // Step 4: Verify jobs are still in database with correct state
    const jobs = await db
      .select()
      .from(report_platform_jobs)
      .where(eq(report_platform_jobs.report_id, reportId));

    console.log(`\n✓ Database state after events:`);
    console.log(`  Platform jobs count: ${jobs.length}`);
    for (const job of jobs) {
      console.log(`  - ${job.platform}: status=${job.status}, stage=${job.stage}`);
    }

    expect(jobs).toHaveLength(ENABLED_PLATFORMS.length);
  });

  it("Detailed Inngest event inspection", async () => {
    console.log("\n--- Event Schema Inspection ---");

    try {
      // Try to inspect the schemas
      const inngestObj = inngest as any;
      console.log(`\nInngest schemas:`, Object.keys(inngestObj.schemas ?? {}));
      console.log(`Available event names:`, Object.keys((inngestObj.schemas?.record ?? {})));
    } catch (e) {
      console.log(`Could not inspect schemas: ${e}`);
    }

    // Test creating a function (doesn't execute, just checks structure)
    const testFunction = inngest.createFunction(
      { id: "test-function", concurrency: [{ limit: 1 }] },
      { event: "scrape.fetch" },
      async () => {
        return { success: true };
      },
    );

    console.log(`✓ Can create Inngest function`);
    console.log(`  Function ID: ${testFunction.id}`);
  });
});

/**
 * HOW TO USE THIS DEBUG TEST:
 *
 * Run: CONNECTION_STRING=... bun test packages/api/src/__tests__/debug-inngest-integration.test.ts
 *
 * WHAT TO LOOK FOR:
 *
 * 1. "INNGEST_EVENT_KEY is set: YES" - if NO, you need to set INNGEST_EVENT_KEY in .env
 *
 * 2. "inngest.send() succeeded" - if this fails:
 *    - Make sure inngest-cli dev server is running: npx inngest-cli@latest dev
 *    - Check that INNGEST_EVENT_KEY is valid
 *    - Verify port 8288 is accessible
 *
 * 3. "Inngest Send Results: Succeeded: 6/6" - if not all succeed:
 *    - Events aren't reaching the queue
 *    - Worker might not receive them
 *    - Check Inngest logs at http://localhost:8288
 *
 * IF EVENTS ARE SENDING BUT WORKERS DON'T PROCESS:
 *
 * 1. Check if worker-scrape is running:
 *    pnpm --filter @rivaleye/worker dev scrape
 *
 * 2. Check if worker is registered with Inngest:
 *    - Log into Inngest UI at http://localhost:8288
 *    - Look for "rivaleye-worker" in Functions
 *    - Check if scrape.fetch is listed
 *
 * 3. Check worker logs for errors or missing handlers
 */
