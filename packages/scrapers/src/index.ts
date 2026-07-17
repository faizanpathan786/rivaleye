export * from "./types";
export { RedditScraper } from "./reddit";
export { G2Scraper } from "./g2";
export { CapterraScraper } from "./capterra";
export { TrustpilotScraper } from "./trustpilot";
export { TwitterScraper } from "./twitter";
export { LinkedInScraper } from "./linkedin";
export { ProductHuntScraper } from "./producthunt";
export { AppStoreScraper } from "./appstore";
export { PlayStoreScraper } from "./playstore";
export { GoogleMapsScraper } from "./gmaps";
export { HackerNewsScraper } from "./hackernews";
export { DevToScraper } from "./devto";
export { WebsiteScraper } from "./website";
import type { Scraper, PlatformId } from "./types";
import { RedditScraper } from "./reddit";
import { G2Scraper } from "./g2";
import { CapterraScraper } from "./capterra";
import { TrustpilotScraper } from "./trustpilot";
import { TwitterScraper } from "./twitter";
import { LinkedInScraper } from "./linkedin";
import { ProductHuntScraper } from "./producthunt";
import { AppStoreScraper } from "./appstore";
import { PlayStoreScraper } from "./playstore";
import { GoogleMapsScraper } from "./gmaps";
import { HackerNewsScraper } from "./hackernews";
import { DevToScraper } from "./devto";
import { WebsiteScraper } from "./website";
import { FixtureScraper } from "./fixtures/fixture-scraper";

export { FixtureScraper } from "./fixtures/fixture-scraper";
export { synthesizePosts } from "./fixtures/synthesize";

// Zero-cost verification path: when SCRAPER_PROVIDER=fixtures, every platform
// resolves to the deterministic FixtureScraper (recorded/synthetic posts, no
// network, no paid provider). Read once at module load.
const USE_FIXTURES = process.env.SCRAPER_PROVIDER === "fixtures";

export function getScraper(platform: PlatformId): Scraper {
  if (USE_FIXTURES) return new FixtureScraper(platform);
  switch (platform) {
    case "reddit":
      return new RedditScraper();
    case "g2":
      return new G2Scraper();
    case "capterra":
      return new CapterraScraper();
    case "trustpilot":
      return new TrustpilotScraper();
    case "twitter":
      return new TwitterScraper();
    case "linkedin":
      return new LinkedInScraper();
    case "producthunt":
      return new ProductHuntScraper();
    case "appstore":
      return new AppStoreScraper();
    case "playstore":
      return new PlayStoreScraper();
    case "gmaps":
      return new GoogleMapsScraper();
    case "hackernews":
      return new HackerNewsScraper();
    case "devto":
      return new DevToScraper();
    case "website":
      return new WebsiteScraper();
  }
}

export const ALL_PLATFORMS: PlatformId[] = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "website",
  "linkedin",
  "twitter",
];
