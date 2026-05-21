import { ScraperError } from "../types";

const BASE = "https://dev.to/api";

export interface DevToUser {
  name: string;
  username: string;
  twitter_username: string | null;
  github_username: string | null;
  website_url: string | null;
  profile_image: string;
}

export interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  slug: string;
  tag_list: string[] | string;
  tags?: string[];
  comments_count: number;
  public_reactions_count: number;
  positive_reactions_count: number;
  published_at: string;
  user: DevToUser;
  body_html?: string;
  body_markdown?: string;
}

export interface DevToComment {
  type_of: string;
  id_code: string;
  created_at: string;
  body_html: string;
  user: DevToUser;
  children: DevToComment[];
}

export interface DevToTag {
  id: number;
  name: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "rivaleye-scraper/1.0" },
  });
  if (!res.ok) throw new ScraperError("devto", `Dev.to API HTTP ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export async function searchTags(term: string): Promise<DevToTag[]> {
  const tags = await apiGet<DevToTag[]>(`/tags?per_page=1000`);
  return tags.filter((t) => t.name.toLowerCase().includes(term.toLowerCase()));
}

export async function searchArticles(term: string, perPage: number): Promise<DevToArticle[]> {
  // Fetch top articles from the past year and filter by competitor name in title/description/tags
  return apiGet<DevToArticle[]>(
    `/articles?per_page=1000&top=365`,
  ).then((articles) => {
    const q = term.toLowerCase();
    return articles.filter((a) => {
      const tags = Array.isArray(a.tag_list) ? a.tag_list : (a.tags ?? []);
      return (
        a.title.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        tags.some((t) => t.toLowerCase().includes(q))
      );
    }).slice(0, perPage);
  }).catch(() => []);
}

export async function getArticlesByTag(tag: string, perPage: number): Promise<DevToArticle[]> {
  return apiGet<DevToArticle[]>(
    `/articles?tag=${encodeURIComponent(tag)}&per_page=${perPage}&state=fresh`,
  );
}

export async function getTopArticlesByTag(tag: string, perPage: number): Promise<DevToArticle[]> {
  return apiGet<DevToArticle[]>(
    `/articles?tag=${encodeURIComponent(tag)}&per_page=${perPage}&top=30`,
  );
}

export async function getComments(articleId: number): Promise<DevToComment[]> {
  return apiGet<DevToComment[]>(`/comments?a_id=${articleId}`);
}
