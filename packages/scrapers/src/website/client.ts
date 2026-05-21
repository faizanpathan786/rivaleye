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
