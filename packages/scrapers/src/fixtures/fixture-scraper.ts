import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedPost, PlatformId, Scraper, ScrapeQuery } from "../types";
import { synthesizePosts } from "./synthesize";

/**
 * Zero-cost scraper for the verification path (SCRAPER_PROVIDER=fixtures).
 *
 * Replays recorded posts from SCRAPER_FIXTURES_DIR/<platform>.json when present
 * (exported from a real scan via scripts/export-fixtures.ts), otherwise
 * synthesizes deterministic realistic posts. Never hits a network or paid
 * provider. Simulates latency (MOCK_SCRAPER_LATENCY_MS) with seeded variance.
 */
export class FixtureScraper implements Scraper {
  readonly platform: PlatformId;
  private readonly fixturesDir: string | null;
  private readonly latencyMs: number;

  constructor(platform: PlatformId) {
    this.platform = platform;
    this.fixturesDir = process.env.SCRAPER_FIXTURES_DIR || null;
    const raw = Number(process.env.MOCK_SCRAPER_LATENCY_MS ?? 500);
    this.latencyMs = Number.isFinite(raw) && raw >= 0 ? raw : 500;
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    await this.simulateLatency(query);
    const recorded = this.loadRecorded();
    const posts = recorded ?? synthesizePosts(this.platform, query);
    return query.limit ? posts.slice(0, query.limit) : posts;
  }

  private loadRecorded(): NormalizedPost[] | null {
    if (!this.fixturesDir) return null;
    const path = join(this.fixturesDir, `${this.platform}.json`);
    if (!existsSync(path)) return null;
    try {
      const arr = JSON.parse(readFileSync(path, "utf8")) as Array<Record<string, unknown>>;
      return arr.map((p) => ({
        platform: this.platform,
        externalId: String(p.externalId ?? p.external_id ?? ""),
        url: String(p.url ?? ""),
        author: (p.author as string | null) ?? null,
        title: (p.title as string | null) ?? null,
        body: String(p.body ?? ""),
        score: (p.score as number | null) ?? null,
        numComments: (p.numComments as number | null) ?? (p.num_comments as number | null) ?? null,
        createdAt: new Date((p.createdAt as string) ?? (p.posted_at as string) ?? Date.now()),
        raw: (p.raw as unknown) ?? {},
      }));
    } catch {
      return null;
    }
  }

  private simulateLatency(query: ScrapeQuery): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    let h = 0;
    const key = `${this.platform}${query.competitor ?? ""}`;
    for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
    const frac = ((h >>> 0) % 1000) / 1000;
    return new Promise((resolve) => setTimeout(resolve, this.latencyMs * (0.5 + frac)));
  }
}
