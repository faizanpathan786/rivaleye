import { z } from "zod";
import { OpenRouterClient } from "./openrouter";
import { readOpenRouterApiKey } from "./config";

const SONAR_MODEL = process.env["PERPLEXITY_SONAR_MODEL"] ?? "perplexity/sonar";

/**
 * Canonical identifiers we want to know about a competitor BEFORE scrapers
 * run, so that platform-specific scrapers (App Store, Play Store, LinkedIn,
 * Twitter) can target the exact entity instead of guessing from the name.
 *
 * Every field is nullable — "we couldn't find it" must round-trip honestly.
 */
export const discoveredIdsSchema = z.object({
  canonical_name: z.string().nullable().catch(null),
  website_url: z.string().nullable().catch(null),
  // Numeric Apple trackId as a string (digits only), e.g. "1232780281" for Notion.
  app_store_id: z.string().nullable().catch(null),
  // Google Play package id, e.g. "notion.id", "com.slack".
  play_store_app_id: z.string().nullable().catch(null),
  linkedin_url: z.string().nullable().catch(null),
  // X / Twitter handle WITHOUT the leading @.
  twitter_handle: z.string().nullable().catch(null),
  notes: z.string().nullable().catch(null),
});

export type DiscoveredIds = z.infer<typeof discoveredIdsSchema>;

let _client: OpenRouterClient | null = null;

function getSonarClient(): OpenRouterClient {
  if (_client) return _client;
  _client = new OpenRouterClient({
    apiKey: readOpenRouterApiKey(),
    model: SONAR_MODEL,
  });
  return _client;
}

const SYSTEM = `You are a research assistant identifying the canonical public identifiers for a SaaS or consumer-software company. Use live web search to verify each identifier against authoritative sources (the company's own site, the App Store / Play Store listing pages, the company's LinkedIn page).

Return ONLY a single JSON object — no prose, no markdown fences, no explanation outside the JSON.`;

function buildUserPrompt(competitorName: string): string {
  return `Find the canonical public identifiers for the SaaS / consumer-software company named: "${competitorName}".

Return a JSON object with these exact keys:
{
  "canonical_name": "the official brand name as the company writes it (e.g. \\"Notion\\", \\"Linear\\")",
  "website_url": "the official primary marketing website (https://...). NOT a Wikipedia or third-party page.",
  "app_store_id": "the numeric Apple App Store trackId as a string, digits only (e.g. for Notion it is \\"1232780281\\"). NOT a URL. null if the company has no iOS app.",
  "play_store_app_id": "the Google Play package id, e.g. \\"notion.id\\", \\"com.slack\\". null if the company has no Android app.",
  "linkedin_url": "the canonical https://www.linkedin.com/company/<slug> URL. null if not found.",
  "twitter_handle": "the X/Twitter handle WITHOUT the @ prefix, e.g. \\"NotionHQ\\". null if not found.",
  "notes": "short caveat if any identifier is ambiguous, uncertain, or the company has multiple products. null if all confident."
}

Rules:
- Never guess. If you cannot confidently identify the company, set all id fields to null and explain in notes.
- The app_store_id MUST be the numeric trackId Apple uses (extract from the App Store listing URL "/id<digits>"), NOT the URL itself.
- Verify website_url is the company's own marketing site, not a Wikipedia / Crunchbase / press page.
- If multiple companies share the name, pick the SaaS / software one and explain in notes.
- Return JSON only.`;
}

/**
 * Resolve a competitor name to its canonical public identifiers using
 * Perplexity Sonar (web-grounded). Throws on transport failure; never throws
 * just because an identifier could not be found (those come back as null).
 */
export async function discoverCompetitorIdentifiers(
  competitorName: string,
): Promise<DiscoveredIds> {
  const client = getSonarClient();
  const res = await client.complete(
    {
      system: SYSTEM,
      user: buildUserPrompt(competitorName),
      schema: discoveredIdsSchema,
    },
    { timeoutMs: 60_000, maxAttempts: 2 },
  );
  // Schema validates fields nullable + .catch(null), so parsed conforms — but
  // zod's .catch chain loses the strict generic through OpenRouterClient's
  // overloads. Validate explicitly and cast.
  return discoveredIdsSchema.parse(res.parsed) as DiscoveredIds;
}
