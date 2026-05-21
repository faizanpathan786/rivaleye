const TRACKING_QUERY_PREFIXES = ["utm_"];
const TRACKING_QUERY_KEYS = new Set(["context", "fbclid", "gclid", "msclkid", "ref", "source"]);

const EXCLUDED_PATH_KEYWORDS = new Set([
  "login", "log-in", "signin", "sign-in", "signup", "sign-up", "register",
  "careers", "jobs", "privacy", "terms", "legal", "dpa", "subprocessors",
  "status", "cookie", "cookies",
]);

export function normalizeUrl(url: string, baseUrl?: string): string | null {
  if (!url.trim()) return null;
  try {
    const absolute = baseUrl ? new URL(url.trim(), baseUrl).href : url.trim();
    const parsed = new URL(absolute);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    let hostname = (parsed.hostname ?? "").toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);

    const netloc = parsed.port ? `${hostname}:${parsed.port}` : hostname;

    let path = parsed.pathname || "/";
    while (path.includes("//")) path = path.replace("//", "/");
    if (path !== "/") path = path.replace(/\/+$/, "");

    const queryItems: [string, string][] = [];
    for (const [key, value] of new URLSearchParams(parsed.search)) {
      const keyLower = key.toLowerCase();
      if (TRACKING_QUERY_KEYS.has(keyLower)) continue;
      if (TRACKING_QUERY_PREFIXES.some((p) => keyLower.startsWith(p))) continue;
      queryItems.push([key, value]);
    }
    queryItems.sort((a, b) => a[0].localeCompare(b[0]));
    const query = queryItems.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

    return `${parsed.protocol}//${netloc}${path}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

export function domainKey(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = (parsed.hostname ?? "").toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return "";
  }
}

export function isSameDomain(url: string, rootUrl: string): boolean {
  return domainKey(url) === domainKey(rootUrl);
}

export function isExcludedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean).map((p) => p.toLowerCase());
    return parts.some((part) =>
      [...EXCLUDED_PATH_KEYWORDS].some((keyword) => keyword === part || part.includes(keyword)),
    );
  } catch {
    return true;
  }
}

export function normalizeInternalUrls(urls: string[], rootUrl: string): string[] {
  const normalizedRoot = normalizeUrl(rootUrl);
  if (!normalizedRoot) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawUrl of urls) {
    const normalized = normalizeUrl(rawUrl, normalizedRoot);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    if (!isSameDomain(normalized, normalizedRoot)) continue;
    if (isExcludedUrl(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
