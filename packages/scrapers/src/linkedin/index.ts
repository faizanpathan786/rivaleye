import type { NormalizedPost, ScrapeQuery, Scraper } from "../types";
import { ScraperError } from "../types";

const BROWSERLESS_BASE = `https://${process.env.BROWSERLESS_HOST ?? "production-sfo.browserless.io"}`;

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export class LinkedInScraper implements Scraper {
  readonly platform = "linkedin" as const;
  private readonly token: string;
  private readonly liAt: string;
  private readonly jsessionId: string;
  private readonly bcookie: string;

  constructor() {
    const token = process.env.BROWSERLESS_TOKEN;
    if (!token) throw new Error("BROWSERLESS_TOKEN is required for LinkedInScraper");
    const liAt = process.env.LINKEDIN_LI_AT;
    if (!liAt) throw new Error("LINKEDIN_LI_AT cookie is required for LinkedInScraper");
    const jsessionId = process.env.LINKEDIN_JSESSIONID;
    if (!jsessionId) throw new Error("LINKEDIN_JSESSIONID cookie is required for LinkedInScraper");
    const bcookie = process.env.LINKEDIN_BCOOKIE;
    if (!bcookie) throw new Error("LINKEDIN_BCOOKIE cookie is required for LinkedInScraper");
    this.token = token;
    this.liAt = liAt;
    this.jsessionId = jsessionId;
    this.bcookie = bcookie;
  }

  async fetch(query: ScrapeQuery): Promise<NormalizedPost[]> {
    const slug = slugify(query.competitor);
    const companyUrl = `https://www.linkedin.com/company/${slug}/posts/`;
    const limit = query.limit ?? 20;
    const liAt = this.liAt;
    const jsessionId = this.jsessionId;
    const bcookie = this.bcookie;

    const code = /* js */ `
export default async function ({ page }) {
  // Hide headless signals before any page loads
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Strip outer quotes DevTools adds to cookie values
  const jsId = ${JSON.stringify(jsessionId)}.replace(/^"|"$/g, '');
  const bc   = ${JSON.stringify(bcookie)}.replace(/^"|"$/g, '');

  // Inject all three auth cookies before navigating
  await page.setCookie(
    { name: 'li_at',      value: ${JSON.stringify(liAt)}, domain: '.linkedin.com', path: '/', httpOnly: true,  secure: true },
    { name: 'JSESSIONID', value: jsId,                    domain: '.linkedin.com', path: '/', httpOnly: false, secure: true },
    { name: 'bcookie',    value: bc,                      domain: '.linkedin.com', path: '/', httpOnly: false, secure: true }
  );

  // Land on homepage first to establish session
  await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Navigate to company posts
  await page.goto(${JSON.stringify(companyUrl)}, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await new Promise(r => setTimeout(r, 1200));
  }

  const posts = await page.evaluate((max) => {
    const results = [];
    document.querySelectorAll('.feed-shared-update-v2, .occludable-update, [data-id]').forEach((el) => {
      if (results.length >= max) return;
      const textEl =
        el.querySelector('.feed-shared-update-v2__description') ??
        el.querySelector('.attributed-text-segment-list__content') ??
        el.querySelector('.update-components-text');
      const text = textEl?.innerText?.trim() ?? '';
      if (!text) return;
      const id = el.getAttribute('data-id') ?? 'li-' + results.length;
      const href = el.querySelector('a[href*="/feed/update/"]')?.getAttribute('href') ??
                   el.querySelector('a[href*="/posts/"]')?.getAttribute('href') ?? '';
      const author = (el.querySelector('.update-components-actor__name') ??
                      el.querySelector('.feed-shared-actor__name'))?.innerText?.trim() ?? '';
      const likes = parseInt(el.querySelector('[data-test-id="social-actions__reaction-count"]')
                      ?.innerText?.replace(/,/g, '') ?? '0', 10) || 0;
      const timestamp = el.querySelector('time')?.getAttribute('datetime') ?? new Date().toISOString();
      results.push({ id, text, href, author, likes, timestamp });
    });
    return results;
  }, ${limit});

  return { data: posts };
}`;

    let res: Response;
    try {
      res = await fetch(`${BROWSERLESS_BASE}/function?token=${this.token}`, {
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

    const result = (await res.json()) as { data: Array<{ id: string; text: string; href: string; author: string; likes: number; timestamp: string }> };

    if (!result.data?.length) {
      console.warn(`[linkedin] 0 posts for "${query.competitor}"`);
      return [];
    }

    return result.data.map((p) => ({
      platform: this.platform,
      externalId: p.id,
      url: p.href.startsWith("http") ? p.href : `https://www.linkedin.com${p.href}`,
      author: p.author || null,
      title: null,
      body: p.text,
      score: p.likes || null,
      numComments: null,
      createdAt: new Date(p.timestamp),
      raw: p,
    }));
  }
}
