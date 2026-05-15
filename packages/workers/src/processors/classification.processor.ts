import { eq, isNull, inArray } from "drizzle-orm";
import { db, mentions, classifications, ingestionJobs, competitors, competitorMentions } from "@rivaleye/db";
import { classificationBatchOutputSchema } from "@rivaleye/shared";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { callLLM } from "../llm/llm-client.js";

const BATCH_SIZE = 10;  // Reduced batch size for faster processing with OpenAI

export async function processClassification(
  competitorId: string,
  mentionIds?: string[],
): Promise<void> {
  const log = logger.child({ competitorId, processor: "classification" });

  // Fetch competitor name for relevance context
  const [competitor] = await db
    .select({ name: competitors.name })
    .from(competitors)
    .where(eq(competitors.id, competitorId))
    .limit(1);
  const competitorName = competitor?.name ?? "the competitor";

  // Fetch unclassified mentions
  let mentionsList;
  if (mentionIds && mentionIds.length > 0) {
    mentionsList = await db
      .select()
      .from(mentions)
      .where(inArray(mentions.id, mentionIds));
  } else {
    // Get all mentions for this competitor
    const rows = await db
      .select()
      .from(mentions)
      .innerJoin(competitorMentions, eq(competitorMentions.mentionId, mentions.id))
      .where(eq(competitorMentions.competitorId, competitorId));

    const allMentions = rows.map(r => r.mentions);

    // Get all classified mention IDs
    const classifiedMentionIds = await db
      .select({ id: classifications.mentionId })
      .from(classifications);

    const classifiedIds = new Set(classifiedMentionIds.map(c => c.id || ''));

    // Return only unclassified mentions
    mentionsList = allMentions.filter(m => !classifiedIds.has(m.id));
  }

  const toClassify = mentionsList;

  log.info({ count: toClassify.length }, "Mentions to classify");

  if (toClassify.length === 0) return;

  let classified = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < toClassify.length; i += BATCH_SIZE) {
    const batch = toClassify.slice(i, i + BATCH_SIZE);
    log.info({ batchIndex: i, batchSize: batch.length, progress: `${classified}/${toClassify.length}` }, "Processing batch");

    // No delay needed anymore - local LLM has no rate limits

    try {
      const results = await classifyBatch(batch, competitorName, log);

      if (results.length > 0) {
        // Validate that all mentionIds exist in batch before inserting
        const batchMentionIds = batch.map((m) => m.id);
        const validMentionIdSet = new Set(batchMentionIds);

        const validResults = results.filter((r) => {
          if (!validMentionIdSet.has(r.mentionId)) {
            log.warn({ mentionId: r.mentionId }, "Classification result mentionId not in batch — skipping");
            return false;
          }
          return true;
        });

        if (validResults.length > 0) {
          const classificationData = validResults.map((r) => ({
            mentionId: r.mentionId,
            sentiment: r.sentiment,
            category: r.category,
            switchIntent: r.switchIntent,
            switchIntentTarget: r.switchIntentTarget,
            featureShipped: r.featureShipped,
            urgency: r.urgency,
            competitorMentions: r.competitorMentions,
            summary: r.summary,
            confidence: r.confidence,
            relevanceScore: r.relevanceScore,
            isRelevant: r.relevanceScore >= 60,
          }));

          await db.insert(classifications).values(classificationData).onConflictDoNothing();
          classified += validResults.length;
          log.info({ inserted: validResults.length, progress: `${classified}/${toClassify.length}` }, "Batch inserted");
        }
      }
    } catch (err) {
      failed += batch.length;
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ batchIndex: i, batchSize: batch.length, error: errMsg }, "Batch failed");
    }
  }

  log.info({ classified, failed, total: toClassify.length }, "Classification complete");

  // Update job record with classified count
  await db
    .update(ingestionJobs)
    .set({ mentionsClassified: classified })
    .where(eq(ingestionJobs.competitorId, competitorId));
}

async function classifyBatch(
  batch: Array<{ id: string; content: string; author: string; subreddit: string | null; score: number }>,
  competitorName: string,
  log: any
) {
  const items = batch.map((m) => ({
    id: m.id,
    content: m.content,  // Full content — Claude can handle it
  }));

  const systemPrompt = `You are an expert analyst classifying user feedback and mentions.

For each mention, determine:
- sentiment: "positive", "negative", "neutral", or "mixed"
- category: "complaint", "praise", "feature_request", "comparison", "pricing", "ux", "performance", "support", "competitor_update", or "other"
- relevanceScore: 0-100 (how relevant to the competitor)
- switchIntent: true/false (does the user imply switching away?)
- switchIntentTarget: null or target competitor name if switchIntent is true
- urgency: "low", "medium", or "high"
- summary: 1-2 sentence summary of the mention
- confidence: 0-1 confidence score for this classification

Return ONLY valid JSON array, no preamble or explanation.`;

  const userPrompt = `Classify these mentions for "${competitorName}":

${JSON.stringify(items, null, 2)}

Return JSON array with all fields: id, sentiment, category, relevanceScore, switchIntent, switchIntentTarget, urgency, summary, confidence.`;

  try {
    log.debug({ itemCount: items.length }, "Calling Claude for batch classification");
    const callStart = Date.now();
    const result = await callLLM(userPrompt, systemPrompt);
    const callMs = Date.now() - callStart;
    let text = result.content.trim();

    log.debug({ callMs, rawResponseLength: text.length, responsePreview: text.slice(0, 300) }, "Raw LLM response");

    // Remove markdown code blocks if present (e.g., ```json ... ```)
    if (text.includes('```')) {
      const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match && match[1]) {
        text = match[1].trim();
        log.debug({ method: "markdown_strip", preview: text.slice(0, 100) }, "Removed markdown code block");
      }
    }

    // Extract JSON array from response
    const startIdx = text.indexOf('[');
    if (startIdx === -1) {
      throw new Error(`No JSON array found in response: ${text.slice(0, 100)}`);
    }

    // Find matching closing bracket
    let bracketCount = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === '[') bracketCount++;
      if (text[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }

    let cleaned = text.substring(startIdx, endIdx);
    log.debug({ contentLength: cleaned.length, preview: cleaned.slice(0, 200) }, "Extracted JSON array");

    if (!cleaned || cleaned.trim() === '[') {
      // Try alternative approach - look for JSON-like patterns
      const jsonMatch = text.match(/\[\s*\{[^]*?\}\s*\]/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
        log.debug({ method: "regex", contentLength: cleaned.length }, "Used regex fallback");
      } else {
        throw new Error(`Failed to extract valid JSON array from response. Text: ${text.slice(0, 200)}`);
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      // Try converting Python syntax to JSON
      try {
        const jsonFixed = cleaned
          .replace(/'/g, '"')  // Replace single quotes with double quotes
          .replace(/True/g, 'true')
          .replace(/False/g, 'false')
          .replace(/None/g, 'null');

        log.debug({ method: "python-to-json" }, "Attempting Python-to-JSON conversion");
        parsed = JSON.parse(jsonFixed);
      } catch (secondErr) {
        log.warn({ rawJSON: cleaned.slice(0, 300), parseError: parseErr instanceof Error ? parseErr.message : String(parseErr) }, "JSON parsing failed");
        throw new Error(`JSON parse error: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      }
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`Expected array from LLM, got ${typeof parsed}`);
    }

    log.debug({ llmReturnCount: parsed.length, expectedCount: items.length }, "Parsed LLM response");

    // Map LLM response to classification objects
    const validParsed = parsed.slice(0, items.length).map((item: any, index: number) => {
      const mentionId = item.id || item.mentionId || items[index]?.id;
      if (!mentionId) {
        log.warn({ index }, "Missing mentionId in parsed response");
      }
      return {
        ...item,
        mentionId,
      };
    });

    // Apply defaults for missing fields
    const withDefaults = validParsed.map((item: any) => ({
      mentionId: item.mentionId,
      sentiment: item.sentiment && ["positive", "negative", "neutral", "mixed"].includes(item.sentiment) ? item.sentiment : "neutral",
      category: item.category && ["complaint", "praise", "feature_request", "comparison", "pricing", "ux", "performance", "support", "competitor_update", "other"].includes(item.category) ? item.category : "other",
      switchIntent: Boolean(item.switchIntent),
      switchIntentTarget: item.switchIntentTarget || null,
      urgency: item.urgency && ["low", "medium", "high"].includes(item.urgency) ? item.urgency : "low",
      competitorMentions: Array.isArray(item.competitorMentions) ? item.competitorMentions : [],
      summary: typeof item.summary === "string" && item.summary.trim() ? item.summary.trim() : `${item.sentiment || "neutral"} ${item.category || "other"}`,
      confidence: typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.7,
      featureShipped: item.featureShipped || null,
      relevanceScore: typeof item.relevanceScore === "number" ? Math.max(0, Math.min(100, item.relevanceScore)) : 50,
    }));

    // Validate against schema
    const validated = classificationBatchOutputSchema.parse(withDefaults);
    log.debug({ validatedCount: validated.length, classifications: validated.map(c => ({ mentionId: c.mentionId, sentiment: c.sentiment, category: c.category, relevanceScore: c.relevanceScore })) }, "Batch validated successfully");
    return validated;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error({ error: errMsg, itemCount: items.length }, "Batch classification failed");
    throw err;
  }
}
