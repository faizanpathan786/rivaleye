import type { NormalizedPost } from "../types";
import type { CrawledPage } from "./client";

export function normalizeWebsitePages(pages: CrawledPage[]): NormalizedPost[] {
  return pages
    .filter((page) => page.status === "success" && page.markdown.trim().length > 50)
    .map((page): NormalizedPost => {
      const title = page.title ?? deriveTitle(page.url);
      const headerLine = page.description ? `${title}\n${page.description}\n\n` : `${title}\n\n`;
      const body = `${headerLine}${page.markdown}`.slice(0, 8000);

      return {
        platform: "website",
        externalId: `website:${page.url}`,
        url: page.url,
        author: null,
        title,
        body,
        score: null,
        numComments: null,
        createdAt: new Date(),
        raw: page,
      };
    });
}

function deriveTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return parsed.hostname;
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}
