import { XMLParser } from "fast-xml-parser";
import { ScraperError } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
});

export interface RawMediumItem {
  title: string | { __cdata: string };
  link: string;
  guid?: string | { "#text": string };
  pubDate?: string;
  "dc:creator"?: string | { __cdata: string };
  description?: string | { __cdata: string };
  "content:encoded"?: string | { __cdata: string };
}

export async function fetchMediumFeed(tagSlug: string): Promise<RawMediumItem[]> {
  const url = `https://medium.com/feed/tag/${encodeURIComponent(tagSlug)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; rivaleye-bot/1.0)",
      Accept: "application/rss+xml, text/xml, */*",
    },
  });
  if (!res.ok)
    throw new ScraperError("medium", `RSS HTTP ${res.status} for tag "${tagSlug}"`);
  const xml = await res.text();
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: RawMediumItem | RawMediumItem[] } };
  };
  const items = parsed.rss?.channel?.item ?? [];
  return Array.isArray(items) ? items : [items];
}
