import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENROUTER_API_KEY"] ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

export const STAGE_MODELS = {
  stage1: process.env["STAGE1_MODEL"] ?? "deepseek/deepseek-v3-0324:free",
  stage2: process.env["STAGE2_MODEL"] ?? "deepseek/deepseek-v3-0324:free",
  stage3: process.env["STAGE3_MODEL"] ?? "deepseek/deepseek-v3-0324:free",
  stage4: process.env["STAGE4_MODEL"] ?? "deepseek/deepseek-v3-0324:free",
} as const;

export async function callLlm({
  model,
  system,
  user,
  maxTokens,
}: {
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");
  return content;
}
