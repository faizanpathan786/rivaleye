import { z } from "zod";
import type { LlmClient } from "@rivaleye/shared/llm";

const SYSTEM_PROMPT =
  "You are a search-query strategist. Given a competitor name and product category, " +
  "generate 5 to 10 short search queries (1-4 words each) a frustrated user might type. " +
  "Rules: no punctuation, include the competitor name, include alternatives/vs/features/pains variations. " +
  'Return ONLY a JSON object: {"keywords": ["query one", "query two", ...]}';

const keywordsSchema = z.object({
  keywords: z.array(z.string().min(1).max(60)).max(10),
});

export interface KeywordInput {
  competitor: string;
  category: string;
  audience: string | null;
  goal: string;
}

export async function expandKeywords(
  llm: LlmClient,
  input: KeywordInput,
): Promise<string[]> {
  const user = `Competitor: ${input.competitor}
Category: ${input.category}
Audience: ${input.audience ?? "unspecified"}
Founder goal: ${input.goal}

Return the JSON now.`;
  // Bounded + single-attempt: this runs in the report-creation request path, so
  // a stalled provider must never hang the HTTP request. The caller already
  // falls back to [competitor] on any failure.
  const res = await llm.complete(
    { system: SYSTEM_PROMPT, user, schema: keywordsSchema, tag: "keyword-expander" },
    { timeoutMs: 8_000, maxAttempts: 1 },
  );
  return res.parsed.keywords;
}
