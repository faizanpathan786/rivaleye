# @rivaleye/scrapers — Multi-platform Scraper Guide

One `Scraper` interface, one implementation per platform. Consumed by `@rivaleye/worker`. Never imported by `@rivaleye/api` directly — api enqueues jobs; worker runs scrapers.

---

## 1. Interface

```ts
export interface Scraper {
  readonly platform: PlatformId;
  fetch(query: ScrapeQuery): Promise<NormalizedPost[]>;
}
```

`getScraper(platform)` returns the concrete impl. Every scraper:

- Owns its auth, rate limiter, retry policy.
- Returns `NormalizedPost[]` — no platform-specific shape leaks out.
- Throws `ScraperError` (typed). Never returns partial silently.
- Stateless or constructor-injected config — never reads `process.env` mid-call. Pull env at construction.

---

## 2. Build vs buy

| Platform | Strategy | Reason |
|---|---|---|
| reddit | DIY (official API) | Generous limits, well-documented. |
| producthunt | DIY (GraphQL API) | Free, rate-limited but enough. |
| appstore | DIY (iTunes RSS) | Free, official, simple XML. |
| playstore | DIY (`google-play-scraper` lib) | Mature lib, no official API. |
| g2 | **Buy** (Apify g2-scraper actor) | Anti-bot, ToS risk. |
| capterra | **Buy** (Apify capterra-reviews) | Same as G2. |
| twitter | **Buy** (X API Basic $200/mo) or Apify | API is the only legal path; pricing painful. |
| linkedin | **Buy** (Apify or Phantombuster) | ToS hostile. Never DIY. |
| gmaps | **Buy** (Apify gmaps-reviews) or Places API | Places API expensive at volume. |

DIY scrapers live fully in this package. "Buy" scrapers wrap a 3rd-party API client; we own the call + normalization, not the scraping.

---

## 3. Adding a platform

1. Add `PlatformId` literal in `src/types.ts`.
2. Create `src/<platform>/index.ts` exporting a class implementing `Scraper`.
3. Add to `src/index.ts` re-exports and `getScraper` switch + `ALL_PLATFORMS`.
4. Add env vars to root `.env.example` and document in root CLAUDE.md.
5. Add normalizer unit tests (`bun test`) — feed sample raw payload, assert `NormalizedPost`.

---

## 4. Hard rules

1. **Never let platform-specific fields leak out of a scraper.** All output is `NormalizedPost`.
2. **Never call a scraper from `@rivaleye/api`.** Api enqueues. Worker calls.
3. **Never `process.env` mid-fetch.** Inject config at construction.
4. **Never silently return `[]` on error.** Throw `ScraperError`.
5. **Hostile platforms = buy.** No headless browser farms in this repo.
6. **Respect rate limits.** Each scraper owns its limiter (bottleneck / p-limit / hand-rolled).
