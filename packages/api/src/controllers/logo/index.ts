import { Elysia, t } from "elysia";

const LOGODEV_SECRET = process.env.LOGODEV_SECRET_KEY;
const FALLBACK_SOURCES = (domain: string) => [
  LOGODEV_SECRET ? `https://img.logo.dev/${domain}?token=${LOGODEV_SECRET}&size=200&format=png` : null,
  `https://logo.clearbit.com/${domain}`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
];

// Public on purpose — consumed by <img> tags cross-origin, which can't carry
// auth cookies. The host fetched is always a fixed third party (logo.dev /
// clearbit / google); only `domain` varies. Validate it is a plausible public
// registrable hostname so this can't be coerced into fetching internal/IP hosts
// or be abused as an arbitrary egress driver.
function isValidPublicDomain(domain: string): boolean {
  if (domain.length === 0 || domain.length > 253) return false;
  if (!domain.includes(".")) return false;
  if (domain === "localhost" || domain.endsWith(".localhost") || domain.endsWith(".local")) return false;
  // Reject bare IPv4 addresses (block SSRF to metadata/internal hosts).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;
  // Hostname labels: letters/digits/hyphens, dot-separated.
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

export const logoController = new Elysia({ prefix: "/logo" }).get(
  "/:domain",
  async ({ params, set }) => {
    const domain = params.domain.toLowerCase().replace(/[^a-z0-9.-]/g, "");

    if (!isValidPublicDomain(domain)) {
      set.status = 400;
      return null;
    }

    for (const src of FALLBACK_SOURCES(domain)) {
      if (!src) continue;
      try {
        const res = await fetch(src, { redirect: "follow", signal: AbortSignal.timeout(4000) });
        if (!res.ok) continue;
        const contentType = res.headers.get("content-type") ?? "image/png";
        if (!contentType.startsWith("image/")) continue;
        const buf = await res.arrayBuffer();
        set.headers["content-type"] = contentType;
        set.headers["cache-control"] = "public, max-age=86400";
        return new Response(buf, { headers: { "content-type": contentType, "cache-control": "public, max-age=86400" } });
      } catch {
        continue;
      }
    }

    set.status = 404;
    return null;
  },
  {
    params: t.Object({ domain: t.String() }),
  },
);
