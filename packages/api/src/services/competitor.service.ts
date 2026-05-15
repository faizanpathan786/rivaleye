import { eq, and } from "drizzle-orm";
import { db, competitors, redditSources } from "@rivaleye/db";
import { discoverRedditSources } from "./discovery.service.js";
import { enqueueIngestion } from "../queues.js";

export async function createCompetitor(
  workspaceId: string,
  name: string,
  website?: string,
) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const [competitor] = await db
    .insert(competitors)
    .values({ workspaceId, name, slug, website })
    .returning();

  if (!competitor) throw new Error("Failed to create competitor");

  // Use sensible defaults immediately - don't wait for slow Gemma
  const defaultSubreddits = ["investing", "stocks", "finance", "entrepreneur", "startups"];
  const defaultSearchTerms = [
    `${name} vs`,
    `${name} complaints`,
    `${name} review`,
    `switching from ${name}`,
    `${name} alternatives`,
  ];

  // Insert default sources immediately so ingestion can start right away
  try {
    await db.insert(redditSources).values(
      defaultSubreddits.map((subreddit) => ({
        competitorId: competitor.id,
        subreddit,
        searchTerms: defaultSearchTerms,
        isActive: true,
      })),
    );
    console.error(`[competitor-created] ${competitor.id} (${name}): created with ${defaultSubreddits.length} default subreddits`);
  } catch (err) {
    console.error(`[competitor-default-sources-error] ${competitor.id}: ${err instanceof Error ? err.message : err}`);
  }

  // Queue ingestion immediately with defaults
  await enqueueIngestion(competitor.id);

  // Discovery happens in background with no timeout - it will complete whenever it's ready
  // When it finds better sources, ingestion will pick them up for next run
  (async () => {
    try {
      console.error(`[discovery-background-start] ${competitor.id} (${name})`);
      const discovered = await discoverRedditSources(name);

      if (discovered.subreddits.length > 0) {
        console.error(`[discovery-background-complete] ${competitor.id}: found ${discovered.subreddits.length} better sources`);
        // Replace defaults with discovered sources
        await db.delete(redditSources).where(eq(redditSources.competitorId, competitor.id));
        await db.insert(redditSources).values(
          discovered.subreddits.map((subreddit) => ({
            competitorId: competitor.id,
            subreddit,
            searchTerms: discovered.searchTerms,
            isActive: true,
          })),
        );
        console.error(`[discovery-sources-updated] ${competitor.id}: improved from defaults to discovered sources`);
      }
    } catch (err) {
      console.error(`[discovery-background-error] ${competitor.id} (${name}): ${err instanceof Error ? err.message : err}`);
      // Silently fail - ingestion already running with sensible defaults
    }
  })();

  return competitor;
}

export async function getCompetitorsByWorkspace(workspaceId: string) {
  return db
    .select()
    .from(competitors)
    .where(eq(competitors.workspaceId, workspaceId))
    .orderBy(competitors.createdAt);
}

export async function getCompetitorById(id: string, workspaceId: string) {
  const [competitor] = await db
    .select()
    .from(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.workspaceId, workspaceId)))
    .limit(1);

  return competitor ?? null;
}

export async function updateCompetitor(
  id: string,
  workspaceId: string,
  updates: Partial<{ name: string; website: string | null; status: "active" | "paused" | "archived" }>,
) {
  const [updated] = await db
    .update(competitors)
    .set(updates)
    .where(and(eq(competitors.id, id), eq(competitors.workspaceId, workspaceId)))
    .returning();

  return updated ?? null;
}

export async function deleteCompetitor(id: string, workspaceId: string) {
  const [deleted] = await db
    .delete(competitors)
    .where(and(eq(competitors.id, id), eq(competitors.workspaceId, workspaceId)))
    .returning();

  return deleted ?? null;
}
