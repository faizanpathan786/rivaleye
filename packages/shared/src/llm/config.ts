import type { PlatformId } from "@rivaleye/scrapers";

export const ENABLED_PLATFORMS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
] as const;

export type EnabledPlatformId = (typeof ENABLED_PLATFORMS)[number];

export const LLM_MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash:free";
export const LLM_TEMPERATURE = 1.0;

export function readOpenRouterApiKey(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY is required");
  return k;
}

export function assertEnabled(p: PlatformId): EnabledPlatformId {
  if ((ENABLED_PLATFORMS as readonly string[]).includes(p)) return p as EnabledPlatformId;
  throw new Error(`platform ${p} is not enabled`);
}
