import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { callLlm } from "../llm";
import type { PainReportOutput } from "@rivaleye/shared";

const CLUSTER_SYSTEM_PROMPT = `You are a competitive intelligence analyst. Given Reddit posts and comments mentioning a competitor product, identify distinct pain point clusters.

For each cluster return:
- title: 3-7 word theme name
- description: 1-2 sentences explaining the pain
- evidence: array of 2-5 direct quotes from the posts

Group by user pain, not by feature. Prioritize complaints with multiple independent mentions.

Return valid JSON only with this exact shape:
{
  "summary": "2-3 sentence executive summary of top pain themes",
  "painClusters": [{ "title": "string", "description": "string", "evidence": ["string"] }],
  "featureGaps": ["string"],
  "pricingPain": "string",
  "switchingSignals": ["string"],
  "voiceOfCustomer": ["string"],
  "competitorWeaknesses": ["string"],
  "productOpportunities": ["string"],
  "positioningAngles": ["string"],
  "recommendedActions": ["string"]
}`;

const MAX_BODY_CHARS = 800;
const MAX_MENTIONS_IN_PROMPT = 150;

function buildClusterPrompt(
  competitor: string,
  category: string,
  searchTerms: string[],
  postBodies: string[],
): string {
  const truncated = postBodies.slice(0, MAX_MENTIONS_IN_PROMPT);
  const postsText = truncated.join("\n---\n");
  return `Competitor: ${competitor}
Category: ${category}
Search angles used: ${searchTerms.join(", ")}

Posts and comments:
${postsText}`;
}

function parseJsonSafe(raw: string): PainReportOutput | null {
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    return JSON.parse(cleaned) as PainReportOutput;
  } catch {
    return null;
  }
}

const DEFAULT_OUTPUT: PainReportOutput = {
  summary: "Could not parse LLM response. Check raw mentions for insights.",
  painClusters: [],
  featureGaps: [],
  pricingPain: "",
  switchingSignals: [],
  voiceOfCustomer: [],
  competitorWeaknesses: [],
  productOpportunities: [],
  positioningAngles: [],
  recommendedActions: [],
};

export async function handleGenerateReport(data: GenerateReportJob) {
  try {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, data.reportId))
      .limit(1);

    if (!report) throw new Error(`Report ${data.reportId} not found`);

    const competitor = (report.competitors as string[])[0] ?? "unknown";
    const category = report.category;

    const rows = await db
      .select()
      .from(mentions)
      .where(eq(mentions.reportId, data.reportId));

    const postBodies = rows.map((m) =>
      `Title: ${m.title ?? ""}\n${m.body}`.slice(0, MAX_BODY_CHARS),
    );

    // LLM call 1: generate search term context
    const searchTermsRaw = await callLlm(
      "You are a market researcher. Return a JSON array of 8-10 Reddit search queries that would find complaints and switching signals for a given product. Return only a JSON array of strings, no other text.",
      `Product: ${competitor}\nCategory: ${category}`,
    ).catch(() => "[]");
    let searchTerms: string[] = [];
    try {
      searchTerms = (JSON.parse(
        searchTermsRaw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim(),
      ) as string[]).slice(0, 10);
    } catch {
      searchTerms = [];
    }

    // LLM call 2: cluster pain points
    const clusterRaw = await callLlm(
      CLUSTER_SYSTEM_PROMPT,
      buildClusterPrompt(competitor, category, searchTerms, postBodies),
    );

    const output = parseJsonSafe(clusterRaw) ?? DEFAULT_OUTPUT;

    await db
      .update(reports)
      .set({
        output: output as unknown as Record<string, unknown>,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(reports.id, data.reportId));

    return { reportId: data.reportId, status: "completed" as const };
  } catch (err) {
    await db
      .update(reports)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(reports.id, data.reportId));
    throw err;
  }
}
