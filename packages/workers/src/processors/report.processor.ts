import { eq, and, desc, inArray } from "drizzle-orm";
import { db, competitors, clusters, clusterMentions, mentions, reports } from "@rivaleye/db";
import { callLLM } from "../llm/llm-client.js";
import { logger } from "../logger.js";

export async function processReportGeneration(competitorId: string): Promise<void> {
  const log = logger.child({ competitorId, processor: "report" });
  log.info("Report generation started");

  // Fetch competitor name and search query
  const [competitor] = await db
    .select()
    .from(competitors)
    .where(eq(competitors.id, competitorId))
    .limit(1);

  if (!competitor) {
    log.warn("Competitor not found");
    return;
  }

  // Fetch clusters for this competitor
  const clustersList = await db
    .select()
    .from(clusters)
    .where(eq(clusters.competitorId, competitorId))
    .orderBy(desc(clusters.mentionCount));

  if (clustersList.length === 0) {
    log.warn("No clusters found for report");
    return;
  }

  // Group by sentiment to determine signal strength
  const positiveCluster = clustersList.filter((c) => c.sentiment === "positive").length;
  const negativeCluster = clustersList.filter((c) => c.sentiment === "negative").length;
  const signalStrength = negativeCluster >= positiveCluster ? "strong" : "medium";

  // Fetch all mentions for this competitor to build pain themes
  const competitorClusters = await db
    .select()
    .from(clusters)
    .where(eq(clusters.competitorId, competitorId));

  const painThemes = [];
  let totalMentions = 0;

  for (const cluster of competitorClusters) {
    const clusterMentionIds = await db
      .select({ mentionId: clusterMentions.mentionId })
      .from(clusterMentions)
      .where(eq(clusterMentions.clusterId, cluster.id));

    const mentionIdList = clusterMentionIds.map((c) => c.mentionId);

    const clusterMentionObjects = mentionIdList.length > 0
      ? await db
          .select()
          .from(mentions)
          .where(inArray(mentions.id, mentionIdList))
      : [];

    totalMentions += clusterMentionObjects.length;

    const quotes = clusterMentionObjects.slice(0, 5).map((m) => ({
      mentionId: m.id,
      text: m.content.substring(0, 200),
      score: m.score || 0,
      subreddit: m.subreddit || "r/unknown",
      author: m.author || "unknown",
      url: m.url || "https://reddit.com",
    }));

    painThemes.push({
      theme: cluster.label,
      category: cluster.category,
      mentionCount: cluster.mentionCount,
      quotes,
      sentimentDistribution: {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
      },
    });
  }

  // Generate executive summary using Claude
  const summaryPrompt = `Based on these pain themes for ${competitor.name}:
${painThemes.map((t) => `- ${t.theme} (${t.mentionCount} mentions)`).join("\n")}

Write a 2-3 sentence executive summary about the main customer pain points and market opportunity. Be specific and actionable.`;

  let executiveSummary = "Customers report significant pain points with pricing and feature limitations.";
  try {
    const summaryResult = await callLLM(summaryPrompt);
    executiveSummary = summaryResult.content.trim();
  } catch (err) {
    log.warn("Failed to generate executive summary, using default");
  }

  // Generate positioning opportunity
  let positioningOpportunity = `Build a ${competitor.name} alternative that addresses the top customer pain points.`;
  try {
    const positioningPrompt = `Given these customer pain points for ${competitor.name}:
${painThemes.slice(0, 3).map((t) => `- ${t.theme}`).join("\n")}

Suggest a specific product positioning that would differentiate from ${competitor.name}. Be concise (1-2 sentences).`;

    const positioningResult = await callLLM(positioningPrompt);
    positioningOpportunity = positioningResult.content.trim();
  } catch (err) {
    log.warn("Failed to generate positioning, using default");
  }

  // Build report
  const reportData = {
    summary: executiveSummary,
    painThemes: painThemes.slice(0, 8),
    featureRequests: [],
    positioningOpportunity,
    validationSteps: [
      `Interview 5-10 users who complained about ${painThemes[0]?.theme || "issues"}`,
      "Test landing page with your positioning statement",
      "Validate willingness to pay for a solution",
    ],
    signalStrength: signalStrength as "weak" | "medium" | "strong",
    mentionCount: totalMentions,
  };

  // Create or update report in database
  const [existingReport] = await db
    .select()
    .from(reports)
    .where(eq(reports.competitorId, competitorId))
    .limit(1);

  if (existingReport) {
    await db
      .update(reports)
      .set({
        reportData,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(reports.id, existingReport.id));

    log.info({ reportId: existingReport.id }, "Report updated");
  } else {
    const [newReport] = await db
      .insert(reports)
      .values({
        competitorId,
        searchQuery: competitor.name,
        reportData,
        status: "completed",
      })
      .returning();

    log.info({ reportId: newReport?.id }, "Report created");
  }

  log.info("Report generation complete");
}
