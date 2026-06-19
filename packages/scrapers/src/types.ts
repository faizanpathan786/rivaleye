export type PlatformId =
  | "reddit"
  | "capterra"
  | "g2"
  | "trustpilot"
  | "twitter"
  | "linkedin"
  | "producthunt"
  | "appstore"
  | "playstore"
  | "gmaps"
  | "hackernews"
  | "devto"
  | "website";

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
  websiteUrl?: string;
  // Canonical identifiers resolved upstream (Sonar discovery). When present, a
  // scraper should use the exact identifier instead of name-based search so
  // we never accidentally analyse a lookalike app or wrong company.
  appStoreId?: string;       // Apple numeric trackId (digits only)
  playStoreAppId?: string;   // Google Play package id (e.g. "notion.id")
  linkedinUrl?: string;
  twitterHandle?: string;    // handle without leading @
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
