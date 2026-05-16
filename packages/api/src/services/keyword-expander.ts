import { z } from "zod";
import type { OpenRouterClient } from "@rivaleye/shared/llm";

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
}

export async function expandKeywords(
  llm: OpenRouterClient,
  input: KeywordInput,
): Promise<string[]> {
  const user = `competitor: ${input.competitor}\ncategory: ${input.category}`;
  const res = await llm.complete({ system: SYSTEM_PROMPT, user, schema: keywordsSchema });
  return res.parsed.keywords;
}
