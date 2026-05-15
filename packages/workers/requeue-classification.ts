import { db, mentions } from "@rivaleye/db";
import { eq } from "drizzle-orm";
import { classificationQueue } from "./src/queues.js";

async function main() {
  const competitorId = "163d1735-5ac0-489a-90e3-e6e742f2dd58"; // Notion

  // Get all mentions for this competitor
  const allMentions = await db
    .select({ id: mentions.id })
    .from(mentions)
    .where(eq(mentions.competitorId, competitorId));

  console.log(`Found ${allMentions.length} mentions for competitor`);

  const mentionIds = allMentions.map((m) => m.id);

  // Queue the classification job
  await classificationQueue.add(
    "classify",
    { competitorId, mentionIds },
    { attempts: 3, backoff: { type: "exponential", delay: 5_000 } }
  );

  console.log(`Queued classification for ${mentionIds.length} mentions`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
