import { eq, and } from "drizzle-orm";
import { db, classifications, mentions, clusters, clusterMentions, competitorMentions } from "@rivaleye/db";
import { callLLM } from "@rivaleye/shared";
import { logger } from "../logger.js";
import type { Logger } from "pino";
import type { Category, Sentiment } from "@rivaleye/shared";

const MIN_CLUSTER_SIZE = 2;

interface MentionWithClassification {
  mentionId: string;
  content: string;
  summary: string;
  sentiment: Sentiment;
  category: Category;
  urgency: string;
}

interface SemanticCluster {
  theme: string;
  category: Category;
  mention_ids: string[];
  mention_count: number;
  representative_quote: string;
  sentiment_distribution: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  urgency_level: "low" | "medium" | "high";
}

export async function processClustering(competitorId: string): Promise<void> {
  const log = logger.child({ competitorId, processor: "clustering" });
  log.info("Clustering started");

  // Stage 1: Group by category to enable semantic clustering within categories
  const categoryResults = await db
    .select({ category: classifications.category })
    .from(classifications)
    .innerJoin(mentions, eq(mentions.id, classifications.mentionId))
    .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
    .where(and(eq(competitorMentions.competitorId, competitorId), eq(classifications.isRelevant, true)));

  // Deduplicate categories
  const uniqueCategories = Array.from(new Map(categoryResults.map((r) => [r.category, r])).values());
  const categories = uniqueCategories;

  log.info({ categories: categories.length }, "Processing categories");

  let totalClustersCreated = 0;

  for (const { category } of categories) {
    const clustersForCategory = await processCategory(competitorId, category, log);
    totalClustersCreated += clustersForCategory;
  }

  log.info({ totalClustersCreated }, "Clustering complete");
}

async function processCategory(
  competitorId: string,
  category: Category,
  log: Logger,
): Promise<number> {
  // Fetch all relevant, classified mentions for this category
  const mentionsData = await db
    .select({
      mentionId: classifications.mentionId,
      content: mentions.content,
      summary: classifications.summary,
      sentiment: classifications.sentiment,
      category: classifications.category,
      urgency: classifications.urgency,
    })
    .from(classifications)
    .innerJoin(mentions, eq(mentions.id, classifications.mentionId))
    .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
    .where(
      and(
        eq(competitorMentions.competitorId, competitorId),
        eq(classifications.category, category),
        eq(classifications.isRelevant, true),
      ),
    )
    .limit(500);

  if (mentionsData.length < MIN_CLUSTER_SIZE) {
    log.debug({ category, count: mentionsData.length }, "Skipping category: too few mentions");
    return 0;
  }

  log.info({ category, mentionCount: mentionsData.length }, "Processing category");

  // Stage 2: Semantic clustering within category using Claude
  const semanticClusters = await performSemanticClustering(mentionsData, category, log);

  let clusterCount = 0;
  for (const cluster of semanticClusters) {
    await upsertSemanticCluster(competitorId, cluster, log);
    clusterCount++;
  }

  log.info({ category, clusterCount }, "Category processed");
  return clusterCount;
}

async function performSemanticClustering(
  mentions: MentionWithClassification[],
  category: Category,
  log: Logger,
): Promise<SemanticCluster[]> {
  // For small groups, create single cluster
  if (mentions.length < 5) {
    return [createSingleCluster(mentions, category)];
  }

  // For larger groups, use Claude to identify semantic themes
  const summaryList = mentions.map((m) => `- "${m.summary}"`).join("\n");

  const prompt = `Analyze these ${category} mentions and group them into distinct semantic themes/clusters.
Group mentions that discuss similar issues or aspects, even if the wording differs.

Mentions:
${summaryList}

Respond with a JSON array of clusters. Each cluster should have:
- "theme": 2-7 word theme name (e.g., "Performance degradation", "Missing integrations")
- "mention_indices": array of 0-based indices from the list above that belong to this cluster
- "representative_index": 0-based index of the most representative mention

Example format:
[
  {
    "theme": "API rate limiting issues",
    "mention_indices": [0, 3, 7],
    "representative_index": 0
  },
  {
    "theme": "Poor documentation",
    "mention_indices": [1, 2],
    "representative_index": 1
  }
]

Return ONLY valid JSON, no markdown or explanation.`;

  try {
    const result = await callLLM(prompt);
    const parsed = JSON.parse(result.content);

    if (!Array.isArray(parsed)) {
      log.warn("Clustering returned non-array, falling back to single cluster");
      return [createSingleCluster(mentions, category)];
    }

    const clusters: SemanticCluster[] = parsed
      .filter((c) => Array.isArray(c.mention_indices) && c.mention_indices.length > 0)
      .map((c) => {
        const clusterMentions = c.mention_indices
          .filter((idx: number) => idx >= 0 && idx < mentions.length)
          .map((idx: number) => mentions[idx]);

        if (clusterMentions.length === 0) return null;

        const representativeIdx =
          typeof c.representative_index === "number" &&
          c.representative_index >= 0 &&
          c.representative_index < clusterMentions.length
            ? c.representative_index
            : 0;

        return createCluster(
          clusterMentions,
          c.theme || `${category} cluster`,
          category,
          clusterMentions[representativeIdx],
        );
      })
      .filter((c) => c !== null) as SemanticCluster[];

    return clusters.length > 0 ? clusters : [createSingleCluster(mentions, category)];
  } catch (error) {
    log.warn({ error }, "Clustering failed, falling back to single cluster");
    return [createSingleCluster(mentions, category)];
  }
}

function createCluster(
  clusterMentions: MentionWithClassification[],
  theme: string,
  category: Category,
  representative: MentionWithClassification,
): SemanticCluster {
  const sentiments = clusterMentions.map((m) => m.sentiment);
  const sentimentDist = {
    positive: sentiments.filter((s) => s === "positive").length,
    negative: sentiments.filter((s) => s === "negative").length,
    neutral: sentiments.filter((s) => s === "neutral").length,
    mixed: sentiments.filter((s) => s === "mixed").length,
  };

  // Determine urgency: high if any mention is high, else medium if any medium, else low
  const urgencies = clusterMentions.map((m) => m.urgency);
  let urgencyLevel: "low" | "medium" | "high" = "low";
  if (urgencies.includes("high")) urgencyLevel = "high";
  else if (urgencies.includes("medium")) urgencyLevel = "medium";

  return {
    theme,
    category,
    mention_ids: clusterMentions.map((m) => m.mentionId),
    mention_count: clusterMentions.length,
    representative_quote: representative.summary.substring(0, 300),
    sentiment_distribution: sentimentDist,
    urgency_level: urgencyLevel,
  };
}

function createSingleCluster(
  mentions: MentionWithClassification[],
  category: Category,
): SemanticCluster {
  const sentiments = mentions.map((m) => m.sentiment);
  const sentimentDist = {
    positive: sentiments.filter((s) => s === "positive").length,
    negative: sentiments.filter((s) => s === "negative").length,
    neutral: sentiments.filter((s) => s === "neutral").length,
    mixed: sentiments.filter((s) => s === "mixed").length,
  };

  const urgencies = mentions.map((m) => m.urgency);
  let urgencyLevel: "low" | "medium" | "high" = "low";
  if (urgencies.includes("high")) urgencyLevel = "high";
  else if (urgencies.includes("medium")) urgencyLevel = "medium";

  return {
    theme: `${category} feedback`,
    category,
    mention_ids: mentions.map((m) => m.mentionId),
    mention_count: mentions.length,
    representative_quote: mentions[0]?.summary?.substring(0, 300) || "No summary available",
    sentiment_distribution: sentimentDist,
    urgency_level: urgencyLevel,
  };
}

async function upsertSemanticCluster(
  competitorId: string,
  cluster: SemanticCluster,
  log: Logger,
): Promise<void> {
  // Check for existing cluster with same theme and category
  const [existing] = await db
    .select()
    .from(clusters)
    .where(
      and(
        eq(clusters.competitorId, competitorId),
        eq(clusters.category, cluster.category),
        eq(clusters.label, cluster.theme),
      ),
    )
    .limit(1);

  // Calculate trend
  let trend: "rising" | "falling" | "stable" = "stable";
  if (existing) {
    if (cluster.mention_count > existing.mentionCount * 1.2) trend = "rising";
    else if (cluster.mention_count < existing.mentionCount * 0.8) trend = "falling";
  }

  // Determine sentiment from distribution
  const sentimentEntries = Object.entries(cluster.sentiment_distribution).sort(([, a], [, b]) => b - a);
  const maxSentiment = sentimentEntries[0];
  const sentiment = (maxSentiment?.[0] as Sentiment) || "neutral";

  if (existing) {
    // Update existing cluster
    await db
      .update(clusters)
      .set({
        mentionCount: cluster.mention_count,
        trend,
        updatedAt: new Date(),
      })
      .where(eq(clusters.id, existing.id));

    // Update associated mentions
    await db.delete(clusterMentions).where(eq(clusterMentions.clusterId, existing.id));

    if (cluster.mention_ids.length > 0) {
      await db
        .insert(clusterMentions)
        .values(
          cluster.mention_ids.map((mentionId) => ({
            clusterId: existing.id,
            mentionId,
          })),
        )
        .onConflictDoNothing();
    }

    log.info({ theme: cluster.theme, category: cluster.category, trend }, "Cluster updated");
  } else {
    // Create new cluster
    const [newCluster] = await db
      .insert(clusters)
      .values({
        competitorId,
        label: cluster.theme,
        category: cluster.category,
        sentiment,
        mentionCount: cluster.mention_count,
        trend,
      })
      .returning();

    if (!newCluster) return;

    // Associate mentions with this cluster
    if (cluster.mention_ids.length > 0) {
      await db
        .insert(clusterMentions)
        .values(
          cluster.mention_ids.map((mentionId) => ({
            clusterId: newCluster.id,
            mentionId,
          })),
        )
        .onConflictDoNothing();
    }

    log.info(
      {
        theme: cluster.theme,
        category: cluster.category,
        mentionCount: cluster.mention_count,
        sentiment,
      },
      "Cluster created",
    );
  }
}
