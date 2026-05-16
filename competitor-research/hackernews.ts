/**
 * Hacker News Scraper
 * Uses Algolia HN Search API + HN Firebase API (both free, no API key required)
 *
 * Usage: ts-node hackernews.ts "<search term>" [hitsPerPage]
 * Example: ts-node hackernews.ts "openai" 50
 */

const SEARCH_TERM = process.argv[2] || "openai";
const HITS_PER_PAGE = parseInt(process.argv[3] || "50", 10);

const ALGOLIA_BASE = "https://hn.algolia.com/api/v1";
const HN_FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";

interface AlgoliaHit {
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
  relevancy_score?: number;
  _tags: string[];
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS: number;
  query: string;
}

interface HNItem {
  id: number;
  type: string;
  by?: string;
  time?: number;
  text?: string;
  url?: string;
  title?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  parent?: number;
  deleted?: boolean;
  dead?: boolean;
}

interface FullStory extends HNItem {
  comments: HNItem[];
}

interface HNResult {
  searchTerm: string;
  fetchedAt: string;
  summary: {
    totalStoriesFound: number;
    totalCommentsFound: number;
    topStoryPoints: number;
    avgStoryPoints: number;
  };
  topStories: FullStory[];
  recentStories: AlgoliaHit[];
  recentComments: AlgoliaHit[];
}

async function algoliaSearch(tags: string, page = 0): Promise<AlgoliaResponse> {
  const url = `${ALGOLIA_BASE}/search?query=${encodeURIComponent(SEARCH_TERM)}&tags=${tags}&hitsPerPage=${HITS_PER_PAGE}&page=${page}`;
  const res = await fetch(url);
  return res.json() as Promise<AlgoliaResponse>;
}

async function algoliaSearchByDate(tags: string): Promise<AlgoliaResponse> {
  const url = `${ALGOLIA_BASE}/search_by_date?query=${encodeURIComponent(SEARCH_TERM)}&tags=${tags}&hitsPerPage=${HITS_PER_PAGE}`;
  const res = await fetch(url);
  return res.json() as Promise<AlgoliaResponse>;
}

async function getHNItem(id: number): Promise<HNItem | null> {
  try {
    const res = await fetch(`${HN_FIREBASE_BASE}/item/${id}.json`);
    return res.json() as Promise<HNItem>;
  } catch {
    return null;
  }
}

async function getStoryWithComments(storyId: number, maxComments = 20): Promise<FullStory> {
  const story = await getHNItem(storyId) as FullStory;
  if (!story) return { id: storyId, type: "story", comments: [] };

  const kidIds = (story.kids || []).slice(0, maxComments);
  const comments = await Promise.all(kidIds.map((id) => getHNItem(id)));
  story.comments = comments.filter((c): c is HNItem => c !== null && !c.deleted && !c.dead);
  return story;
}

async function main() {
  console.error(`Searching Hacker News for: "${SEARCH_TERM}"`);

  const [storiesByRelevance, storiesByDate, commentsByDate] = await Promise.all([
    algoliaSearch("story"),
    algoliaSearchByDate("story"),
    algoliaSearchByDate("comment"),
  ]);

  console.error(
    `Found ${storiesByRelevance.nbHits} stories (relevance), ${commentsByDate.nbHits} comments. Fetching top story threads...`
  );

  const topStoryIds = storiesByRelevance.hits
    .slice(0, 5)
    .map((h) => parseInt(h.objectID, 10));

  const topStories = await Promise.all(topStoryIds.map((id) => getStoryWithComments(id, 30)));

  const points = storiesByRelevance.hits
    .map((h) => h.points || 0)
    .filter((p) => p > 0);

  const output: HNResult = {
    searchTerm: SEARCH_TERM,
    fetchedAt: new Date().toISOString(),
    summary: {
      totalStoriesFound: storiesByRelevance.nbHits,
      totalCommentsFound: commentsByDate.nbHits,
      topStoryPoints: Math.max(...points, 0),
      avgStoryPoints: points.length > 0 ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : 0,
    },
    topStories,
    recentStories: storiesByDate.hits,
    recentComments: commentsByDate.hits,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
