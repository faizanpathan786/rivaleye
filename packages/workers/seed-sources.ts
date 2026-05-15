import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env
const envPath = resolve(".env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = envContent.split("\n").filter((line) => line && !line.startsWith("#"));
for (const line of envVars) {
  const [key, value] = line.split("=");
  if (key && value) {
    process.env[key.trim()] = value.trim();
  }
}

import { db, redditSources } from "@rivaleye/db";

async function seedSources() {
  const COMPETITOR_ID = "a75d7da1-645d-4827-b8fa-a29449d834e9";

  console.log(`\n🌱 Seeding Reddit sources for competitor ${COMPETITOR_ID}...\n`);

  try {
    const sources = await db
      .insert(redditSources)
      .values([
        {
          competitorId: COMPETITOR_ID,
          subreddit: "IndianStreetBets",
          searchTerms: ["Zerodha Varsity", "options trading"],
          isActive: true,
        },
        {
          competitorId: COMPETITOR_ID,
          subreddit: "investing",
          searchTerms: ["Zerodha Varsity", "finance learning"],
          isActive: true,
        },
        {
          competitorId: COMPETITOR_ID,
          subreddit: "finance",
          searchTerms: ["Zerodha Varsity", "trading courses"],
          isActive: true,
        },
        {
          competitorId: COMPETITOR_ID,
          subreddit: "stocks",
          searchTerms: ["Zerodha Varsity", "financial education"],
          isActive: true,
        },
      ])
      .returning();

    console.log(`✅ Created ${sources.length} Reddit sources`);
    sources.forEach((s) => {
      console.log(`   • r/${s.subreddit}: ${s.searchTerms.join(", ")}`);
    });
    console.log(`\n📋 Ready for ingestion!`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

seedSources();
