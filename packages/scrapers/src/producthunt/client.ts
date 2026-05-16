import { ScraperError } from "../types";

const API_URL = "https://api.producthunt.com/v2/api/graphql";

export interface RawPHPost {
  id: string;
  name: string;
  tagline: string;
  description: string | null;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  user: { id: string; name: string; username: string };
  comments?: RawPHComment[];
}

export interface RawPHComment {
  id: string;
  body: string;
  createdAt: string;
  votesCount: number;
  url: string | null;
  user: { id: string; name: string; username: string };
}

const TOPICS_QUERY = `
  query Topics($query: String!) {
    topics(query: $query, first: 5) {
      edges { node { id name slug } }
    }
  }
`;

const POSTS_QUERY = `
  query Posts($topic: String!, $first: Int!) {
    posts(topic: $topic, first: $first, order: VOTES) {
      edges {
        node {
          id name tagline description url
          votesCount commentsCount
          createdAt
          user { id name username }
        }
      }
    }
  }
`;

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

async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok)
    throw new ScraperError("producthunt", `GraphQL HTTP ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length)
    throw new ScraperError(
      "producthunt",
      json.errors.map((e) => e.message).join(", "),
    );
  return json.data as T;
}

export async function findTopicSlug(
  token: string,
  query: string,
): Promise<string | null> {
  const data = await gql<{ topics: { edges: { node: { slug: string } }[] } }>(
    token,
    TOPICS_QUERY,
    { query },
  );
  return data.topics.edges[0]?.node.slug ?? null;
}

export async function fetchPosts(
  token: string,
  topicSlug: string,
  first: number,
): Promise<RawPHPost[]> {
  const data = await gql<{ posts: { edges: { node: RawPHPost }[] } }>(
    token,
    POSTS_QUERY,
    { topic: topicSlug, first },
  );
  return data.posts.edges.map((e) => e.node);
}

export async function fetchComments(
  token: string,
  postId: string,
): Promise<RawPHComment[]> {
  try {
    const data = await gql<{
      post: { comments: { edges: { node: RawPHComment }[] } };
    }>(token, COMMENTS_QUERY, { postId });
    return data.post.comments.edges.map((e) => e.node);
  } catch {
    return [];
  }
}
