import { Elysia, t } from "elysia";

const LOGODEV_SECRET = process.env.LOGODEV_SECRET_KEY;
const FALLBACK_SOURCES = (domain: string) => [
  LOGODEV_SECRET ? `https://img.logo.dev/${domain}?token=${LOGODEV_SECRET}&size=200&format=png` : null,
  `https://logo.clearbit.com/${domain}`,
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
];

export const logoController = new Elysia({ prefix: "/logo" }).get(
  "/:domain",
  async ({ params, set }) => {
    const domain = params.domain.toLowerCase().replace(/[^a-z0-9.-]/g, "");

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
