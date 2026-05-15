import { db, mentions, competitors } from "@rivaleye/db";
import { count, eq } from "drizzle-orm";

async function checkDb() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  console.log("Checking database state...");

  // Check total mentions
  const totalMentions = await db
    .select({ count: count() })
    .from(mentions);

  console.log("Total mentions:", totalMentions[0]?.count ?? 0);

  // Check competitors and their mention counts
  const competitorList = await db
    .select({
      id: competitors.id,
      name: competitors.name,
    })
    .from(competitors)
    .limit(10);

  console.log("\nCompetitors:");
  for (const comp of competitorList) {
    const mentionsForComp = await db
      .select({ count: count() })
      .from(mentions)
      .where(eq(mentions.competitorId, comp.id));
    
    console.log(`  ${comp.name} (${comp.id}): ${mentionsForComp[0]?.count ?? 0} mentions`);
  }
}

checkDb().catch(console.error).finally(() => process.exit(0));
