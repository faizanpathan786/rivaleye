import { db, mentions, classifications } from "@rivaleye/db";
import { eq, notInArray } from "drizzle-orm";
import { classificationQueue } from "./src/queues.js";

async function main() {
  const competitorId = "163d1735-5ac0-489a-90e3-e6e742f2dd58"; // Notion

  // Get all mentions for this competitor
  const allMentions = await db
    .select({ id: mentions.id })
    .from(mentions)
    .where(eq(mentions.competitorId, competitorId));

  // Get classified mention IDs
  const classifiedMentionIds = await db
    .select({ mentionId: classifications.mentionId })
    .from(classifications);

  const classifiedIds = new Set(classifiedMentionIds.map(c => c.mentionId));

  // Get unclassified mentions
  const unclassifiedIds = allMentions
    .map(m => m.id)
    .filter(id => !classifiedIds.has(id));

  console.log(`Found ${unclassifiedIds.length} unclassified mentions (out of ${allMentions.length})`);

  if (unclassifiedIds.length === 0) {
    console.log("All mentions already classified!");
    process.exit(0);
  }

  // Queue the classification job for unclassified mentions
  await classificationQueue.add(
    "classify",
    { competitorId, mentionIds: unclassifiedIds },
    { attempts: 3, backoff: { type: "exponential", delay: 5_000 } }
  );

  console.log(`Queued classification for ${unclassifiedIds.length} unclassified mentions`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
