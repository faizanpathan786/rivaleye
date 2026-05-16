/**
 * Medium RSS Scraper (replaces Hashnode — API went paid May 2026, RSS blocked)
 * Uses Medium's public RSS feeds — no API key required
 *
 * RSS endpoints:
 *   - Tag feed:         https://medium.com/feed/tag/{tag}
 *   - User feed:        https://medium.com/feed/@{username}
 *   - Publication feed: https://medium.com/feed/{publication}
 *
 * Usage: ts-node hashnode.ts "<tag>" [@username or publication?]
 * Example: ts-node hashnode.ts "notion"
 * Example: ts-node hashnode.ts "ai" @towardsdatascience
 */

import { XMLParser } from "fast-xml-parser";

const SEARCH_TERM = process.argv[2] || "notion";
const EXTRA_FEED = process.argv[3] || ""; // e.g. "@username" or "publication-slug"

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
});

interface RSSItem {
  title: string | { __cdata: string };
  link: string;
  guid?: string | { "#text": string };
  pubDate?: string;
  "dc:creator"?: string | { __cdata: string };
  category?: string | string[] | { __cdata: string } | { __cdata: string }[];
  description?: string | { __cdata: string };
  "content:encoded"?: string | { __cdata: string };
  "media:thumbnail"?: { "@_url": string };
}

interface ParsedPost {
  title: string;
  url: string;
  publishedAt: string;
  author: string;
  tags: string[];
  description: string;
  contentPreview: string;
  thumbnail: string;
  source: string;
}

function unwrap(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "__cdata" in val) return (val as { __cdata: string }).__cdata;
  return String(val);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchRSS(url: string): Promise<RSSItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)", Accept: "application/rss+xml, text/xml, */*" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  return Array.isArray(items) ? items : [items];
}

function parseItem(item: RSSItem, source: string): ParsedPost {
  const rawCategories = item.category ?? [];
  const catArray = Array.isArray(rawCategories) ? rawCategories : [rawCategories];
  const tags = catArray.map((c) => unwrap(c)).filter(Boolean);

  const content = unwrap(item["content:encoded"] || item.description || "");
  const contentPreview = stripHtml(content).slice(0, 500);
  const description = stripHtml(unwrap(item.description || "")).slice(0, 250);
  const thumbnail = item["media:thumbnail"]?.["@_url"] || "";
  const guid = typeof item.guid === "string" ? item.guid : (item.guid as { "#text": string } | undefined)?.["#text"] || "";

  return {
    title: unwrap(item.title),
    url: item.link || guid,
    publishedAt: item.pubDate || "",
    author: unwrap(item["dc:creator"] || ""),
    tags,
    description,
    contentPreview,
    thumbnail,
    source,
  };
}

async function main() {
  console.error(`Fetching Medium RSS for: "${SEARCH_TERM}"`);

  const feeds: { url: string; label: string }[] = [
    { url: `https://medium.com/feed/tag/${encodeURIComponent(SEARCH_TERM.toLowerCase().replace(/\s+/g, "-"))}`, label: `tag:${SEARCH_TERM}` },
  ];

  if (EXTRA_FEED) {
    const feedUrl = EXTRA_FEED.startsWith("@")
      ? `https://medium.com/feed/${EXTRA_FEED}`
      : `https://medium.com/feed/${EXTRA_FEED}`;
    feeds.push({ url: feedUrl, label: `feed:${EXTRA_FEED}` });
  }

  const allPosts: ParsedPost[] = [];

  for (const feed of feeds) {
    try {
      console.error(`Fetching: ${feed.url}`);
      const items = await fetchRSS(feed.url);
      const posts = items.map((item) => parseItem(item, feed.label));
      console.error(`  → ${posts.length} posts`);
      allPosts.push(...posts);
    } catch (err) {
      console.error(`  → Failed: ${(err as Error).message}`);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const output = {
    platform: "Medium",
    searchTerm: SEARCH_TERM,
    extraFeed: EXTRA_FEED || null,
    fetchedAt: new Date().toISOString(),
    summary: {
      totalPostsFetched: unique.length,
      feedsQueried: feeds.map((f) => f.url),
      authors: [...new Set(unique.map((p) => p.author).filter(Boolean))],
      topTags: Object.entries(
        unique.flatMap((p) => p.tags).reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort(([, a], [, b]) => b - a).slice(0, 20).map(([tag, count]) => ({ tag, count })),
    },
    posts: unique,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
