import { db, redditSources, competitors } from "@rivaleye/db";
import { eq } from "drizzle-orm";

async function checkSources() {
  console.log("\n🔍 Checking Reddit sources for all competitors...\n");

  try {
    const allCompetitors = await db.select().from(competitors);

    for (const comp of allCompetitors) {
      const sources = await db
        .select()
        .from(redditSources)
        .where(eq(redditSources.competitorId, comp.id));

      const status = sources.length > 0 ? "✅" : "❌";
      console.log(`${status} ${comp.name}`);
      console.log(`   ID: ${comp.id}`);
      console.log(`   Sources: ${sources.length}`);

      if (sources.length > 0) {
        sources.slice(0, 3).forEach(s => {
          console.log(`     • r/${s.subreddit}`);
        });
        if (sources.length > 3) {
          console.log(`     • +${sources.length - 3} more`);
        }
      }
      console.log("");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkSources();
