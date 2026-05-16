import { ScraperError } from "../types";

const ALGOLIA_BASE = "https://hn.algolia.com/api/v1";

export interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author: string;
  points?: number;
  num_comments?: number;
  created_at: string;
  story_id?: number;
  comment_text?: string;
  story_title?: string;
  story_url?: string;
  parent_id?: number;
  _tags: string[];
}

export interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
}

export async function algoliaSearch(
  query: string,
  tags: string,
  hitsPerPage: number,
): Promise<AlgoliaResponse> {
  const url = `${ALGOLIA_BASE}/search?query=${encodeURIComponent(query)}&tags=${tags}&hitsPerPage=${hitsPerPage}`;
  const res = await fetch(url);
  if (!res.ok) throw new ScraperError("hackernews", `Algolia search HTTP ${res.status}`);
  return res.json() as Promise<AlgoliaResponse>;
}

export async function algoliaSearchByDate(
  query: string,
  tags: string,
  hitsPerPage: number,
): Promise<AlgoliaResponse> {
  const url = `${ALGOLIA_BASE}/search_by_date?query=${encodeURIComponent(query)}&tags=${tags}&hitsPerPage=${hitsPerPage}`;
  const res = await fetch(url);
  if (!res.ok) throw new ScraperError("hackernews", `Algolia search_by_date HTTP ${res.status}`);
  return res.json() as Promise<AlgoliaResponse>;
}
