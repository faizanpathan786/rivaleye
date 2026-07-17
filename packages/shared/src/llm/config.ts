import type { PlatformId } from "@rivaleye/scrapers";

export const ENABLED_PLATFORMS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "website",
  "linkedin",
  "twitter",
] as const;

export type EnabledPlatformId = (typeof ENABLED_PLATFORMS)[number];

const FALLBACK_LLM_MODEL = "deepseek/deepseek-v4-flash:free";

// A missing OPENROUTER_MODEL silently degrades EVERY scan to a heavily
// rate-limited free model — invisible until reports start failing/queuing. In
// production (and only when actually using OpenRouter) treat it as a fatal
// misconfiguration; in dev/mock keep the warn-and-fallback so local runs work.
if (!process.env.OPENROUTER_MODEL) {
  const usingOpenRouter = (process.env.LLM_PROVIDER ?? "openrouter").toLowerCase() !== "mock";
  if (process.env.NODE_ENV === "production" && usingOpenRouter) {
    throw new Error(
      "OPENROUTER_MODEL is required in production — refusing to silently fall back to the rate-limited free tier. Set OPENROUTER_MODEL.",
    );
  }
  console.warn(
    `[llm] OPENROUTER_MODEL is not set — falling back to free-tier model '${FALLBACK_LLM_MODEL}' which is heavily rate-limited. Set OPENROUTER_MODEL for production.`,
  );
}

export const LLM_MODEL = process.env.OPENROUTER_MODEL ?? FALLBACK_LLM_MODEL;

export function readOpenRouterApiKey(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY is required");
  return k;
}

export function assertEnabled(p: PlatformId): EnabledPlatformId {
  if ((ENABLED_PLATFORMS as readonly string[]).includes(p)) return p as EnabledPlatformId;
  throw new Error(`platform ${p} is not enabled`);
}
