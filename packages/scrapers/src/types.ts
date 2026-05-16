export type PlatformId =
  | "reddit"
  | "g2"
  | "capterra"
  | "twitter"
  | "linkedin"
  | "producthunt"
  | "appstore"
  | "playstore"
  | "gmaps"
  | "hackernews"
  | "devto";

export interface NormalizedPost {
  platform: PlatformId;
  externalId: string;
  url: string;
  author: string | null;
  title: string | null;
  body: string;
  score: number | null;
  numComments: number | null;
  createdAt: Date;
  raw: unknown;
}

export interface ScrapeQuery {
  competitor: string;
  category?: string;
  keywords?: string[];
  limit?: number;
}

export interface Scraper {
  readonly platform: PlatformId;
  fetch(query: ScrapeQuery): Promise<NormalizedPost[]>;
}

export class ScraperError extends Error {
  constructor(
    public readonly platform: PlatformId,
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(`[${platform}] ${message}`);
  }
}
