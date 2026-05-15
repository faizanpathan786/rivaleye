// Direct database setup + test pipeline
import { db, redditSources, ingestionJobs, competitors } from "@rivaleye/db";
import { eq } from "drizzle-orm";
import { processIngestion } from "./src/processors/ingestion.processor.js";
import { processClassification } from "./src/processors/classification.processor.js";

const COMPETITOR_ID = "70a8746d-dbae-4c97-bbbc-6ea1e6205c0a"; // Linear competitor

async function setupAndTest() {
  console.log(`\n🚀 SETUP & TEST: Linear Competitor Pipeline\n`);

  try {
    // Step 1: Create Reddit sources
    console.log(`📍 Step 1: Setting up Reddit sources for Linear...`);
    const sources = await db
      .insert(redditSources)
      .values([
        {
          competitorId: COMPETITOR_ID,
          subreddit: "Linear",
          searchTerms: ["Linear issue tracking"],
          isActive: true,
        },
        {
          competitorId: COMPETITOR_ID,
          subreddit: "projectmanagement",
          searchTerms: ["Linear vs Jira"],
          isActive: true,
        },
        {
          competitorId: COMPETITOR_ID,
          subreddit: "productivity",
          searchTerms: ["Linear alternative"],
          isActive: true,
        },
        {
          competitorId: COMPETITOR_ID,
          subreddit: "startups",
          searchTerms: ["Linear issue tracker"],
          isActive: true,
        },
      ])
      .onConflictDoNothing()
      .returning();

    console.log(`   ✅ Created ${sources.length} sources\n`);

    // Step 2: Run ingestion
    console.log(`📍 Step 2: Running ingestion (fetching from Reddit)...`);
    await processIngestion(COMPETITOR_ID);
    console.log(`   ✅ Ingestion complete\n`);

    // Step 3: Check what was fetched
    const mentions = await db
      .select()
      .from(await import("@rivaleye/db").then((m) => m.mentions))
      .where(eq((await import("@rivaleye/db").then((m) => m.mentions)).competitorId, COMPETITOR_ID));

    console.log(`📍 Step 3: Ingestion results`);
    console.log(`   Total mentions fetched: ${mentions.length}\n`);

    if (mentions.length > 0) {
      // Step 4: Run classification
      console.log(`📍 Step 4: Running classification (Claude AI)...`);
      await processClassification(COMPETITOR_ID);
      console.log(`   ✅ Classification complete\n`);

      // Step 5: Check stats
      const statsResult = await db
        .select()
        .from(await import("@rivaleye/db").then((m) => m.classifications))
        .where(eq((await import("@rivaleye/db").then((m) => m.classifications)).competitorId, COMPETITOR_ID));

      console.log(`📍 Step 5: Results`);
      console.log(`   Classified: ${statsResult.length}/${mentions.length}\n`);
    } else {
      console.log(`⚠️  No mentions fetched - Reddit API may have limits\n`);
    }

    console.log(`\n✨ Pipeline test complete!`);
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

setupAndTest();
