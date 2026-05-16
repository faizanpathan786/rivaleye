export * from "./types";
export { RedditScraper } from "./reddit";
export { G2Scraper } from "./g2";
export { CapterraScraper } from "./capterra";
export { TwitterScraper } from "./twitter";
export { LinkedInScraper } from "./linkedin";
export { ProductHuntScraper } from "./producthunt";
export { AppStoreScraper } from "./appstore";
export { PlayStoreScraper } from "./playstore";
export { GoogleMapsScraper } from "./gmaps";
export { HackerNewsScraper } from "./hackernews";
export { DevToScraper } from "./devto";
export { MediumScraper } from "./medium";
export { TrustpilotScraper } from "./trustpilot";
import type { Scraper, PlatformId } from "./types";
import { RedditScraper } from "./reddit";
import { G2Scraper } from "./g2";
import { CapterraScraper } from "./capterra";
import { TwitterScraper } from "./twitter";
import { LinkedInScraper } from "./linkedin";
import { ProductHuntScraper } from "./producthunt";
import { AppStoreScraper } from "./appstore";
import { PlayStoreScraper } from "./playstore";
import { GoogleMapsScraper } from "./gmaps";
import { HackerNewsScraper } from "./hackernews";
import { DevToScraper } from "./devto";
import { MediumScraper } from "./medium";
import { TrustpilotScraper } from "./trustpilot";

export function getScraper(platform: PlatformId): Scraper {
  switch (platform) {
    case "reddit":
      return new RedditScraper();
    case "g2":
      return new G2Scraper();
    case "capterra":
      return new CapterraScraper();
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
    case "medium":
      return new MediumScraper();
    case "trustpilot":
      return new TrustpilotScraper();
  }
}

export const ALL_PLATFORMS: PlatformId[] = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "medium",
  "trustpilot",
];
