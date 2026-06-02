# LinkedIn Integration — Spec

**Date:** 2026-05-26  
**Status:** Approved

---

## Goal

Make LinkedIn a first-class platform in RivalEye — selectable in the scan form, scraped automatically, and feeding Love/Pain/Gap/Switch signals identically to Reddit, App Store, and every other live platform.

---

## Architecture

### Two-phase Apify pipeline inside `LinkedInScraper.fetch()`

**Phase 1 — Discover posts** (`datadoping/linkedin-company-posts-scraper`)

- Derives company slug from competitor name: lowercase, spaces → hyphens (e.g. `"HubSpot"` → `"hubspot"`, `"Zoho CRM"` → `"zoho-crm"`)
- Calls actor with `companyUrl: "https://www.linkedin.com/company/{slug}"`, `maxPosts: 20`
- Returns post text + post URLs
- If actor returns 0 posts → log warning, return `[]` gracefully (no throw)

**Phase 2 — Scrape comments** (`datadoping/linkedin-post-comments-scraper`)

- Feeds post URLs from Phase 1 as `posts: [urls]`, `maxComments: 50`
- Returns each comment as a `NormalizedPost`

Both phase results are merged and returned as a single `NormalizedPost[]`.

### Data flow (unchanged worker pipeline)

```
scan form → POST /v1/reports → worker scrape.fetch event
  → LinkedInScraper.fetch() → Phase 1 + Phase 2
  → NormalizedPost[] → mentions table
  → llm.stage-a → clustering → Love/Pain/Gap/Switch
  → synth.run → report sections
  → frontend report view
```

No changes to `scrape/fetch.ts`, the LLM pipeline, or any report display components. LinkedIn data flows through identically to every other platform.

---

## Files changed

| File | Change |
|---|---|
| `packages/scrapers/src/linkedin/index.ts` | Rewrite `fetch()` as two-phase Apify chain |
| `packages/scrapers/src/index.ts` | Add `"linkedin"` to `ALL_PLATFORMS` |
| `packages/shared/src/llm/config.ts` | Add `"linkedin"` to `ENABLED_PLATFORMS` |
| `packages/web/src/routes/scan.tsx` | Set LinkedIn entry `live: true` |

---

## NormalizedPost mapping

### From Phase 1 (company posts)

| Apify field | NormalizedPost field |
|---|---|
| `postId` / `id` | `externalId` |
| `postUrl` / `url` | `url` |
| `authorName` / `author.name` | `author` |
| `text` / `content` | `body` |
| `numLikes` / `likes` / `totalReactions` | `score` |
| `commentsCount` / `numComments` | `numComments` |
| `postedAt` / `date` / `publishedAt` | `createdAt` |

### From Phase 2 (comments) — already verified against real Apify output

| Apify field | NormalizedPost field |
|---|---|
| `comment_id` | `externalId` |
| `comment_url` | `url` |
| `author.name` / `owner_name` | `author` |
| `text` | `body` |
| `total_reactions` | `score` |
| `total_replies` | `numComments` |
| `posted_at.timestamp` (ms) | `createdAt` |
| `replies[]` | flattened recursively into additional `NormalizedPost` entries |

---

## Error handling

- Phase 1 returns 0 posts → return `[]`, log warning with company URL tried
- Phase 1 Apify error → throw `ScraperError` (worker retries 3×)
- Phase 2 Apify error → throw `ScraperError`
- Phase 2 returns 0 comments → return Phase 1 posts only (not an error)

---

## Cost estimate per scan

- Phase 1: ~20 posts × $0.00155 = ~$0.03
- Phase 2: ~20 posts × 50 comments × $0.00155 = ~$1.55
- Total per competitor LinkedIn scan: **~$1.58**

---

## Constraints

- LinkedIn aggressively rate-limits consecutive runs. Scans spaced >10 min apart work reliably.
- Free Apify tier: 4 posts / 100 comments per run limit (actor-enforced). Paid tier removes this.
- Company slug auto-derivation works for most SaaS companies. Edge cases (e.g. company name differs from LinkedIn slug) return 0 posts with a warning log.
