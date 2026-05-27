# Reddit Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full end-to-end Reddit flow — user enters competitor name → worker scrapes Reddit + clusters pain via Claude → web shows pain cluster cards.

**Architecture:** API validates input, inserts report row, and enqueues `scrape-platform` jobs via pg-boss. Worker picks up jobs, runs `RedditScraper`, bulk-inserts `NormalizedPost[]` to a new `mentions` table, then enqueues `generate-report`. The generate-report handler loads all mentions and calls Claude twice (search term context, then pain clustering) to produce `PainReportOutput`, which it writes back to `reports.output`.

**Tech Stack:** Bun, Elysia, Drizzle ORM + Postgres (Supabase), pg-boss, OpenRouter API via openai SDK (deepseek/deepseek-r1-0528:free), axios (Reddit HTTP), Vite + React + TanStack Query + shadcn/ui

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `packages/scrapers/src/reddit/auth.ts` | Reddit OAuth2 client credentials + token cache |
| `packages/scrapers/src/reddit/rate-limiter.ts` | Token bucket, 55 req/min |
| `packages/scrapers/src/reddit/client.ts` | Axios wrapper, retry, 429 handling |
| `packages/scrapers/src/reddit/search.ts` | `searchPosts()` call |
| `packages/scrapers/src/reddit/comments.ts` | `getComments()` call |
| `packages/scrapers/src/reddit/normalize.ts` | raw Reddit → `NormalizedPost` |
| `packages/api/src/db/schema/mentions.ts` | Drizzle `mentions` table |
| `packages/worker/src/db.ts` | Worker-side Drizzle client (same schema, own postgres connection) |
| `packages/worker/src/llm.ts` | Thin Anthropic SDK wrapper |

### Modified files
| Path | Change |
|------|--------|
| `packages/scrapers/src/reddit/index.ts` | Replace stub with full `RedditScraper` impl |
| `packages/scrapers/package.json` | Add `axios` dependency |
| `packages/worker/package.json` | Add `@anthropic-ai/sdk` dependency |
| `packages/api/src/db/schema/index.ts` | Re-export `mentions` |
| `packages/worker/src/jobs/scrape-platform.ts` | Persist posts + enqueue generate-report |
| `packages/worker/src/jobs/generate-report.ts` | Full LLM cluster + report update |
| `packages/api/src/controllers/reports/handlers/list-reports.ts` | Real DB query |
| `packages/api/src/controllers/reports/handlers/get-report.ts` | Real DB query |
| `packages/web/src/app.tsx` | Add router + providers |
| `packages/web/src/lib/api.ts` | Create API client |
| `packages/web/src/hooks/queries/use-report.ts` | Create TanStack Query hooks |
| `packages/web/src/routes/home.tsx` | Create CompetitorForm route |
| `packages/web/src/routes/report.tsx` | Create ReportPage route with polling |
| `packages/web/src/components/pain-cluster-card.tsx` | Create PainClusterCard component |

---

## Task 1: Add `mentions` DB schema + migration

**Files:**
- Create: `packages/api/src/db/schema/mentions.ts`
- Modify: `packages/api/src/db/schema/index.ts`

- [ ] **Step 1: Create the mentions schema file**

```typescript
// packages/api/src/db/schema/mentions.ts
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    author: text("author"),
    title: text("title"),
    body: text("body").notNull(),
    score: integer("score"),
    numComments: integer("num_comments"),
    postedAt: timestamp("posted_at").notNull(),
    raw: jsonb("raw").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("mentions_report_platform_external_uniq").on(
      t.reportId,
      t.platform,
      t.externalId,
    ),
    index("mentions_report_id_idx").on(t.reportId),
  ],
);

export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;
```

- [ ] **Step 2: Re-export from schema index**

In `packages/api/src/db/schema/index.ts`, add the export:

```typescript
export * from "./users";
export * from "./reports";
export * from "./competitors";
export * from "./mentions";
```

- [ ] **Step 3: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: new migration file in `packages/api/drizzle/`. No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/db/schema/mentions.ts packages/api/src/db/schema/index.ts packages/api/drizzle/
git commit -m "feat: add mentions table schema and migration"
```

---

## Task 2: Worker DB client

**Files:**
- Create: `packages/worker/src/db.ts`

The worker needs its own Drizzle client. It imports schema from `@rivaleye/api`'s schema folder (same Postgres, different process). Per worker CLAUDE.md, schema lives in `packages/api/src/db/schema/` and worker imports it.

- [ ] **Step 1: Create worker DB client**

```typescript
// packages/worker/src/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../api/src/db/schema/index.js";

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) throw new Error("CONNECTION_STRING is required");

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });
```

- [ ] **Step 2: Verify type-check passes**

```bash
pnpm --filter @rivaleye/worker type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/db.ts
git commit -m "feat: add worker drizzle client"
```

---

## Task 3: Reddit scraper — auth + rate-limiter + client

**Files:**
- Create: `packages/scrapers/src/reddit/auth.ts`
- Create: `packages/scrapers/src/reddit/rate-limiter.ts`
- Create: `packages/scrapers/src/reddit/client.ts`
- Modify: `packages/scrapers/package.json`

- [ ] **Step 1: Add axios to scrapers package**

Edit `packages/scrapers/package.json` — add to `"dependencies"`:

```json
{
  "name": "@rivaleye/scrapers",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@rivaleye/shared": "workspace:*",
    "axios": "^1.7.9"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "@types/bun": "^1.1.14"
  }
}
```

Then run:

```bash
pnpm install
```

- [ ] **Step 2: Create auth.ts**

```typescript
// packages/scrapers/src/reddit/auth.ts
import axios from "axios";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;
let inflight: Promise<string> | null = null;

export interface RedditAuthConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export async function getAccessToken(config: RedditAuthConfig): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt - 60_000 > now) {
    return cache.accessToken;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const resp = await axios.post<{ access_token: string; expires_in: number }>(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        auth: { username: config.clientId, password: config.clientSecret },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": config.userAgent,
        },
      },
    );
    cache = {
      accessToken: resp.data.access_token,
      expiresAt: Date.now() + resp.data.expires_in * 1000,
    };
    return cache.accessToken;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
```

- [ ] **Step 3: Create rate-limiter.ts**

```typescript
// packages/scrapers/src/reddit/rate-limiter.ts
interface QueueEntry {
  resolve: () => void;
}

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private queue: QueueEntry[] = [];
  private refillTimer: ReturnType<typeof setInterval> | null = null;

  constructor(tokensPerMinute = 55) {
    this.maxTokens = tokensPerMinute;
    this.tokens = tokensPerMinute;
    this.refillIntervalMs = 60_000 / tokensPerMinute;
  }

  private startRefill() {
    if (this.refillTimer) return;
    this.refillTimer = setInterval(() => {
      if (this.tokens < this.maxTokens) {
        this.tokens++;
        this.drain();
      }
    }, this.refillIntervalMs);
  }

  private drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      this.queue.shift()!.resolve();
    }
  }

  async acquire(): Promise<void> {
    this.startRefill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
    });
  }

  destroy() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }
}
```

- [ ] **Step 4: Create client.ts**

```typescript
// packages/scrapers/src/reddit/client.ts
import axios, { type AxiosInstance } from "axios";
import { type RedditAuthConfig, getAccessToken } from "./auth";
import { RateLimiter } from "./rate-limiter";
import { ScraperError } from "../types";

const limiter = new RateLimiter(55);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function redditGet<T>(
  path: string,
  params: Record<string, string | number>,
  config: RedditAuthConfig,
): Promise<T> {
  const token = await getAccessToken(config);
  await limiter.acquire();

  const instance: AxiosInstance = axios.create({
    baseURL: "https://oauth.reddit.com",
    timeout: 15_000,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": config.userAgent,
    },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await instance.get<T>(path, { params });
      return resp.data;
    } catch (err) {
      lastError = err;
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          const retryAfter = Number(err.response.headers["retry-after"] ?? 60);
          await sleep(retryAfter * 1000);
          await limiter.acquire();
          continue;
        }
        if (err.response && err.response.status < 500) break;
      }
      if (attempt < 2) await sleep(1000 * 2 ** attempt);
    }
  }
  throw new ScraperError("reddit", `GET ${path} failed`, lastError);
}
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter @rivaleye/scrapers type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/scrapers/src/reddit/auth.ts packages/scrapers/src/reddit/rate-limiter.ts packages/scrapers/src/reddit/client.ts packages/scrapers/package.json pnpm-lock.yaml
git commit -m "feat: reddit scraper auth, rate-limiter, and http client"
```

---

## Task 4: Reddit scraper — search + comments + normalize

**Files:**
- Create: `packages/scrapers/src/reddit/search.ts`
- Create: `packages/scrapers/src/reddit/comments.ts`
- Create: `packages/scrapers/src/reddit/normalize.ts`

- [ ] **Step 1: Create search.ts**

```typescript
// packages/scrapers/src/reddit/search.ts
import { redditGet } from "./client";
import type { RedditAuthConfig } from "./auth";

export interface RawRedditPost {
  id: string;
  name: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
  url: string;
}

interface RedditListing {
  data: {
    children: Array<{ data: RawRedditPost }>;
    after: string | null;
  };
}

export async function searchPosts(
  term: string,
  config: RedditAuthConfig,
  opts: { sort?: string; time?: string; limit?: number } = {},
): Promise<RawRedditPost[]> {
  const { sort = "relevance", time = "year", limit = 50 } = opts;
  const listing = await redditGet<RedditListing>(
    "/search",
    { q: term, type: "link", sort, t: time, limit },
    config,
  );
  return listing.data.children
    .map((c) => c.data)
    .filter((p) => p.author !== "[deleted]");
}
```

- [ ] **Step 2: Create comments.ts**

```typescript
// packages/scrapers/src/reddit/comments.ts
import { redditGet } from "./client";
import type { RedditAuthConfig } from "./auth";

export interface RawRedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  permalink: string;
  created_utc: number;
}

interface CommentListing {
  data: {
    children: Array<{ kind: string; data: RawRedditComment & { replies?: CommentListing | "" } }>;
  };
}

export async function getComments(
  postId: string,
  config: RedditAuthConfig,
  maxComments = 10,
): Promise<RawRedditComment[]> {
  const [, commentsListing] = await redditGet<[unknown, CommentListing]>(
    `/comments/${postId}`,
    { depth: 2, limit: maxComments },
    config,
  );

  const results: RawRedditComment[] = [];
  for (const child of commentsListing.data.children) {
    if (child.kind !== "t1") continue;
    const c = child.data;
    if (!c.body || c.body === "[deleted]" || c.body === "[removed]") continue;
    if (c.author === "AutoModerator") continue;
    results.push(c);
    if (results.length >= maxComments) break;
  }
  return results;
}
```

- [ ] **Step 3: Create normalize.ts**

```typescript
// packages/scrapers/src/reddit/normalize.ts
import type { NormalizedPost } from "../types";
import type { RawRedditPost } from "./search";
import type { RawRedditComment } from "./comments";

export function normalizePost(
  post: RawRedditPost,
  comments: RawRedditComment[],
): NormalizedPost {
  const commentText = comments
    .slice(0, 5)
    .map((c) => c.body)
    .join("\n\n---\n\n");

  const body = [post.selftext, commentText].filter(Boolean).join("\n\n---\n\n");

  return {
    platform: "reddit",
    externalId: post.id,
    url: `https://www.reddit.com${post.permalink}`,
    author: post.author === "[deleted]" ? null : post.author,
    title: post.title || null,
    body: body || post.title,
    score: post.score,
    numComments: post.num_comments,
    createdAt: new Date(post.created_utc * 1000),
    raw: { post, comments },
  };
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @rivaleye/scrapers type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/scrapers/src/reddit/search.ts packages/scrapers/src/reddit/comments.ts packages/scrapers/src/reddit/normalize.ts
git commit -m "feat: reddit search, comments, and normalize helpers"
```

---

## Task 5: Reddit scraper — `RedditScraper` implementation

**Files:**
- Modify: `packages/scrapers/src/reddit/index.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// packages/scrapers/src/reddit/index.ts
import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";
import { getAccessToken, type RedditAuthConfig } from "./auth";
import { searchPosts } from "./search";
import { getComments } from "./comments";
import { normalizePost } from "./normalize";

const SEARCH_TEMPLATES = [
  (name: string) => `${name} complaints`,
  (name: string) => `${name} alternatives`,
  (name: string) => `${name} vs`,
  (name: string) => `${name} pricing`,
  (name: string) => `${name} switching`,
  (name: string) => `${name} review`,
];

const MAX_POSTS_PER_TERM = 50;
const MAX_COMMENTS_PER_POST = 10;
const MAX_TOTAL_POSTS = 500;

export class RedditScraper implements Scraper {
  readonly platform = "reddit" as const;

  private readonly config: RedditAuthConfig;

  constructor() {
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const userAgent = process.env.REDDIT_USER_AGENT;
    if (!clientId || !clientSecret || !userAgent) {
      throw new ScraperError(
        "reddit",
        "REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT are required",
      );
    }
    this.config = { clientId, clientSecret, userAgent };
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    // Validate token is accessible before starting
    await getAccessToken(this.config).catch((err) => {
      throw new ScraperError("reddit", "OAuth token fetch failed", err);
    });

    const terms = SEARCH_TEMPLATES.map((fn) => fn(query.competitor));
    const seenIds = new Set<string>();
    const posts: NormalizedPost[] = [];

    for (const term of terms) {
      if (posts.length >= MAX_TOTAL_POSTS) break;
      let raw;
      try {
        raw = await searchPosts(term, this.config, {
          limit: Math.min(MAX_POSTS_PER_TERM, MAX_TOTAL_POSTS - posts.length),
        });
      } catch (err) {
        // Skip this term on transient error; don't abort the whole run
        continue;
      }

      for (const rawPost of raw) {
        if (seenIds.has(rawPost.id)) continue;
        seenIds.add(rawPost.id);

        let comments = [];
        try {
          comments = await getComments(rawPost.id, this.config, MAX_COMMENTS_PER_POST);
        } catch {
          // Comments optional — post still valuable without them
        }

        posts.push(normalizePost(rawPost, comments));
        if (posts.length >= MAX_TOTAL_POSTS) break;
      }
    }

    return posts;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/scrapers type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/scrapers/src/reddit/index.ts
git commit -m "feat: implement RedditScraper with search + comments + normalize"
```

---

## Task 6: LLM client in worker

**Files:**
- Create: `packages/worker/src/llm.ts`
- Modify: `packages/worker/package.json`
- Modify: `.env.example` (root)

Uses OpenRouter with DeepSeek free model via OpenAI-compatible SDK. Env var: `OPENROUTER_API_KEY`.

- [ ] **Step 1: Add openai SDK to worker package**

Edit `packages/worker/package.json` — add to `"dependencies"`:

```json
{
  "name": "@rivaleye/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --target=bun --outdir=dist",
    "type-check": "tsc --noEmit",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@rivaleye/shared": "workspace:*",
    "@rivaleye/scrapers": "workspace:*",
    "openai": "^4.77.0",
    "pg-boss": "^10.1.5",
    "drizzle-orm": "^0.36.4",
    "postgres": "^3.4.5",
    "pino": "^9.5.0"
  },
  "devDependencies": {
    "@types/bun": "^1.1.14",
    "typescript": "^5.7.2"
  }
}
```

Then run:

```bash
pnpm install
```

- [ ] **Step 2: Create llm.ts**

```typescript
// packages/worker/src/llm.ts
import OpenAI from "openai";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");

const client = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

export async function callLlm(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: "deepseek/deepseek-r1-0528:free",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("empty LLM response");
  return content;
}
```

- [ ] **Step 3: Add OPENROUTER_API_KEY to .env.example**

In root `.env.example`, add:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

- [ ] **Step 4: Type-check**

```bash
pnpm --filter @rivaleye/worker type-check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/worker/src/llm.ts packages/worker/package.json .env.example pnpm-lock.yaml
git commit -m "feat: add OpenRouter/DeepSeek LLM client to worker"
```

---

## Task 7: Worker `scrape-platform` job — persist mentions + enqueue generate-report

**Files:**
- Modify: `packages/worker/src/jobs/scrape-platform.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// packages/worker/src/jobs/scrape-platform.ts
import { getScraper } from "@rivaleye/scrapers";
import type { ScrapePlatformJob } from "../queue";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { boss, QUEUES } from "../queue";
import { eq } from "drizzle-orm";

const CHUNK_SIZE = 500;

export async function handleScrapePlatform(data: ScrapePlatformJob) {
  const scraper = getScraper(data.platform);
  const posts = await scraper.fetch({
    competitor: data.competitor,
    category: data.category,
    keywords: data.keywords,
  });

  // Bulk-insert in chunks, skip conflicts (idempotent)
  for (let i = 0; i < posts.length; i += CHUNK_SIZE) {
    const chunk = posts.slice(i, i + CHUNK_SIZE);
    await db
      .insert(mentions)
      .values(
        chunk.map((p) => ({
          reportId: data.reportId,
          platform: p.platform,
          externalId: p.externalId,
          url: p.url,
          author: p.author,
          title: p.title,
          body: p.body,
          score: p.score,
          numComments: p.numComments,
          postedAt: p.createdAt,
          raw: p.raw as Record<string, unknown>,
        })),
      )
      .onConflictDoNothing();
  }

  // Transition report to "running" if still queued
  await db
    .update(reports)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(reports.id, data.reportId));

  // Fan-in: for MVP (Reddit only), enqueue generate-report immediately
  await boss.send(QUEUES.generateReport, { reportId: data.reportId });

  return { count: posts.length };
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/worker type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/jobs/scrape-platform.ts
git commit -m "feat: scrape-platform job persists mentions and enqueues generate-report"
```

---

## Task 8: Worker `generate-report` job — LLM cluster + report update

**Files:**
- Modify: `packages/worker/src/jobs/generate-report.ts`

- [ ] **Step 1: Replace stub with full implementation**

```typescript
// packages/worker/src/jobs/generate-report.ts
import type { GenerateReportJob } from "../queue";
import { db } from "../db";
import { mentions } from "../../../api/src/db/schema/mentions.js";
import { reports } from "../../../api/src/db/schema/reports.js";
import { eq } from "drizzle-orm";
import { callLlm } from "../llm";
import type { PainReportOutput } from "@rivaleye/shared";

const CLUSTER_SYSTEM_PROMPT = `You are a competitive intelligence analyst. Given Reddit posts and comments mentioning a competitor product, identify distinct pain point clusters.

For each cluster return:
- title: 3-7 word theme name
- description: 1-2 sentences explaining the pain
- evidence: array of 2-5 direct quotes from the posts

Group by user pain, not by feature. Prioritize complaints with multiple independent mentions.

Return valid JSON only with this exact shape:
{
  "summary": "2-3 sentence executive summary of top pain themes",
  "painClusters": [{ "title": "string", "description": "string", "evidence": ["string"] }],
  "featureGaps": ["string"],
  "pricingPain": "string",
  "switchingSignals": ["string"],
  "voiceOfCustomer": ["string"],
  "competitorWeaknesses": ["string"],
  "productOpportunities": ["string"],
  "positioningAngles": ["string"],
  "recommendedActions": ["string"]
}`;

const MAX_BODY_CHARS = 800;
const MAX_MENTIONS_IN_PROMPT = 150;

function buildClusterPrompt(
  competitor: string,
  category: string,
  searchTerms: string[],
  postBodies: string[],
): string {
  const truncated = postBodies.slice(0, MAX_MENTIONS_IN_PROMPT);
  const postsText = truncated.join("\n---\n");
  return `Competitor: ${competitor}
Category: ${category}
Search angles used: ${searchTerms.join(", ")}

Posts and comments:
${postsText}`;
}

function parseJsonSafe(raw: string): PainReportOutput | null {
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  try {
    return JSON.parse(cleaned) as PainReportOutput;
  } catch {
    return null;
  }
}

const DEFAULT_OUTPUT: PainReportOutput = {
  summary: "Could not parse LLM response. Check raw mentions for insights.",
  painClusters: [],
  featureGaps: [],
  pricingPain: "",
  switchingSignals: [],
  voiceOfCustomer: [],
  competitorWeaknesses: [],
  productOpportunities: [],
  positioningAngles: [],
  recommendedActions: [],
};

export async function handleGenerateReport(data: GenerateReportJob) {
  try {
    // Load report metadata
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, data.reportId))
      .limit(1);

    if (!report) throw new Error(`Report ${data.reportId} not found`);

    const competitor = (report.competitors as string[])[0] ?? "unknown";
    const category = report.category;

    // Load all mentions for this report
    const rows = await db
      .select()
      .from(mentions)
      .where(eq(mentions.reportId, data.reportId));

    const postBodies = rows.map((m) =>
      `Title: ${m.title ?? ""}\n${m.body}`.slice(0, MAX_BODY_CHARS),
    );

    // LLM call 1: generate search term context (cheap, adds framing for clustering)
    const searchTermsRaw = await callLlm(
      "You are a market researcher. Return a JSON array of 8-10 Reddit search queries that would find complaints and switching signals for a given product. Return only a JSON array of strings, no other text.",
      `Product: ${competitor}\nCategory: ${category}`,
    ).catch(() => "[]");
    const searchTerms: string[] = JSON.parse(
      searchTermsRaw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim(),
    ).slice(0, 10);

    // LLM call 2: cluster pain points
    const clusterRaw = await callLlm(
      CLUSTER_SYSTEM_PROMPT,
      buildClusterPrompt(competitor, category, searchTerms, postBodies),
    );

    const output = parseJsonSafe(clusterRaw) ?? DEFAULT_OUTPUT;

    await db
      .update(reports)
      .set({
        output: output as Record<string, unknown>,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(reports.id, data.reportId));

    return { reportId: data.reportId, status: "completed" as const };
  } catch (err) {
    await db
      .update(reports)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(reports.id, data.reportId));
    throw err;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/worker type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/worker/src/jobs/generate-report.ts
git commit -m "feat: generate-report job clusters pain points via Claude"
```

---

## Task 9: API — real DB queries for list-reports and get-report

**Files:**
- Modify: `packages/api/src/controllers/reports/handlers/list-reports.ts`
- Modify: `packages/api/src/controllers/reports/handlers/get-report.ts`

- [ ] **Step 1: Implement list-reports**

```typescript
// packages/api/src/controllers/reports/handlers/list-reports.ts
import { Elysia } from "elysia";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { desc } from "drizzle-orm";

export const listReports = new Elysia().get("/", async () => {
  // TODO: filter by ownerId once auth is wired — for MVP return all
  const rows = await db
    .select()
    .from(reports)
    .orderBy(desc(reports.createdAt));

  return { reports: rows };
});
```

- [ ] **Step 2: Implement get-report**

```typescript
// packages/api/src/controllers/reports/handlers/get-report.ts
import { Elysia, t } from "elysia";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";

export const getReport = new Elysia().get(
  "/:id",
  async ({ params, error }) => {
    const [row] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, params.id))
      .limit(1);

    if (!row) return error(404, { message: "report not found" });
    return row;
  },
  { params: t.Object({ id: t.String() }) },
);
```

- [ ] **Step 3: Type-check API**

```bash
pnpm --filter @rivaleye/api type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/controllers/reports/handlers/list-reports.ts packages/api/src/controllers/reports/handlers/get-report.ts
git commit -m "feat: list-reports and get-report handlers with real DB queries"
```

---

## Task 10: Web — API client + TanStack Query hooks

**Files:**
- Create: `packages/web/src/lib/api.ts`
- Create: `packages/web/src/hooks/queries/use-report.ts`

- [ ] **Step 1: Create API client**

```typescript
// packages/web/src/lib/api.ts
import type { PainReportOutput, ReportStatus } from "@rivaleye/shared";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:6090";

export interface ReportRow {
  id: string;
  category: string;
  competitors: string[];
  audience: string | null;
  goal: string;
  status: ReportStatus;
  output: PainReportOutput | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  category: string;
  competitors: string[];
  goal: string;
  audience?: string;
  platforms?: string[];
}

export const api = {
  reports: {
    async create(input: CreateReportInput): Promise<{ id: string; status: string }> {
      const res = await fetch(`${BASE}/v1/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`create report failed: ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },

    async get(id: string): Promise<ReportRow> {
      const res = await fetch(`${BASE}/v1/reports/${id}`);
      if (!res.ok) throw new Error(`get report failed: ${res.status}`);
      return res.json() as Promise<ReportRow>;
    },

    async list(): Promise<{ reports: ReportRow[] }> {
      const res = await fetch(`${BASE}/v1/reports`);
      if (!res.ok) throw new Error(`list reports failed: ${res.status}`);
      return res.json() as Promise<{ reports: ReportRow[] }>;
    },
  },
};
```

- [ ] **Step 2: Create query hooks directory + hook**

```bash
mkdir -p packages/web/src/hooks/queries
```

```typescript
// packages/web/src/hooks/queries/use-report.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useReport(id: string) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => api.reports.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000;
    },
  });
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => api.reports.list(),
  });
}
```

- [ ] **Step 3: Type-check web**

```bash
pnpm --filter @rivaleye/web type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/lib/api.ts packages/web/src/hooks/queries/use-report.ts
git commit -m "feat: web API client and TanStack Query hooks for reports"
```

---

## Task 11: Web — `PainClusterCard` component

**Files:**
- Create: `packages/web/src/components/pain-cluster-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// packages/web/src/components/pain-cluster-card.tsx
import type { PainCluster } from "@rivaleye/shared";

interface PainClusterCardProps {
  cluster: PainCluster;
}

export function PainClusterCard({ cluster }: PainClusterCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-base leading-snug">{cluster.title}</h3>
        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {cluster.evidence.length} quotes
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{cluster.description}</p>
      {cluster.evidence.slice(0, 3).map((quote, i) => (
        <blockquote
          key={i}
          className="border-l-2 border-muted pl-3 text-sm text-foreground/80 italic"
        >
          "{quote}"
        </blockquote>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/web type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/pain-cluster-card.tsx
git commit -m "feat: PainClusterCard component"
```

---

## Task 12: Web — Home page (CompetitorForm)

**Files:**
- Create: `packages/web/src/routes/home.tsx`

**Note on shadcn:** Web CLAUDE.md says to wrap native selects with shadcn primitives. If shadcn `Select` component is already installed (`src/components/ui/select.tsx` exists), use it instead of `<select>`. For this plan we use native selects to avoid blocking on shadcn CLI setup — replace them with `<Select>` in a follow-up if shadcn is wired up.

**Prerequisite:** `react-hook-form` and `zod` must be in `packages/web/package.json`. Check first:

```bash
grep -E "react-hook-form|zod|@hookform" packages/web/package.json
```

If missing, add them:

```bash
pnpm --filter @rivaleye/web add react-hook-form @hookform/resolvers zod
```

- [ ] **Step 1: Create home route**

```tsx
// packages/web/src/routes/home.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useState } from "react";

const schema = z.object({
  competitor: z.string().min(1, "Enter a competitor name"),
  category: z.string().min(1, "Select a category"),
  goal: z.enum([
    "validate_idea",
    "find_weaknesses",
    "improve_positioning",
    "decide_mvp_features",
    "find_user_pain",
    "compare_alternatives",
  ]),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES = [
  "productivity",
  "project management",
  "CRM",
  "analytics",
  "devtools",
  "marketing",
  "finance",
  "HR",
  "other",
];

const GOALS: Array<{ value: FormValues["goal"]; label: string }> = [
  { value: "find_user_pain", label: "Find what users hate" },
  { value: "find_weaknesses", label: "Find product weaknesses" },
  { value: "improve_positioning", label: "Improve positioning" },
  { value: "validate_idea", label: "Validate my idea" },
  { value: "decide_mvp_features", label: "Decide MVP features" },
  { value: "compare_alternatives", label: "Compare alternatives" },
];

export function HomePage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { goal: "find_user_pain" },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setApiError(null);
    try {
      const { id } = await api.reports.create({
        category: values.category,
        competitors: [values.competitor],
        goal: values.goal,
        platforms: ["reddit"],
      });
      navigate(`/reports/${id}`);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">RivalEye</h1>
          <p className="text-muted-foreground">Find what your competitor's users hate.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="competitor">
              Competitor name
            </label>
            <input
              id="competitor"
              {...register("competitor")}
              placeholder="e.g. Notion"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.competitor && (
              <p className="text-xs text-destructive">{errors.competitor.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              {...register("category")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="goal">
              Goal
            </label>
            <select
              id="goal"
              {...register("goal")}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {apiError && (
            <p className="text-sm text-destructive">{apiError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Generating..." : "Generate Report"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/web type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/home.tsx
git commit -m "feat: home page with CompetitorForm"
```

---

## Task 13: Web — Report page with polling + pain cluster grid

**Files:**
- Create: `packages/web/src/routes/report.tsx`

- [ ] **Step 1: Create report route**

```tsx
// packages/web/src/routes/report.tsx
import { useParams } from "react-router-dom";
import { useReport } from "@/hooks/queries/use-report";
import { PainClusterCard } from "@/components/pain-cluster-card";
import type { PainReportOutput } from "@rivaleye/shared";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-muted text-muted-foreground",
    running: "bg-yellow-500/20 text-yellow-500",
    completed: "bg-green-500/20 text-green-600",
    failed: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? colors.queued}`}>
      {status}
    </span>
  );
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useReport(id!);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading report...</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-destructive text-sm">Failed to load report.</p>
      </main>
    );
  }

  const output = data.output as PainReportOutput | null;

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {(data.competitors as string[]).join(", ")}
          </h1>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          {data.category} · {data.goal.replace(/_/g, " ")}
        </p>
      </div>

      {(data.status === "queued" || data.status === "running") && (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <p className="text-sm font-medium animate-pulse">
            {data.status === "queued" ? "Queued — starting shortly..." : "Scraping Reddit and clustering pain points..."}
          </p>
          <p className="text-xs text-muted-foreground">This takes 1–3 minutes. Page auto-refreshes.</p>
        </div>
      )}

      {data.status === "failed" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">Report generation failed. Try again.</p>
        </div>
      )}

      {data.status === "completed" && output && (
        <div className="space-y-6">
          {output.summary && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary</h2>
              <p className="text-sm">{output.summary}</p>
            </div>
          )}

          {output.painClusters.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Pain Clusters</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {output.painClusters.map((cluster, i) => (
                  <PainClusterCard key={i} cluster={cluster} />
                ))}
              </div>
            </section>
          )}

          {output.featureGaps.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Feature Gaps</h2>
              <ul className="space-y-1">
                {output.featureGaps.map((gap, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-foreground">·</span> {gap}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {output.positioningAngles.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Positioning Angles</h2>
              <ul className="space-y-1">
                {output.positioningAngles.map((angle, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-foreground">·</span> {angle}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/web type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/report.tsx
git commit -m "feat: report page with polling and pain cluster grid"
```

---

## Task 14: Web — Wire router + QueryClient in `app.tsx`

**Files:**
- Modify: `packages/web/src/app.tsx`

- [ ] **Step 1: Replace stub App with router + providers**

```tsx
// packages/web/src/app.tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./routes/home";
import { ReportPage } from "./routes/report";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", Component: HomePage },
  { path: "/reports/:id", Component: ReportPage },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @rivaleye/web type-check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app.tsx
git commit -m "feat: wire react-router + TanStack QueryClient in App"
```

---

## Task 15: End-to-end smoke test

This task verifies the full flow works. Requires a `.env` file with real credentials.

**Required env vars** (create `packages/api/.env` and `packages/worker/.env` — never commit):

```
CONNECTION_STRING=postgresql://...
BETTER_AUTH_SECRET=any-random-32-char-string
BETTER_AUTH_URL=http://localhost:6090
REDDIT_CLIENT_ID=your-reddit-app-id
REDDIT_CLIENT_SECRET=your-reddit-app-secret
REDDIT_USER_AGENT=rivaleye/0.1 by u/yourusername
ANTHROPIC_API_KEY=sk-ant-...
```

**`packages/web/.env`:**
```
VITE_API_URL=http://localhost:6090
```

- [ ] **Step 1: Run DB migration to confirm mentions table exists**

```bash
pnpm db:migrate
```

Expected: migration applies without error. Check Drizzle Studio (`pnpm db:studio`) for `mentions` table.

- [ ] **Step 2: Start API**

```bash
pnpm --filter @rivaleye/api dev
```

Expected: `Elysia is running at http://localhost:6090`

- [ ] **Step 3: Start worker**

```bash
pnpm --filter @rivaleye/worker dev
```

Expected: `RivalEye worker started`

- [ ] **Step 4: POST a report via curl**

```bash
curl -s -X POST http://localhost:6090/v1/reports \
  -H "Content-Type: application/json" \
  -d '{"category":"productivity","competitors":["Notion"],"goal":"find_user_pain","platforms":["reddit"]}' \
  | jq .
```

Expected: `{"id":"<uuid>","status":"queued"}`

- [ ] **Step 5: Poll the report until completed**

```bash
# Replace <id> with the UUID from step 4
watch -n 3 "curl -s http://localhost:6090/v1/reports/<id> | jq '.status'"
```

Expected: `queued` → `running` → `completed` within ~2 minutes.

- [ ] **Step 6: Inspect output**

```bash
curl -s http://localhost:6090/v1/reports/<id> | jq '.output.painClusters[0]'
```

Expected: object with `title`, `description`, `evidence` array.

- [ ] **Step 7: Start web and test in browser**

```bash
pnpm --filter @rivaleye/web dev
```

Open `http://localhost:4004`. Enter "Notion", pick category, submit. Should redirect to `/reports/<id>` and show loading → pain cluster cards.

- [ ] **Step 8: Final type-check across workspace**

```bash
pnpm type-check
```

Expected: zero errors.

---

## Self-Review Checklist

- [x] Reddit scraper (Tasks 3–5) covers OAuth, rate limiter, search, comments, normalize
- [x] `mentions` table (Task 1) with unique constraint on `(reportId, platform, externalId)`
- [x] Worker DB client (Task 2) imports schema from api package
- [x] `scrape-platform` job (Task 7) bulk-inserts + enqueues `generate-report`
- [x] `generate-report` job (Task 8) calls LLM twice + updates report + handles failure
- [x] LLM client (Task 6) uses OpenRouter/DeepSeek free model via openai SDK
- [x] API handlers (Task 9) return real DB rows
- [x] Web API client (Task 10) types match `PainReportOutput` from shared
- [x] TanStack Query hook (Task 10) polls every 3s until completed/failed
- [x] `PainClusterCard` (Task 11) renders title, quote count, up to 3 evidence quotes
- [x] Home page (Task 12) uses react-hook-form + zod — validated
- [x] Report page (Task 13) handles all 4 statuses: queued, running, completed, failed
- [x] App router (Task 14) wires two routes + QueryClient
- [x] End-to-end smoke test (Task 15) covers full user journey
