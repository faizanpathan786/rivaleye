/**
 * Product Hunt Scraper
 * Uses Product Hunt GraphQL API v2
 * Requires: PRODUCT_HUNT_TOKEN env var
 *
 * Usage: ts-node producthunt.ts "<topic>" [postLimit]
 * Example: ts-node producthunt.ts "notion" 20
 */

const SEARCH_TERM = process.argv[2] || "notion";
const POST_LIMIT = parseInt(process.argv[3] || "20", 10);
const API_URL = "https://api.producthunt.com/v2/api/graphql";
const TOKEN = process.env.PRODUCT_HUNT_TOKEN;

if (!TOKEN) {
  console.error("ERROR: Set PRODUCT_HUNT_TOKEN env var.");
  process.exit(1);
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join(", "));
  return json.data as T;
}

// Step 1: find topics matching the search term
const TOPICS_QUERY = `
  query Topics($query: String!) {
    topics(query: $query, first: 5) {
      edges { node { id name slug description followersCount postsCount } }
    }
  }
`;

// Step 2: get posts for a topic (no comments, keeps complexity low)
const POSTS_QUERY = `
  query Posts($topic: String!, $first: Int!) {
    posts(topic: $topic, first: $first, order: VOTES) {
      edges {
        node {
          id name slug tagline description url website
          votesCount commentsCount reviewsCount reviewsRating
          createdAt featuredAt dailyRank weeklyRank monthlyRank
          thumbnail { url }
          topics(first: 5) { edges { node { name slug } } }
          makers { id name username headline }
          user { id name username }
        }
      }
    }
  }
`;

// Step 3: get comments for a single post
const COMMENTS_QUERY = `
  query Comments($postId: ID!) {
    post(id: $postId) {
      comments(first: 20, order: VOTES_COUNT) {
        edges {
          node {
            id body createdAt votesCount url
            user { id name username }
          }
        }
      }
    }
  }
`;

async function getComments(postId: string): Promise<unknown[]> {
  try {
    const data = await gql<{ post: { comments: { edges: { node: unknown }[] } } }>(
      COMMENTS_QUERY, { postId }
    );
    return data.post.comments.edges.map((e) => e.node);
  } catch {
    return [];
  }
}

async function main() {
  console.error(`Searching Product Hunt for: "${SEARCH_TERM}"`);

  // Find matching topics
  const topicsData = await gql<{ topics: { edges: { node: Record<string, unknown> }[] } }>(
    TOPICS_QUERY, { query: SEARCH_TERM }
  );
  const topics = topicsData.topics.edges.map((e) => e.node);
  console.error(`Found ${topics.length} matching topics`);

  if (topics.length === 0) {
    console.error("No matching topics found.");
    console.log(JSON.stringify({ searchTerm: SEARCH_TERM, fetchedAt: new Date().toISOString(), matchedTopics: [], posts: [] }, null, 2));
    return;
  }

  const topTopic = topics[0] as { slug: string; name: string };
  console.error(`Fetching posts for topic: "${topTopic.name}"`);

  const postsData = await gql<{ posts: { edges: { node: Record<string, unknown> }[] } }>(
    POSTS_QUERY, { topic: topTopic.slug, first: POST_LIMIT }
  );
  const posts = postsData.posts.edges.map((e) => e.node);
  console.error(`Fetched ${posts.length} posts. Fetching comments for top 10...`);

  // Fetch comments for top 10 posts
  const enriched = await Promise.all(
    posts.map(async (post, i) => {
      if (i >= 10) return { ...post, comments: [] };
      const comments = await getComments(post.id as string);
      return { ...post, comments };
    })
  );

  const output = {
    searchTerm: SEARCH_TERM,
    fetchedAt: new Date().toISOString(),
    matchedTopics: topics,
    totalPostsFetched: enriched.length,
    posts: enriched,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
