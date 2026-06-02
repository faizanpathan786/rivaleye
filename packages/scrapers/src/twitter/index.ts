import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

const BROWSERLESS_BASE = `https://${process.env.BROWSERLESS_HOST ?? "production-sfo.browserless.io"}`;

const MENTION_TWEET_LIMIT = 5;   // tweets from mention search
const PROFILE_POST_LIMIT = 10;   // posts from company profile
const REPLIES_PER_POST = 10;     // replies to collect per post

export class TwitterScraper implements Scraper {
  readonly platform = "twitter" as const;
  private readonly token: string;
  private readonly authToken: string;
  private readonly ct0: string;

  constructor() {
    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) throw new Error("BROWSERLESS_TOKEN is required for TwitterScraper");
    const authToken = process.env.TWITTER_AUTH_TOKEN;
    if (!authToken) throw new Error("TWITTER_AUTH_TOKEN cookie is required for TwitterScraper");
    const ct0 = process.env.TWITTER_CT0;
    if (!ct0) throw new Error("TWITTER_CT0 cookie is required for TwitterScraper");
    this.token = token;
    this.authToken = authToken;
    this.ct0 = ct0;
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    const competitor = query.competitor;
    const slug = competitor.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
    const searchTerm = `"${competitor}" lang:en`;
    const mentionSearchUrl = `https://x.com/search?q=${encodeURIComponent(searchTerm)}&src=typed_query&f=live`;
    const peopleSearchUrl = `https://x.com/search?q=${encodeURIComponent(competitor)}&f=user`;
    const authToken = this.authToken;
    const ct0 = this.ct0;
    const mentionLimit = query.limit ?? MENTION_TWEET_LIMIT;

    const code = /* js */ `
export default async function ({ page }) {
  // Inject auth cookies
  await page.setCookie(
    { name: 'auth_token', value: ${JSON.stringify(authToken)}, domain: '.x.com',       path: '/', httpOnly: true,  secure: true },
    { name: 'ct0',        value: ${JSON.stringify(ct0)},       domain: '.x.com',       path: '/', httpOnly: false, secure: true },
    { name: 'auth_token', value: ${JSON.stringify(authToken)}, domain: '.twitter.com', path: '/', httpOnly: true,  secure: true },
    { name: 'ct0',        value: ${JSON.stringify(ct0)},       domain: '.twitter.com', path: '/', httpOnly: false, secure: true }
  );

  const allPosts = [];

  // ── Helper: extract articles from current page ────────────────────────────
  async function scrapeTweets(page, max, type, parentId) {
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, 1400));
      await new Promise(r => setTimeout(r, 800));
    }
    return page.evaluate((max, type, parentId) => {
      const results = [];
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const list = type === 'reply' ? articles.slice(1) : articles;
      list.forEach((el) => {
        if (results.length >= max) return;
        const text = el.querySelector('[data-testid="tweetText"]')?.innerText?.trim() ?? '';
        if (!text) return;
        const timestamp = el.querySelector('time')?.getAttribute('datetime') ?? new Date().toISOString();
        const href = el.querySelector('a[href*="/status/"]')?.getAttribute('href') ?? '';
        const id = href.split('/status/')[1] ?? '';
        if (!id) return;
        const author = el.querySelector('[data-testid="User-Name"] span:first-child')?.innerText?.trim() ?? '';
        const likes = parseInt(el.querySelector('[data-testid="like"] span')?.innerText?.replace(/[^0-9]/g, '') ?? '0', 10) || 0;
        results.push({
          id,
          text,
          href: href.startsWith('/') ? 'https://x.com' + href : href,
          author,
          likes,
          timestamp,
          type,
          parentId: parentId ?? null,
        });
      });
      return results;
    }, max, type, parentId);
  }

  // ── Step 1: Find company profile via People search ────────────────────────
  let profileHandle = null;
  try {
    await page.goto(${JSON.stringify(peopleSearchUrl)}, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2500));

    profileHandle = await page.evaluate((slug) => {
      const cells = Array.from(document.querySelectorAll('[data-testid="UserCell"]'));
      for (const cell of cells) {
        const handleEl = cell.querySelector('[dir="ltr"] span');
        const handle = handleEl?.innerText?.replace('@', '').toLowerCase().trim() ?? '';
        if (handle === slug || handle.includes(slug) || slug.includes(handle)) {
          return handle;
        }
      }
      const first = document.querySelector('[data-testid="UserCell"] [dir="ltr"] span');
      return first?.innerText?.replace('@', '').toLowerCase().trim() ?? null;
    }, ${JSON.stringify(slug)});
  } catch (_) {
    // profile search failed — continue without company page
  }

  // ── Step 2: Scrape company profile posts + replies ─────────────────────────
  if (profileHandle) {
    try {
      const profileUrl = 'https://x.com/' + profileHandle;
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 }).catch(() => null);

      const profilePosts = await scrapeTweets(page, ${PROFILE_POST_LIMIT}, 'tweet', null);
      allPosts.push(...profilePosts);

      // open each company post and get replies
      for (const post of profilePosts) {
        try {
          await page.goto(post.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await new Promise(r => setTimeout(r, 1500));
          const replies = await scrapeTweets(page, ${REPLIES_PER_POST}, 'reply', post.id);
          allPosts.push(...replies);
        } catch (_) {}
      }
    } catch (_) {}
  }

  // ── Step 3: Mention search + replies ─────────────────────────────────────
  try {
    await page.goto(${JSON.stringify(mentionSearchUrl)}, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 8000 }).catch(() => null);

    const mentionTweets = await scrapeTweets(page, ${mentionLimit}, 'tweet', null);

    const seenIds = new Set(allPosts.map(p => p.id));
    const newMentions = mentionTweets.filter(t => !seenIds.has(t.id));
    allPosts.push(...newMentions);

    for (const tweet of newMentions) {
      try {
        await page.goto(tweet.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));
        const replies = await scrapeTweets(page, ${REPLIES_PER_POST}, 'reply', tweet.id);
        allPosts.push(...replies);
      } catch (_) {}
    }
  } catch (_) {}

  return { data: allPosts };
}`;

    let res: Response;
    try {
      // 60s max on this plan — 5 profile posts + 5 mention tweets × ~4s each ≈ 50s
      res = await fetch(`${BROWSERLESS_BASE}/function?token=${this.token}&timeout=60000`, {
        method: "POST",
        headers: { "Content-Type": "application/javascript" },
        body: code,
      });
    } catch (err) {
      throw new ScraperError(this.platform, "Browserless /function request failed", err);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new ScraperError(this.platform, `Browserless error ${res.status}: ${text}`);
    }

    const result = (await res.json()) as {
      data: Array<{
        id: string;
        text: string;
        href: string;
        author: string;
        likes: number;
        timestamp: string;
        type: "tweet" | "reply";
        parentId: string | null;
      }>;
    };

    if (!result.data?.length) {
      console.warn(`[twitter] 0 posts for "${competitor}"`);
      return [];
    }

    return result.data.map((p) => ({
      platform: this.platform,
      externalId: p.id,
      url: p.href,
      author: p.author || null,
      title: p.type === "reply" ? "Reply" : null,
      body: p.text,
      score: p.likes || null,
      numComments: null,
      createdAt: new Date(p.timestamp),
      raw: p,
    }));
  }
}
