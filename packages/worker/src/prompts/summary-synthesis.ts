import { z } from "zod";
import type { PipelineCtx, PlatformExtract } from "./shared";

export const summaryDataSchema = z.object({
  competitor: z.object({
    name: z.string(),
    domain: z.string(),
    scannedAt: z.string(),
    sources: z.number(),
    platforms: z.array(z.object({ id: z.string(), name: z.string() })),
    sentiment: z.object({
      overall: z.number().min(-1).max(1),
      positive: z.number().min(0).max(1),
      neutral: z.number().min(0).max(1),
      negative: z.number().min(0).max(1),
      trend: z.string(),
    }),
  }),
  headlines: z.object({
    mainThesis: z.string().max(200),
    insights: z.string().max(500),
  }),
  topThemes: z.array(
    z.object({
      name: z.string(),
      mentions: z.number(),
      trend: z.string(),
    })
  ).min(1).max(5),
  topQuotes: z.array(
    z.object({
      who: z.string(),
      sub: z.string(),
      when: z.string(),
      score: z.number(),
      sentiment: z.number(),
      text: z.string(),
      theme: z.string(),
    })
  ).min(1).max(5),
});

export type SummaryData = z.infer<typeof summaryDataSchema>;

const SYSTEM = `You are a competitive intelligence synthesizer. You will receive platform-level extracts and overall report metadata. Your job: synthesize a cross-platform competitive summary.

Return ONE JSON object matching this exact shape:
{
  "competitor": { "name": "string", "domain": "string", "scannedAt": "ISO timestamp", "sources": number, "platforms": [{"id": "string", "name": "string"}], "sentiment": { "overall": number, "positive": number, "neutral": number, "negative": number, "trend": "string" } },
  "headlines": { "mainThesis": "one-liner insight", "insights": "1-2 sentence narrative" },
  "topThemes": [{ "name": "string", "mentions": number, "trend": "string" }],
  "topQuotes": [{ "who": "string", "sub": "string", "when": "string", "score": number, "sentiment": number, "text": "string", "theme": "string" }]
}

Rules:
- mainThesis: A declarative one-liner capturing the competitor's primary vulnerability or strength across all platforms (e.g., "Pricing structure creates switching risk").
- insights: Supporting evidence in 1-2 sentences. What's the story the data tells?
- topThemes: Extract 2-4 themes that own most of the sentiment. Include mention count and trend ("+18%" or "-5%").
- topQuotes: Select the 3-5 highest-signal quotes from ALL platforms that together tell the story. Include original source (who, sub, when). Include theme.
- sentiment.trend: Format as "+0.08 vs prev 90d" or similar.
- Never invent data not present in the input.
- Return ONLY the JSON object. No prose, no markdown.`;

export interface SummarySynthesisInput {
  ctx: PipelineCtx;
  competitor: string;
  scannedAt: string;
  sources: number;
  platforms: Array<{ id: string; name: string }>;
  sentiment: {
    overall: number;
    positive: number;
    neutral: number;
    negative: number;
    trend: string;
  };
  platformExtracts: Record<string, PlatformExtract>;
  topQuotes: Array<{
    who: string;
    sub: string;
    when: string;
    score: number;
    sentiment: number;
    text: string;
    platform: string;
  }>;
}

export function buildSummarySynthesis(input: SummarySynthesisInput): {
  system: string;
  user: string;
  schema: typeof summaryDataSchema;
} {
  const extractBlock = Object.entries(input.platformExtracts)
    .map(([platform, extract]) => `[${platform}]\n${JSON.stringify(extract, null, 2)}`)
    .join("\n\n");

  const quotesBlock = input.topQuotes
    .map((q) => `- ${q.who} (${q.sub}, ${q.when}): "${q.text}" [${q.platform}]`)
    .join("\n");

  const user = `Competitor: ${input.competitor}
Scanned: ${input.scannedAt}
Total sources: ${input.sources}
Platforms: ${input.platforms.map((p) => p.name).join(", ")}
Overall sentiment: ${input.sentiment.overall.toFixed(2)} (${Math.round(input.sentiment.positive * 100)}% positive, ${Math.round(input.sentiment.neutral * 100)}% neutral, ${Math.round(input.sentiment.negative * 100)}% negative)
Trend: ${input.sentiment.trend}

Platform-level extracts (complaints, features_requested, pricing_signals, switching_signals, voice_phrases, quotes):
${extractBlock}

Top quotes across all platforms:
${quotesBlock}

Now synthesize the cross-platform summary.`;

  return { system: SYSTEM, user, schema: summaryDataSchema };
}
