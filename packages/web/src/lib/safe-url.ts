const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Returns the given URL only if it parses and uses http(s) — otherwise
 * undefined. Use for any href/window.open target sourced from scraped or
 * LLM-derived content (source links, quote links) to block javascript:/data:
 * URL injection.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return ALLOWED_PROTOCOLS.has(parsed.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}
