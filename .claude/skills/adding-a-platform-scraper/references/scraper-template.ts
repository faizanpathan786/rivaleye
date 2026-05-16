import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

export interface ExampleConfig {
  apiKey: string;
  baseUrl?: string;
}

export class ExampleScraper implements Scraper {
  readonly platform = "example" as const;

  private readonly config: ExampleConfig;

  constructor() {
    const apiKey = process.env.EXAMPLE_API_KEY;
    if (!apiKey) throw new Error("EXAMPLE_API_KEY is required");
    this.config = { apiKey };
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    try {
      const raw = await this.fetchRaw(query);
      return this.normalize(raw);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("example", "fetch failed", err);
    }
  }

  private async fetchRaw(query: ScrapeQuery): Promise<unknown[]> {
    const url = `https://api.example.com/search?q=${encodeURIComponent(query.competitor)}&limit=${query.limit ?? 50}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    if (!res.ok) throw new ScraperError("example", `HTTP ${res.status}`);
    const data = (await res.json()) as { items: unknown[] };
    return data.items;
  }

  private normalize(raw: unknown[]): NormalizedPost[] {
    return raw.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        platform: "example" as const,
        externalId: String(r["id"]),
        url: String(r["url"] ?? ""),
        author: typeof r["author"] === "string" ? r["author"] : null,
        title: typeof r["title"] === "string" ? r["title"] : null,
        body: String(r["text"] ?? r["body"] ?? ""),
        score: typeof r["score"] === "number" ? r["score"] : null,
        numComments: typeof r["comments"] === "number" ? r["comments"] : null,
        createdAt: new Date(String(r["created_at"] ?? Date.now())),
        raw: item,
      };
    });
  }
}
