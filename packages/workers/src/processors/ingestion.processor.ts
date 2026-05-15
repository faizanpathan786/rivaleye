import { eq, inArray, isNull, and } from "drizzle-orm";
import { db, competitors, redditSources, mentions, ingestionJobs, classifications, competitorMentions } from "@rivaleye/db";
import { RedditClient } from "@rivaleye/reddit-client";
import type { NewMention } from "@rivaleye/db";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { enqueueClassification } from "../queues.js";

const reddit = new RedditClient({
  clientId: config.reddit.clientId,
  clientSecret: config.reddit.clientSecret,
  userAgent: config.reddit.userAgent,
});

reddit.start();

export async function processIngestion(competitorId: string): Promise<void> {
  const log = logger.child({ competitorId, processor: "ingestion" });

  // Create job record
  const [job] = await db
    .insert(ingestionJobs)
    .values({ competitorId, status: "running" })
    .returning();

  if (!job) throw new Error("Failed to create ingestion job");

  log.info({ jobId: job.id }, "Ingestion started");

  try {
    const sources = await db
      .select()
      .from(redditSources)
      .where(eq(redditSources.competitorId, competitorId));

    if (sources.length === 0) {
      log.warn("No Reddit sources found — skipping");
      await finalizeJob(job.id, "completed", 0);
      return;
    }

    const collectedMentions: NewMention[] = [];
    const errors: string[] = [];
    const MAX_MENTIONS_PER_COMPETITOR = 500; // Posts + comments combined limit
    const MIN_UPVOTES = 2; // Include smaller discussions, not just viral posts
    const MAX_COMMENTS_PER_POST = 10; // Fetch up to 10 comments per post
    const MAX_COMMENTS_PER_RUN = 100; // Collect up to 100 comments total per run (scale: 1 → 5 → 10 → 20 → 50 → 100 → 200 → 400)
    let commentsCollected = 0;

    // Collect from all active sources
    for (const source of sources) {
      if (!source.isActive) continue;
      if (collectedMentions.length >= MAX_MENTIONS_PER_COMPETITOR) break;

      // Fetch top 50 newest posts (comprehensive coverage)
      try {
        const sourceStart = Date.now();
        log.info({ subreddit: source.subreddit }, "Starting subreddit collection");
        const posts = await reddit.getSubredditPosts(source.subreddit, { sort: "new", limit: 50 });
        log.info({ subreddit: source.subreddit, postCount: posts.length, fetchMs: Date.now() - sourceStart }, "Posts fetched");

        for (const post of posts) {
          const postStart = Date.now();
          if (collectedMentions.length >= MAX_MENTIONS_PER_COMPETITOR) break;
          if (post.content.length < 20) continue; // skip low-content posts
          if (post.score < MIN_UPVOTES) continue; // MVP: only high-engagement posts

          collectedMentions.push({
            source: "reddit",
            externalId: post.externalId,
            author: post.author,
            content: `${post.title}\n\n${post.content}`.trim(),
            url: post.url,
            score: post.score,
            numComments: post.numComments,
            subreddit: post.subreddit,
            postType: "post",
            postedAt: post.postedAt,
          });

          // Fetch comments from all posts (no engagement filter - let LLM decide quality)
          if (commentsCollected < MAX_COMMENTS_PER_RUN) {
            try {
              const commentStart = Date.now();
              const postId = post.externalId.replace("reddit_post_", "");
              log.debug({ postId }, "Fetching comments...");
              const comments = await reddit.getPostComments(source.subreddit, postId, MAX_COMMENTS_PER_POST);
              const commentTime = Date.now() - commentStart;
              log.debug({ postId: post.externalId, fetchMs: commentTime, count: comments.length }, "Comments fetched");

              for (const comment of comments) {
                if (collectedMentions.length >= MAX_MENTIONS_PER_COMPETITOR) break;
                if (commentsCollected >= MAX_COMMENTS_PER_RUN) break;
                if (comment.content.length < 10) continue;

                collectedMentions.push({
                  source: "reddit",
                  externalId: `${post.externalId}_${comment.externalId}`,
                  author: comment.author,
                  content: comment.content,
                  url: post.url,
                  score: comment.score,
                  numComments: 0,
                  subreddit: post.subreddit,
                  postType: "comment",
                  postedAt: comment.postedAt,
                });
                commentsCollected++;
              }
            } catch (commentErr) {
              log.warn({ postId: post.externalId, err: commentErr }, "Comment fetch failed");
            }
          }
          const postMs = Date.now() - postStart;
          log.debug({ postId: post.externalId, processMs: postMs }, "Post processed");
        }
      } catch (err) {
        const msg = `r/${source.subreddit}: ${String(err)}`;
        errors.push(msg);
        log.error({ err }, msg);
      }

      // Fetch search term results (all terms)
      for (const term of source.searchTerms) {
        if (collectedMentions.length >= MAX_MENTIONS_PER_COMPETITOR) break;

        try {
          const termStart = Date.now();
          log.info({ term }, "Searching term");
          const posts = await reddit.searchPosts(term, { limit: 50, sort: "new" });
          log.info({ term, postCount: posts.length, fetchMs: Date.now() - termStart }, "Search posts fetched");

          for (const post of posts) {
            const searchPostStart = Date.now();
            if (collectedMentions.length >= MAX_MENTIONS_PER_COMPETITOR) break;
            if (post.content.length < 20) continue;
            if (post.score < MIN_UPVOTES) continue; // MVP: only high-engagement posts

            collectedMentions.push({
              source: "reddit",
              externalId: post.externalId,
              author: post.author,
              content: `${post.title}\n\n${post.content}`.trim(),
              url: post.url,
              score: post.score,
              numComments: post.numComments,
              subreddit: post.subreddit,
              postType: "post",
              postedAt: post.postedAt,
            });

            // Fetch comments from all search results (no engagement filter)
            if (commentsCollected < MAX_COMMENTS_PER_RUN) {
              try {
                const commentStart = Date.now();
                const postId = post.externalId.replace("reddit_post_", "");
                log.debug({ postId, term }, "Fetching comments from search result...");
                const comments = await reddit.getPostComments(post.subreddit, postId, MAX_COMMENTS_PER_POST);
                const commentTime = Date.now() - commentStart;
                log.debug({ postId: post.externalId, fetchMs: commentTime, count: comments.length }, "Search result comments fetched");

                for (const comment of comments) {
                  if (collectedMentions.length >= MAX_MENTIONS_PER_COMPETITOR) break;
                  if (commentsCollected >= MAX_COMMENTS_PER_RUN) break;
                  if (comment.content.length < 10) continue;

                  collectedMentions.push({
                    source: "reddit",
                    externalId: `${post.externalId}_${comment.externalId}`,
                    author: comment.author,
                    content: comment.content,
                    url: post.url,
                    score: comment.score,
                    numComments: 0,
                    subreddit: post.subreddit,
                    postType: "comment",
                    postedAt: comment.postedAt,
                  });
                  commentsCollected++;
                }
              } catch (commentErr) {
                log.warn({ postId: post.externalId, term, err: commentErr }, "Search result comment fetch failed");
              }
            }
            const searchPostMs = Date.now() - searchPostStart;
            log.debug({ postId: post.externalId, term, processMs: searchPostMs }, "Search post processed");
          }
        } catch (err) {
          const msg = `search "${term}": ${String(err)}`;
          errors.push(msg);
          log.error({ err }, msg);
        }
      }
    }

    // Deduplicate by externalId within batch
    const uniqueMap = new Map<string, NewMention>();
    for (const m of collectedMentions) {
      uniqueMap.set(m.externalId, m);
    }
    const unique = Array.from(uniqueMap.values());

    // Check which externalIds already exist in DB FOR THIS COMPETITOR (not global)
    const existingIds = await db
      .select({ externalId: mentions.externalId })
      .from(mentions)
      .where(
        and(
          
          inArray(mentions.externalId, unique.map((m) => m.externalId))
        )
      );

    const existingSet = new Set(existingIds.map((r) => r.externalId));
    const newMentions = unique.filter((m) => !existingSet.has(m.externalId));
    const skippedMentions = unique.filter((m) => existingSet.has(m.externalId));

    log.info({ total: unique.length, new: newMentions.length, skipped: skippedMentions.length }, "Deduplication complete");

    // Bulk insert mentions and link to competitor via junction table
    const CHUNK = 500;
    let inserted = 0;
    const insertedIds: string[] = [];

    for (let i = 0; i < newMentions.length; i += CHUNK) {
      const chunk = newMentions.slice(i, i + CHUNK);
      const rows = await db.insert(mentions).values(chunk).onConflictDoNothing().returning({ id: mentions.id });
      inserted += rows.length;
      insertedIds.push(...rows.map((r) => r.id));

      // Link inserted mentions to competitor in junction table
      if (rows.length > 0) {
        const links = rows.map((r) => ({
          competitorId,
          mentionId: r.id,
        }));
        await db.insert(competitorMentions).values(links).onConflictDoNothing();
      }
    }

    // Also link existing mentions (skipped during insert) to this competitor
    if (skippedMentions.length > 0) {
      const existingMentionIds = await db
        .select({ id: mentions.id, externalId: mentions.externalId })
        .from(mentions)
        .where(inArray(mentions.externalId, skippedMentions.map((m) => m.externalId)));

      if (existingMentionIds.length > 0) {
        const existingLinks = existingMentionIds.map((m) => ({
          competitorId,
          mentionId: m.id,
        }));
        await db.insert(competitorMentions).values(existingLinks).onConflictDoNothing();
        log.info({ linked: existingLinks.length }, "Existing mentions linked to competitor");
      }
    }

    log.info({ inserted }, "Mentions inserted");

    // Collecting posts only (comments can be added later at scale)


    // Update competitor's lastSyncedAt
    await db
      .update(competitors)
      .set({ lastSyncedAt: new Date() })
      .where(eq(competitors.id, competitorId));

    await finalizeJob(job.id, "completed", inserted);

    // Queue classification for unclassified mentions
    // Get all mentions for this competitor that don't have classifications
    const rows = await db
      .select({ id: mentions.id })
      .from(mentions)
      .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
      .where(eq(competitorMentions.competitorId, competitorId));

    const allMentions = rows.map(r => ({ id: r.id }));

    const classifiedMentionIds = await db
      .select({ mentionId: classifications.mentionId })
      .from(classifications);

    const classifiedIds = new Set(classifiedMentionIds.map((c) => c.mentionId));
    const unclassifiedMentions = allMentions.filter((m) => !classifiedIds.has(m.id));

    if (unclassifiedMentions.length > 0) {
      await enqueueClassification(
        competitorId,
        unclassifiedMentions.map((m) => m.id),
      );
      log.info({ count: unclassifiedMentions.length }, "Classification job queued");
    }
  } catch (err) {
    log.error({ err }, "Ingestion failed");
    await finalizeJob(job.id, "failed", 0, String(err));
    throw err;
  }
}

async function finalizeJob(
  jobId: string,
  status: "completed" | "failed",
  mentionsFetched: number,
  error?: string,
) {
  await db
    .update(ingestionJobs)
    .set({ status, mentionsFetched, completedAt: new Date(), error })
    .where(eq(ingestionJobs.id, jobId));
}
