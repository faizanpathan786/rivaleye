/**
 * Dev.to Scraper
 * Uses Dev.to public REST API (no API key required)
 *
 * Usage: ts-node devto.ts "<tag or keyword>" [articleLimit]
 * Example: ts-node devto.ts "notion" 20
 */

const SEARCH_TERM = process.argv[2] || "notion";
const ARTICLE_LIMIT = parseInt(process.argv[3] || "20", 10);
const BASE = "https://dev.to/api";

interface DevToUser {
  name: string;
  username: string;
  twitter_username: string | null;
  github_username: string | null;
  website_url: string | null;
  profile_image: string;
}

interface DevToOrg {
  name: string;
  username: string;
  slug: string;
  profile_image: string;
}

interface DevToArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  slug: string;
  cover_image: string | null;
  social_image: string | null;
  readable_publish_date: string;
  published_at: string;
  edited_at: string | null;
  tag_list: string[];
  tags: string;
  reading_time_minutes: number;
  comments_count: number;
  public_reactions_count: number;
  positive_reactions_count: number;
  user: DevToUser;
  organization?: DevToOrg;
  body_html?: string;
  body_markdown?: string;
}

interface DevToComment {
  type_of: string;
  id_code: string;
  created_at: string;
  body_html: string;
  user: DevToUser;
  children: DevToComment[];
}

interface DevToTag {
  id: number;
  name: string;
  bg_color_hex: string;
  text_color_hex: string;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "User-Agent": "competitor-research-script/1.0" },
  });
  if (!res.ok) throw new Error(`Dev.to API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

async function getArticlesByTag(tag: string, perPage: number, page = 1): Promise<DevToArticle[]> {
  return apiGet<DevToArticle[]>(`/articles?tag=${encodeURIComponent(tag)}&per_page=${perPage}&page=${page}&state=fresh`);
}

async function getTopArticlesByTag(tag: string, perPage: number): Promise<DevToArticle[]> {
  return apiGet<DevToArticle[]>(`/articles?tag=${encodeURIComponent(tag)}&per_page=${perPage}&top=30`);
}

async function getArticleDetail(id: number): Promise<DevToArticle> {
  return apiGet<DevToArticle>(`/articles/${id}`);
}

async function getComments(articleId: number): Promise<DevToComment[]> {
  return apiGet<DevToComment[]>(`/comments?a_id=${articleId}`);
}

async function searchTags(term: string): Promise<DevToTag[]> {
  return apiGet<DevToTag[]>(`/tags?per_page=10&page=1`).then((tags) =>
    tags.filter((t) => t.name.toLowerCase().includes(term.toLowerCase()))
  );
}

async function main() {
  console.error(`Searching Dev.to for: "${SEARCH_TERM}"`);

  // Find matching tags
  const allTags = await apiGet<DevToTag[]>(`/tags?per_page=100`);
  const matchingTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(SEARCH_TERM.toLowerCase())
  );
  console.error(`Found ${matchingTags.length} matching tags`);

  const tag = matchingTags.length > 0 ? matchingTags[0].name : SEARCH_TERM;
  console.error(`Using tag: "${tag}"`);

  // Fetch recent and top articles in parallel
  const [recentArticles, topArticles] = await Promise.all([
    getArticlesByTag(tag, ARTICLE_LIMIT).catch(() => [] as DevToArticle[]),
    getTopArticlesByTag(tag, ARTICLE_LIMIT).catch(() => [] as DevToArticle[]),
  ]);

  console.error(`Recent: ${recentArticles.length}, Top: ${topArticles.length} articles`);

  // Deduplicate by id
  const seen = new Set<number>();
  const allArticles = [...recentArticles, ...topArticles].filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Enrich top 10 with full body + comments
  console.error(`Fetching full details + comments for top 10 articles...`);
  const enriched = await Promise.all(
    allArticles.slice(0, 10).map(async (article) => {
      const [detail, comments] = await Promise.all([
        getArticleDetail(article.id).catch(() => article),
        getComments(article.id).catch(() => [] as DevToComment[]),
      ]);
      return { ...detail, comments };
    })
  );

  // Keep rest without comments
  const rest = allArticles.slice(10).map((a) => ({ ...a, comments: [] }));

  const output = {
    searchTerm: SEARCH_TERM,
    fetchedAt: new Date().toISOString(),
    matchingTags,
    tagUsed: tag,
    summary: {
      totalArticles: allArticles.length,
      totalWithComments: enriched.length,
      avgReactions: Math.round(
        allArticles.reduce((s, a) => s + a.public_reactions_count, 0) / (allArticles.length || 1)
      ),
      avgComments: Math.round(
        allArticles.reduce((s, a) => s + a.comments_count, 0) / (allArticles.length || 1)
      ),
    },
    articles: [...enriched, ...rest],
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
