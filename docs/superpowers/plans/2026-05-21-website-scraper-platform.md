# Website Scraper Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a `website` platform into the RivalEye pipeline that crawls a competitor's own marketing site using Playwright, converts pages to `NormalizedPost[]`, and extracts product signals (features, pricing framing, positioning angles, capability gaps) via Stage A/B LLM prompts.

**Architecture:** New platform follows the HackerNews pattern exactly — a `WebsiteScraper implements Scraper` in `packages/scrapers/src/website/`, per-platform Stage A/B prompts in `packages/worker/src/prompts/platform/website/`, and wiring into `getScraper()`, `ENABLED_PLATFORMS`, and both `pickBuilder()` switches. The competitor's `website_url` is stored on the `reports` table and threaded through `ScrapeQuery.websiteUrl`. The web form gets an optional URL input that conditionally enables the `website` platform job.

**Tech Stack:** Playwright (`playwright` npm), Bun, TypeScript strict, Drizzle ORM, Zod, React Hook Form

---

## File Map

**Create:**
- `packages/scrapers/src/website/url-utils.ts` — URL normalization, dedup, exclusion filtering
- `packages/scrapers/src/website/page-selector.ts` — URL scoring + `selectTopUrls()`
- `packages/scrapers/src/website/client.ts` — Playwright crawler: discover links, score/filter, crawl pages
- `packages/scrapers/src/website/normalize.ts` — pages → `NormalizedPost[]`
- `packages/scrapers/src/website/index.ts` — `WebsiteScraper implements Scraper`
- `packages/worker/src/prompts/platform/website/extract.ts` — Stage A prompt for marketing site pages
- `packages/worker/src/prompts/platform/website/summarize.ts` — Stage B prompt for website signals

**Modify:**
- `packages/scrapers/src/types.ts` — add `"website"` to `PlatformId`, `websiteUrl?` to `ScrapeQuery`
- `packages/scrapers/src/index.ts` — export `WebsiteScraper`, add to `getScraper()` switch
- `packages/shared/src/llm/config.ts` — add `"website"` to `ENABLED_PLATFORMS`
- `packages/worker/src/prompts/shared.ts` — add `"website"` to `platformIdSchema`
- `packages/worker/src/pipeline/stage-a-extract.ts` — add `website` case to `pickBuilder()`
- `packages/worker/src/pipeline/stage-b-summarize.ts` — add `website` case to `pickBuilder()`
- `packages/worker/src/pg-runner/source-worker.ts` — thread `websiteUrl` from report into `scraper.fetch()`
- `packages/api/src/db/schema/reports.ts` — add `website_url text` column
- `packages/shared/src/schemas/report.ts` — add `website_url` optional to `createReportInputSchema`
- `packages/api/src/services/reports.service.ts` — persist `website_url` on insert
- `packages/web/src/components/report/competitor-form.schema.ts` — add optional `website_url` field
- `packages/web/src/components/report/competitor-form.tsx` — add URL input, conditionally include website in payload
- `packages/web/src/api/reports.ts` — add `website_url?` to `CreateReportPayload`

**Run (not a code file):**
- `pnpm db:generate` — after schema change in Task 6
- `pnpm db:migrate` — after `db:generate`
- `pnpm add playwright` in `packages/scrapers/` — install Playwright

---

## Task 1: Add `"website"` to shared types

**Files:**
- Modify: `packages/scrapers/src/types.ts`
- Modify: `packages/worker/src/prompts/shared.ts`

- [ ] **Step 1: Add "website" to PlatformId and ScrapeQuery**

Edit `packages/scrapers/src/types.ts`:

```typescript
export type PlatformId =
  | "reddit"
  | "capterra"
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
```

- [ ] **Step 2: Add "website" to platformIdSchema in prompts/shared.ts**

Edit `packages/worker/src/prompts/shared.ts` — change the first line of `platformIdSchema`:

```typescript
export const platformIdSchema = z.enum([
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "website",
]);
```

- [ ] **Step 3: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check
```

Expected: errors only in places that haven't been wired yet (getScraper switch, pickBuilder). That's fine — we'll fix those in later tasks.

- [ ] **Step 4: Commit**

```bash
git add packages/scrapers/src/types.ts packages/worker/src/prompts/shared.ts
git commit -m "feat(scrapers): add 'website' to PlatformId, ScrapeQuery.websiteUrl, platformIdSchema"
```

---

## Task 2: Install Playwright

**Files:** `packages/scrapers/package.json`

- [ ] **Step 1: Add playwright dependency**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm --filter @rivaleye/scrapers add playwright
```

- [ ] **Step 2: Install Playwright browsers (Chromium)**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm --filter @rivaleye/scrapers exec playwright install chromium
```

Expected: "Chromium ... downloaded to ..."

- [ ] **Step 3: Commit**

```bash
git add packages/scrapers/package.json pnpm-lock.yaml
git commit -m "feat(scrapers): add playwright dependency for website scraper"
```

---

## Task 3: URL utilities

**Files:**
- Create: `packages/scrapers/src/website/url-utils.ts`

- [ ] **Step 1: Create url-utils.ts**

```typescript
// packages/scrapers/src/website/url-utils.ts

const TRACKING_QUERY_PREFIXES = ["utm_"];
const TRACKING_QUERY_KEYS = new Set(["context", "fbclid", "gclid", "msclkid", "ref", "source"]);

const EXCLUDED_PATH_KEYWORDS = new Set([
  "login", "log-in", "signin", "sign-in", "signup", "sign-up", "register",
  "careers", "jobs", "privacy", "terms", "legal", "dpa", "subprocessors",
  "status", "cookie", "cookies",
]);

export function normalizeUrl(url: string, baseUrl?: string): string | null {
  if (!url.trim()) return null;
  try {
    const absolute = baseUrl ? new URL(url.trim(), baseUrl).href : url.trim();
    const parsed = new URL(absolute);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    let hostname = (parsed.hostname ?? "").toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);

    const netloc = parsed.port ? `${hostname}:${parsed.port}` : hostname;

    let path = parsed.pathname || "/";
    while (path.includes("//")) path = path.replace("//", "/");
    if (path !== "/") path = path.replace(/\/+$/, "");

    const queryItems: [string, string][] = [];
    for (const [key, value] of new URLSearchParams(parsed.search)) {
      const keyLower = key.toLowerCase();
      if (TRACKING_QUERY_KEYS.has(keyLower)) continue;
      if (TRACKING_QUERY_PREFIXES.some((p) => keyLower.startsWith(p))) continue;
      queryItems.push([key, value]);
    }
    queryItems.sort((a, b) => a[0].localeCompare(b[0]));
    const query = queryItems.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

    return `${parsed.protocol}//${netloc}${path}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

export function domainKey(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = (parsed.hostname ?? "").toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return "";
  }
}

export function isSameDomain(url: string, rootUrl: string): boolean {
  return domainKey(url) === domainKey(rootUrl);
}

export function isExcludedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean).map((p) => p.toLowerCase());
    return parts.some((part) =>
      [...EXCLUDED_PATH_KEYWORDS].some((keyword) => keyword === part || part.includes(keyword)),
    );
  } catch {
    return true;
  }
}

export function normalizeInternalUrls(urls: string[], rootUrl: string): string[] {
  const normalizedRoot = normalizeUrl(rootUrl);
  if (!normalizedRoot) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawUrl of urls) {
    const normalized = normalizeUrl(rawUrl, normalizedRoot);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    if (!isSameDomain(normalized, normalizedRoot)) continue;
    if (isExcludedUrl(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}
```

- [ ] **Step 2: Create page-selector.ts**

Create `packages/scrapers/src/website/page-selector.ts`:

```typescript
// packages/scrapers/src/website/page-selector.ts

const HIGH_VALUE_KEYWORDS: Record<string, number> = {
  pricing: 120,
  features: 95,
  product: 90,
  products: 85,
  solutions: 85,
  customers: 82,
  integrations: 78,
  security: 76,
  "case-studies": 72,
  "case-study": 72,
  compare: 70,
  comparison: 70,
  alternatives: 70,
  "use-cases": 60,
  usecases: 60,
  docs: 55,
  documentation: 55,
  blog: 35,
};

const EXACT_PATH_BONUS: Record<string, number> = {
  pricing: 140,
  features: 115,
  product: 115,
  products: 110,
  solutions: 110,
  customers: 105,
  integrations: 100,
  security: 98,
  docs: 90,
  documentation: 90,
  blog: 65,
};

const LOW_VALUE_KEYWORDS: Record<string, number> = {
  changelog: -20,
  events: -25,
  press: -30,
  news: -30,
  community: -35,
  contact: -35,
  partners: -20,
};

export function scoreUrl(url: string, homepageUrl: string): number {
  try {
    const parsed = new URL(url);
    const homepage = new URL(homepageUrl);

    const path = (parsed.pathname ?? "/").replace(/^\/|\/$/g, "").toLowerCase();

    if (parsed.hostname === homepage.hostname && path === "") return 110;

    let score = 0;
    const pathForMatching = path.replace(/_/g, "-");
    const parts = pathForMatching.split("/").filter(Boolean);

    const lastPart = parts[parts.length - 1];
    if (lastPart !== undefined) {
      score += EXACT_PATH_BONUS[lastPart] ?? 0;
    }

    for (const [keyword, weight] of Object.entries(HIGH_VALUE_KEYWORDS)) {
      if (parts.includes(keyword)) {
        score += weight;
      } else if (pathForMatching.includes(keyword)) {
        score += Math.floor(weight / 2);
      }
    }

    for (const [keyword, penalty] of Object.entries(LOW_VALUE_KEYWORDS)) {
      if (parts.includes(keyword) || pathForMatching.includes(keyword)) {
        score += penalty;
      }
    }

    const depth = parts.length;
    score -= Math.max(0, depth - 1) * 28;

    if (parsed.search) score -= 90;

    return score;
  } catch {
    return -999;
  }
}

export function selectTopUrls(urls: string[], homepageUrl: string, limit = 15): string[] {
  const unique = [...new Map([homepageUrl, ...urls].map((u) => [u, u])).values()];
  return unique
    .sort((a, b) => {
      const diff = scoreUrl(b, homepageUrl) - scoreUrl(a, homepageUrl);
      if (diff !== 0) return diff;
      const lenDiff = a.length - b.length;
      if (lenDiff !== 0) return lenDiff;
      return a.localeCompare(b);
    })
    .slice(0, limit);
}
```

- [ ] **Step 3: Run type-check for the new files**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -E "(website|error)" | head -20
```

Expected: no errors in the two new files.

- [ ] **Step 4: Commit**

```bash
git add packages/scrapers/src/website/url-utils.ts packages/scrapers/src/website/page-selector.ts
git commit -m "feat(scrapers): port url-utils and page-selector from Python crawl4ai"
```

---

## Task 4: Website Playwright client + normalizer

**Files:**
- Create: `packages/scrapers/src/website/client.ts`
- Create: `packages/scrapers/src/website/normalize.ts`

- [ ] **Step 1: Create client.ts**

```typescript
// packages/scrapers/src/website/client.ts

import { chromium } from "playwright";
import { normalizeUrl, normalizeInternalUrls } from "./url-utils";
import { selectTopUrls } from "./page-selector";
import { ScraperError } from "../types";

export interface CrawledPage {
  url: string;
  status: "success" | "failed";
  markdown: string;
  title: string | null;
  description: string | null;
  errors: string[];
}

const PAGE_LIMIT = 15;
const PAGE_TIMEOUT_MS = 30_000;

export async function crawlWebsite(websiteUrl: string): Promise<CrawledPage[]> {
  const normalizedHomepage = normalizeUrl(websiteUrl);
  if (!normalizedHomepage) {
    throw new ScraperError("website", `Invalid website URL: ${websiteUrl}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; RivalEye/1.0; +https://rivaleye.com/bot)",
    });

    const discoveredUrls = await discoverLinks(context, normalizedHomepage);
    const selectedUrls = selectTopUrls(discoveredUrls, normalizedHomepage, PAGE_LIMIT);

    const pages: CrawledPage[] = [];
    for (const url of selectedUrls) {
      const page = await crawlSinglePage(context, url);
      pages.push(page);
    }

    return pages;
  } finally {
    await browser.close();
  }
}

async function discoverLinks(
  context: import("playwright").BrowserContext,
  homepageUrl: string,
): Promise<string[]> {
  const page = await context.newPage();
  try {
    await page.goto(homepageUrl, { timeout: PAGE_TIMEOUT_MS, waitUntil: "domcontentloaded" });
    const rawLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]")).map(
        (a) => (a as HTMLAnchorElement).href,
      );
    });
    return normalizeInternalUrls(rawLinks, homepageUrl);
  } catch {
    return [];
  } finally {
    await page.close();
  }
}

async function crawlSinglePage(
  context: import("playwright").BrowserContext,
  url: string,
): Promise<CrawledPage> {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, {
      timeout: PAGE_TIMEOUT_MS,
      waitUntil: "domcontentloaded",
    });
    if (!response || !response.ok()) {
      return {
        url,
        status: "failed",
        markdown: "",
        title: null,
        description: null,
        errors: [`HTTP ${response?.status() ?? "unknown"}`],
      };
    }

    await removeClutter(page);

    const title = await page.title().catch(() => null);
    const description = await page
      .$eval('meta[name="description"]', (el) => el.getAttribute("content"))
      .catch(() => null);
    const markdown = await extractMarkdown(page);

    return { url, status: "success", markdown, title, description, errors: [] };
  } catch (err) {
    return {
      url,
      status: "failed",
      markdown: "",
      title: null,
      description: null,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  } finally {
    await page.close();
  }
}

async function removeClutter(page: import("playwright").Page): Promise<void> {
  await page
    .evaluate(() => {
      const selectors = ["nav", "header", "footer", "script", "style", "noscript", "form", ".cookie-banner", "#cookie-banner"];
      for (const sel of selectors) {
        for (const el of document.querySelectorAll(sel)) el.remove();
      }
    })
    .catch(() => {});
}

async function extractMarkdown(page: import("playwright").Page): Promise<string> {
  const text = await page.evaluate(() => {
    function nodeToText(node: Node, depth: number): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? "").replace(/\s+/g, " ");
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes).map((c) => nodeToText(c, depth + 1)).join("");

      if (["h1", "h2", "h3", "h4"].includes(tag)) {
        const level = parseInt(tag[1] ?? "1", 10);
        return `\n${"#".repeat(level)} ${children.trim()}\n`;
      }
      if (tag === "p") return `\n${children.trim()}\n`;
      if (tag === "li") return `\n- ${children.trim()}`;
      if (["ul", "ol"].includes(tag)) return `\n${children}\n`;
      if (tag === "a") {
        const href = el.getAttribute("href");
        return href ? `[${children}](${href})` : children;
      }
      if (["strong", "b"].includes(tag)) return `**${children}**`;
      if (["em", "i"].includes(tag)) return `*${children}*`;
      if (tag === "code") return `\`${children}\``;
      if (tag === "br") return "\n";
      return children;
    }
    return nodeToText(document.body, 0);
  });

  return text
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);
}
```

- [ ] **Step 2: Create normalize.ts**

```typescript
// packages/scrapers/src/website/normalize.ts

import type { NormalizedPost } from "../types";
import type { CrawledPage } from "./client";

export function normalizeWebsitePages(pages: CrawledPage[]): NormalizedPost[] {
  return pages
    .filter((page) => page.status === "success" && page.markdown.trim().length > 50)
    .map((page): NormalizedPost => {
      const title = page.title ?? deriveTitle(page.url);
      const headerLine = page.description ? `${title}\n${page.description}\n\n` : `${title}\n\n`;
      const body = `${headerLine}${page.markdown}`.slice(0, 8000);

      return {
        platform: "website",
        externalId: `website:${page.url}`,
        url: page.url,
        author: null,
        title,
        body,
        score: null,
        numComments: null,
        createdAt: new Date(),
        raw: page,
      };
    });
}

function deriveTitle(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last) return parsed.hostname;
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}
```

- [ ] **Step 3: Create index.ts**

```typescript
// packages/scrapers/src/website/index.ts

import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { crawlWebsite } from "./client";
import { normalizeWebsitePages } from "./normalize";

export class WebsiteScraper implements Scraper {
  readonly platform = "website" as const;

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    if (!query.websiteUrl) {
      throw new ScraperError("website", "websiteUrl is required for the website scraper");
    }
    try {
      const pages = await crawlWebsite(query.websiteUrl);
      return normalizeWebsitePages(pages);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      throw new ScraperError("website", "crawl failed", err);
    }
  }
}
```

- [ ] **Step 4: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "website" | head -20
```

Expected: no errors in the three new files.

- [ ] **Step 5: Commit**

```bash
git add packages/scrapers/src/website/
git commit -m "feat(scrapers): add WebsiteScraper with Playwright crawler + normalize"
```

---

## Task 5: Register scraper in getScraper() and ENABLED_PLATFORMS

**Files:**
- Modify: `packages/scrapers/src/index.ts`
- Modify: `packages/shared/src/llm/config.ts`

- [ ] **Step 1: Register in index.ts**

Edit `packages/scrapers/src/index.ts` — add after the devto lines:

```typescript
export * from "./types";
export { RedditScraper } from "./reddit";
export { CapterraScraper } from "./capterra";
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
import { CapterraScraper } from "./capterra";
import { TwitterScraper } from "./twitter";
import { LinkedInScraper } from "./linkedin";
import { ProductHuntScraper } from "./producthunt";
import { AppStoreScraper } from "./appstore";
import { PlayStoreScraper } from "./playstore";
import { GoogleMapsScraper } from "./gmaps";
import { HackerNewsScraper } from "./hackernews";
import { DevToScraper } from "./devto";
import { WebsiteScraper } from "./website";

export function getScraper(platform: PlatformId): Scraper {
  switch (platform) {
    case "reddit":
      return new RedditScraper();
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
];
```

- [ ] **Step 2: Add "website" to ENABLED_PLATFORMS**

Edit `packages/shared/src/llm/config.ts`:

```typescript
import type { PlatformId } from "@rivaleye/scrapers";

export const ENABLED_PLATFORMS = [
  "reddit",
  "appstore",
  "playstore",
  "hackernews",
  "producthunt",
  "devto",
  "website",
] as const;

export type EnabledPlatformId = (typeof ENABLED_PLATFORMS)[number];

export const LLM_MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash:free";
export const LLM_TEMPERATURE = 1.0;

export function readOpenRouterApiKey(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY is required");
  return k;
}

export function assertEnabled(p: PlatformId): EnabledPlatformId {
  if ((ENABLED_PLATFORMS as readonly string[]).includes(p)) return p as EnabledPlatformId;
  throw new Error(`platform ${p} is not enabled`);
}
```

- [ ] **Step 3: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules" | head -20
```

Expected: errors only in `stage-a-extract.ts` and `stage-b-summarize.ts` (missing website case in pickBuilder — to be fixed in Task 8). No errors in scrapers or shared.

- [ ] **Step 4: Commit**

```bash
git add packages/scrapers/src/index.ts packages/shared/src/llm/config.ts
git commit -m "feat(scrapers): register WebsiteScraper in getScraper and ENABLED_PLATFORMS"
```

---

## Task 6: DB schema — add website_url to reports

**Files:**
- Modify: `packages/api/src/db/schema/reports.ts`
- Run: `pnpm db:generate` then `pnpm db:migrate`

- [ ] **Step 1: Add website_url column to reports table**

In `packages/api/src/db/schema/reports.ts`, add after `primary_competitor_name`:

```typescript
  primary_competitor_name: text("primary_competitor_name"),
  primary_competitor_domain: text("primary_competitor_domain"),
  website_url: text("website_url"),   // add this line
  scanned_at: timestamp("scanned_at"),
```

- [ ] **Step 2: Generate migration**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm db:generate
```

Expected: new migration file in `packages/api/drizzle/` like `0007_add_website_url.sql` containing `ALTER TABLE "reports" ADD COLUMN "website_url" text;`

- [ ] **Step 3: Apply migration**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm db:migrate
```

Expected: "Running migrations... done"

- [ ] **Step 4: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules" | head -10
```

Expected: no new errors from schema change.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/schema/reports.ts packages/api/drizzle/
git commit -m "feat(api): add website_url column to reports table"
```

---

## Task 7: Stage A extract prompt for website

**Files:**
- Create: `packages/worker/src/prompts/platform/website/extract.ts`

- [ ] **Step 1: Create website extract prompt**

```typescript
// packages/worker/src/prompts/platform/website/extract.ts

import { platformExtractSchema } from "../../shared";
import type { PipelineCtx } from "../../shared";

const SYSTEM = `You are a competitive intelligence analyst reading a competitor's marketing website.
You will receive a list of pages from the competitor's website, each labelled with a stable id.
Your task: extract product signals that help founders understand the competitor's positioning and capability gaps.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "complaints": [{ "text": "string", "severity": 0.0, "evidence_ids": ["id1"] }],
  "features_requested": [{ "feature": "string", "evidence_ids": ["id1"] }],
  "pricing_signals": [{ "note": "string", "evidence_ids": ["id1"] }],
  "switching_signals": [{ "direction": "inbound|outbound", "competitor": "string", "evidence_ids": ["id1"] }],
  "voice_phrases": { "positive": ["phrase"], "negative": ["phrase"] },
  "notable_quotes": [{ "author": "string", "text": "string", "evidence_id": "id1" }]
}

Rules:
- complaints[].text: A capability gap, limitation, or pain point implied by the site — e.g., "no self-serve pricing", "enterprise-only tier", "missing API docs", "no offline mode listed". These are inferred from what's ABSENT or from "coming soon" language, not user complaints. Severity 0.3–0.8.
- features_requested[].feature: Capabilities implied to be in development, on the roadmap, or conspicuously absent vs. typical market offerings.
- pricing_signals[].note: What can be inferred about pricing — free tier, per-seat vs flat, enterprise-only, trial length, price anchoring copy. Extract verbatim price points if visible.
- switching_signals: Only if the site explicitly names a competitor in a "vs" page, comparison table, or migration guide. direction = "inbound" (they claim users switch FROM that competitor TO this product).
- voice_phrases: Marketing phrases and slogans from the copy. Positive = brand promises. Negative = problems they claim to solve for prospects.
- notable_quotes[].text: Verbatim copy under 150 chars that captures a key positioning claim or differentiator. author = page type (e.g., "pricing page", "homepage", "customers page").
- Use the id labels in evidence_ids; never invent ids.
- If a section has no signal, return an empty array — never omit the key.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface WebsiteExtractInput {
  ctx: PipelineCtx;
  pages: Array<{ id: string; url: string; body: string }>;
}

export function buildWebsiteExtract(input: WebsiteExtractInput): {
  system: string;
  user: string;
  schema: typeof platformExtractSchema;
} {
  const pageBlock = input.pages
    .map((p) => `--- id=${p.id} | url=${p.url}\n${oneLine(p.body)}`)
    .join("\n\n");

  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}

Website pages (id-labelled):
${pageBlock}

Return the JSON object now.`;

  return { system: SYSTEM, user, schema: platformExtractSchema };
}

function oneLine(s: string): string {
  return s.replace(/\n{3,}/g, "\n\n").trim().slice(0, 3000);
}
```

- [ ] **Step 2: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "website" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/platform/website/extract.ts
git commit -m "feat(worker): add Stage A extract prompt for website platform"
```

---

## Task 8: Stage B summarize prompt for website

**Files:**
- Create: `packages/worker/src/prompts/platform/website/summarize.ts`

- [ ] **Step 1: Create website summarize prompt**

```typescript
// packages/worker/src/prompts/platform/website/summarize.ts

import { platformBriefSchema } from "../../shared";
import type { PipelineCtx, PlatformExtract } from "../../shared";

const SYSTEM = `You are a competitive intelligence analyst summarising marketing website signals into a platform-level brief.

Return ONE JSON object matching this exact shape (all keys required, never rename or omit):
{
  "platform": "website",
  "headline": "string",
  "top_themes": [{ "theme": "string", "weight": 0.0 }],
  "sentiment": { "positive": 0.0, "neutral": 0.0, "negative": 0.0 },
  "most_quoted_competitors": ["string"],
  "evidence_coverage": 0.0
}

Rules:
- headline: a declarative sentence capturing the competitor's primary positioning claim or the most striking gap found on the site.
- top_themes[].weight values must sum to approximately 1 (±0.05). Weight themes by prominence in the marketing copy.
- sentiment: from the founder's perspective — how good or bad does this competitor's site make them look to prospects? positive = site is strong/polished, negative = gaps/weaknesses visible, neutral = balanced.
- most_quoted_competitors: names from switching_signals "inbound" entries (their claimed comparisons), or [] if none.
- evidence_coverage: fraction of distinct evidence ids referenced across all fields (0..1).
- Never invent data not present in the extract.
- Return ONLY the JSON object. No prose, no markdown fences.`;

export interface WebsiteSummarizeInput {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}

export function buildWebsiteSummarize(input: WebsiteSummarizeInput): {
  system: string;
  user: string;
  schema: typeof platformBriefSchema;
} {
  const user = `Competitor: ${input.ctx.competitor}
Category: ${input.ctx.category}
Audience: ${input.ctx.audience ?? "unspecified"}
Founder goal: ${input.ctx.goal}
Platform: website

Extract:
${JSON.stringify(input.extract, null, 2)}

Return the JSON object now.`;
  return { system: SYSTEM, user, schema: platformBriefSchema };
}
```

- [ ] **Step 2: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep "website" | head -10
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/prompts/platform/website/summarize.ts
git commit -m "feat(worker): add Stage B summarize prompt for website platform"
```

---

## Task 9: Wire website into stage-a-extract and stage-b-summarize

**Files:**
- Modify: `packages/worker/src/pipeline/stage-a-extract.ts`
- Modify: `packages/worker/src/pipeline/stage-b-summarize.ts`

- [ ] **Step 1: Add website case to stage-a-extract.ts**

Edit `packages/worker/src/pipeline/stage-a-extract.ts` — add import and case:

```typescript
import type { NormalizedPost, PlatformId } from "@rivaleye/scrapers";
import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformExtract } from "../prompts/shared";
import { buildAppStoreExtract } from "../prompts/platform/appstore/extract";
import { buildPlayStoreExtract } from "../prompts/platform/playstore/extract";
import { buildHackerNewsExtract } from "../prompts/platform/hackernews/extract";
import { buildDevToExtract } from "../prompts/platform/devto/extract";
import { buildProductHuntExtract } from "../prompts/platform/producthunt/extract";
import { buildRedditExtract } from "../prompts/platform/reddit/extract";
import { buildWebsiteExtract } from "../prompts/platform/website/extract";

export interface StageAInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  posts: NormalizedPost[];
}

export interface StageAOutput {
  extract: PlatformExtract;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageAExtract(input: StageAInput, opts?: LlmCallOptions): Promise<StageAOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder(input);
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  }, opts);
  return { extract: res.parsed as PlatformExtract, usage: res.usage, model: res.model };
}

type Builder = (input: StageAInput) => {
  system: string;
  user: string;
  schema: typeof import("../prompts/shared").platformExtractSchema;
};

function pickBuilder(p: PlatformId): Builder {
  switch (p) {
    case "appstore":
      return ({ ctx, posts }) =>
        buildAppStoreExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "playstore":
      return ({ ctx, posts }) =>
        buildPlayStoreExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: post.body,
          })),
        });
    case "hackernews":
      return ({ ctx, posts }) =>
        buildHackerNewsExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            score: post.score,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "devto":
      return ({ ctx, posts }) =>
        buildDevToExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            score: post.score,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "producthunt":
      return ({ ctx, posts }) =>
        buildProductHuntExtract({
          ctx,
          reviews: posts.map((post) => ({
            id: post.externalId,
            rating: post.score ?? 0,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "reddit":
      return ({ ctx, posts }) =>
        buildRedditExtract({
          ctx,
          posts: posts.map((post) => ({
            id: post.externalId,
            score: post.score,
            body: `${post.title ?? ""}\n${post.body}`,
          })),
        });
    case "website":
      return ({ ctx, posts }) =>
        buildWebsiteExtract({
          ctx,
          pages: posts.map((post) => ({
            id: post.externalId,
            url: post.url,
            body: post.body,
          })),
        });
    default:
      throw new Error(`Stage A: no extract builder for platform "${p}" yet`);
  }
}
```

- [ ] **Step 2: Add website case to stage-b-summarize.ts**

Edit `packages/worker/src/pipeline/stage-b-summarize.ts` — add import and case:

```typescript
import type { PlatformId } from "@rivaleye/scrapers";
import type { LlmCallOptions, OpenRouterClient } from "@rivaleye/shared";
import type { PipelineCtx, PlatformBrief, PlatformExtract } from "../prompts/shared";
import { buildAppStoreSummarize } from "../prompts/platform/appstore/summarize";
import { buildPlayStoreSummarize } from "../prompts/platform/playstore/summarize";
import { buildHackerNewsSummarize } from "../prompts/platform/hackernews/summarize";
import { buildDevToSummarize } from "../prompts/platform/devto/summarize";
import { buildProductHuntSummarize } from "../prompts/platform/producthunt/summarize";
import { buildRedditSummarize } from "../prompts/platform/reddit/summarize";
import { buildWebsiteSummarize } from "../prompts/platform/website/summarize";

export interface StageBInput {
  llm: OpenRouterClient;
  ctx: PipelineCtx;
  platform: PlatformId;
  extract: PlatformExtract;
}

export interface StageBOutput {
  brief: PlatformBrief;
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export async function runStageBSummarize(input: StageBInput, opts?: LlmCallOptions): Promise<StageBOutput> {
  const builder = pickBuilder(input.platform);
  const built = builder({ ctx: input.ctx, extract: input.extract });
  const res = await input.llm.complete({
    system: built.system,
    user: built.user,
    schema: built.schema,
  }, opts);
  return { brief: res.parsed, usage: res.usage, model: res.model };
}

type SummarizeBuilder = (input: {
  ctx: PipelineCtx;
  extract: PlatformExtract;
}) => {
  system: string;
  user: string;
  schema: typeof import("../prompts/shared").platformBriefSchema;
};

function pickBuilder(p: PlatformId): SummarizeBuilder {
  switch (p) {
    case "appstore":
      return buildAppStoreSummarize;
    case "playstore":
      return buildPlayStoreSummarize;
    case "hackernews":
      return buildHackerNewsSummarize;
    case "devto":
      return buildDevToSummarize;
    case "producthunt":
      return buildProductHuntSummarize;
    case "reddit":
      return buildRedditSummarize;
    case "website":
      return buildWebsiteSummarize;
    default:
      throw new Error(`Stage B: no summarize builder for platform "${p}" yet`);
  }
}
```

- [ ] **Step 3: Run type-check — should now be clean**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/worker/src/pipeline/stage-a-extract.ts packages/worker/src/pipeline/stage-b-summarize.ts
git commit -m "feat(worker): wire website platform into Stage A and Stage B builders"
```

---

## Task 10: API and worker wiring — thread website_url through the pipeline

**Files:**
- Modify: `packages/shared/src/schemas/report.ts`
- Modify: `packages/api/src/services/reports.service.ts`
- Modify: `packages/worker/src/pg-runner/source-worker.ts`

- [ ] **Step 1: Add website_url to createReportInputSchema**

Edit `packages/shared/src/schemas/report.ts` — update the last export:

```typescript
export const createReportInputSchema = z.object({
  category: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(1).max(5),
  target_audience: z.string().min(1),
  founder_goal: reportGoalSchema,
  website_url: z.string().url().optional(),
});
export type CreateReportInput = z.infer<typeof createReportInputSchema>;
```

- [ ] **Step 2: Persist website_url in reports.service.ts**

In `packages/api/src/services/reports.service.ts`, inside the `tx.insert(reports).values({...})` call, add `website_url: input.website_url ?? null` after `primary_competitor_name`:

```typescript
    const [reportRow] = await tx
      .insert(reports)
      .values({
        owner_id,
        category: input.category,
        competitors: input.competitors,
        audience: input.target_audience,
        goal: input.founder_goal,
        status: "queued",
        stage: "queued",
        primary_competitor_name: competitor,
        website_url: input.website_url ?? null,
      })
      .returning({ id: reports.id });
```

- [ ] **Step 3: Thread website_url from report into fetchPosts in source-worker.ts**

In `packages/worker/src/pg-runner/source-worker.ts`:

**a)** Update the `processSourceJob` signature to include `website_url`:

```typescript
export async function processSourceJob(
  job: SourceJobRow,
  reportRow: { id: string; primary_competitor_name: string | null; category: string; audience?: string | null; goal: string; website_url?: string | null },
  workerId: string,
): Promise<void> {
```

**b)** Update `fetchPosts` to accept and pass `websiteUrl`:

```typescript
async function fetchPosts(
  platform: string,
  reportRow: { primary_competitor_name: string | null; category: string; website_url?: string | null }
): Promise<NormalizedPost[]> {
  const scraper = getScraper(platform as any);
  const posts = await scraper.fetch({
    competitor: reportRow.primary_competitor_name ?? "",
    category: reportRow.category,
    keywords: [],
    websiteUrl: reportRow.website_url ?? undefined,
  });
  return posts;
}
```

**c)** In `pollSourceJobs` in `index.ts`, update the report select to include `website_url`:

```typescript
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, job.report_id))
        .limit(1);
```

(The `reports` table already includes `website_url` after the schema change in Task 6 — Drizzle's `select()` with no columns listed returns all columns, so this works without any changes.)

- [ ] **Step 4: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/report.ts packages/api/src/services/reports.service.ts packages/worker/src/pg-runner/source-worker.ts
git commit -m "feat: thread website_url from report creation through to scraper.fetch()"
```

---

## Task 11: Web UI — optional website URL input

**Files:**
- Modify: `packages/web/src/components/report/competitor-form.schema.ts`
- Modify: `packages/web/src/components/report/competitor-form.tsx`
- Modify: `packages/web/src/api/reports.ts`

- [ ] **Step 1: Add website_url to form schema**

Edit `packages/web/src/components/report/competitor-form.schema.ts`:

```typescript
import { z } from "zod";
import { reportGoalSchema } from "@rivaleye/shared";

export const competitorFormSchema = z.object({
  competitor: z.string().min(1, "Competitor name is required"),
  category: z.string().min(1, "Category is required"),
  audience: z.string().optional(),
  goal: reportGoalSchema,
  website_url: z.string().url("Must be a valid URL (e.g. https://linear.app)").optional().or(z.literal("")),
});

export type CompetitorFormValues = z.infer<typeof competitorFormSchema>;
```

- [ ] **Step 2: Add URL input to competitor-form.tsx**

Read `packages/web/src/components/report/competitor-form.tsx` fully, then add a `FormField` for `website_url` after the `audience` field and before the `goal` field, and update `onSubmit` to include `website_url`:

The `onSubmit` function should become:
```typescript
  async function onSubmit(values: CompetitorFormValues) {
    const result = await mutateAsync({
      category: values.category,
      competitors: [values.competitor],
      target_audience: values.audience ?? values.category,
      founder_goal: values.goal,
      website_url: values.website_url || undefined,
    });
```

The new `FormField` for `website_url` (place after the audience field block):
```tsx
          <FormField
            control={form.control}
            name="website_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Competitor website URL{" "}
                  <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://linear.app"
                    type="url"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
```

- [ ] **Step 3: Add website_url to CreateReportPayload in reports.ts**

Edit `packages/web/src/api/reports.ts` — update `CreateReportPayload`:

```typescript
export type CreateReportPayload = {
  category: string;
  competitors: string[];
  target_audience: string;
  founder_goal: string;
  website_url?: string;
};
```

- [ ] **Step 4: Run type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules" | head -20
```

Expected: 0 errors.

- [ ] **Step 5: Run the web dev server and verify the form shows the new field**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm --filter @rivaleye/web dev &
```

Open `http://localhost:5173` in browser. Navigate to the new report form. Verify:
- "Competitor website URL (optional)" input appears
- Leaving it blank submits without `website_url` in payload
- Entering an invalid URL shows validation error "Must be a valid URL"
- Entering a valid URL (`https://linear.app`) passes validation

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/report/competitor-form.schema.ts packages/web/src/components/report/competitor-form.tsx packages/web/src/api/reports.ts
git commit -m "feat(web): add optional website_url input to competitor form"
```

---

## Task 12: Final type-check and push

- [ ] **Step 1: Full workspace type-check**

```bash
cd /Users/apple/Desktop/rivaleye-v3 && pnpm type-check 2>&1 | grep -v "node_modules"
```

Expected: 0 errors across all 5 packages.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

Expected: pushed successfully.

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Port Python url_utils.py | Task 3 |
| Port Python page_selector.py | Task 3 |
| Playwright crawler (port main.py) | Task 4 |
| NormalizedPost per page | Task 4 (normalize.ts) |
| `"website"` added to PlatformId | Task 1 |
| `ScrapeQuery.websiteUrl` | Task 1 |
| `platformIdSchema` updated | Task 1 |
| WebsiteScraper registered in getScraper | Task 5 |
| ENABLED_PLATFORMS includes "website" | Task 5 |
| Stage A extract prompt for website | Task 7 |
| Stage B summarize prompt for website | Task 8 |
| Wired into stage-a-extract pickBuilder | Task 9 |
| Wired into stage-b-summarize pickBuilder | Task 9 |
| website_url DB column + migration | Task 6 |
| createReportInputSchema has website_url | Task 10 |
| API persists website_url | Task 10 |
| Worker threads websiteUrl to scraper | Task 10 |
| Web UI has optional URL input | Task 11 |

**No placeholders found.**

**Type consistency:**
- `WebsiteScraper` uses `"website" as const` for `platform` — matches `PlatformId`
- `buildWebsiteExtract` returns `{ system, user, schema: platformExtractSchema }` — matches `Builder` type in stage-a-extract
- `buildWebsiteSummarize` returns `{ system, user, schema: platformBriefSchema }` — matches `SummarizeBuilder` type
- `CrawledPage` is the raw type from `client.ts`, stored as `raw: page` in NormalizedPost — consistent
- `selectTopUrls` in Task 3 matches call signature in `crawlWebsite` in Task 4
