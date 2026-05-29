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

const SYSTEM = `You are a research assistant identifying the canonical public identifiers for a SaaS or consumer-software company. You MUST actively search live web sources for every identifier independently — do not bail to null just because the first search didn't surface it. Treat null as a last resort that means "I searched and confirmed it doesn't exist", not "I didn't look hard enough".

Return ONLY a single JSON object — no prose, no markdown fences, no explanation outside the JSON.`;

function buildUserPrompt(competitorName: string): string {
  return `Find the canonical public identifiers for the SaaS / consumer-software company named: "${competitorName}".

Return a JSON object with these exact keys:
{
  "canonical_name": "the official brand name as the company writes it (e.g. \\"Notion\\", \\"Linear\\")",
  "website_url": "the official primary marketing website (https://...). NOT a Wikipedia or third-party page.",
  "app_store_id": "the numeric Apple App Store trackId as a string, digits only (e.g. for Notion it is \\"1232780281\\"). NOT a URL. null ONLY if you searched the App Store and confirmed no iOS app exists.",
  "play_store_app_id": "the Google Play package id, e.g. \\"notion.id\\", \\"com.slack\\", \\"app.linear\\". null ONLY if you searched Google Play and confirmed no Android app exists.",
  "linkedin_url": "the canonical https://www.linkedin.com/company/<slug> URL. null only if you confirmed the company has no LinkedIn page.",
  "twitter_handle": "the X/Twitter handle WITHOUT the @ prefix, e.g. \\"NotionHQ\\". null only if you confirmed the company has no X/Twitter presence.",
  "notes": "short caveat if any identifier is ambiguous, uncertain, or the company has multiple products. null if all confident."
}

How to search (be thorough — most companies have apps even if their first-pass search results don't show them):
- For app_store_id: search "<name> site:apps.apple.com" — find the listing page; the URL ends with "/id<digits>"; that <digits> string is the answer.
- For play_store_app_id: search "<name> site:play.google.com/store/apps" — find the listing page; the URL contains "?id=<package>"; that <package> is the answer.
- For linkedin_url: search "<name> site:linkedin.com/company" — copy the canonical company-page URL.
- For twitter_handle: check the company's website footer / contact page or search "<name> twitter".
- Do at least one targeted search per identifier before returning null. A well-known company without an app is rare; if you can't find one, double-check.

Rules:
- Never invent identifiers. If, after a targeted search, you genuinely cannot find one, return null and say so in notes.
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
  const parsed = discoveredIdsSchema.parse(res.parsed) as DiscoveredIds;
  return sanitize(parsed);
}

// Apple trackIds are numeric, ≥6 digits in practice (older apps 9, newer 10).
// Anything shorter is almost certainly a hallucination; null it rather than
// silently scraping the wrong app.
const APP_STORE_ID_RE = /^\d{6,}$/;
// Google Play package ids always contain at least one dot ("notion.id",
// "com.slack", "app.linear"). Strip anything that doesn't.
const PLAY_STORE_ID_RE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i;

function sanitize(d: DiscoveredIds): DiscoveredIds {
  return {
    ...d,
    app_store_id: d.app_store_id && APP_STORE_ID_RE.test(d.app_store_id) ? d.app_store_id : null,
    play_store_app_id:
      d.play_store_app_id && PLAY_STORE_ID_RE.test(d.play_store_app_id) ? d.play_store_app_id : null,
  };
}
