import type { NormalizedPost } from "../types";
import type { RawMediumItem } from "./client";

export function unwrap(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "__cdata" in val)
    return (val as { __cdata: string }).__cdata;
  return String(val);
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractGuid(item: RawMediumItem): string {
  if (!item.guid) return item.link;
  if (typeof item.guid === "string") return item.guid;
  return (item.guid as { "#text": string })["#text"] ?? item.link;
}

function safeDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function normalizeMediumPayload(items: RawMediumItem[]): NormalizedPost[] {
  return items.map((item) => {
    const guid = extractGuid(item);
    const rawId = guid.startsWith("https://medium.com/p/")
      ? guid.slice("https://medium.com/p/".length)
      : guid;
    const content = unwrap(item["content:encoded"] ?? item.description ?? "");
    const body = stripHtml(content).slice(0, 5000);

    return {
      platform: "medium",
      externalId: `medium:${rawId}`,
      url: item.link || guid,
      author: unwrap(item["dc:creator"]) || null,
      title: unwrap(item.title) || null,
      body,
      score: null,
      numComments: null,
      createdAt: safeDate(item.pubDate),
      raw: { item },
    };
  });
}
