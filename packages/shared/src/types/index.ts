// ─── Enums ────────────────────────────────────────────────────────────────────

export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type Category =
  | "complaint"
  | "praise"
  | "feature_request"
  | "comparison"
  | "pricing"
  | "ux"
  | "performance"
  | "support"
  | "competitor_update"
  | "other";
export type Urgency = "low" | "medium" | "high";
export type Trend = "rising" | "falling" | "stable";
export type CompetitorStatus = "active" | "paused" | "archived";
export type JobStatus = "pending" | "running" | "completed" | "failed";
export type PostType = "post" | "comment";
export type MentionSource = "reddit";

// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Competitor {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  website?: string | null;
  status: CompetitorStatus;
  createdAt: string;
  lastSyncedAt?: string | null;
}

export interface RedditSource {
  id: string;
  competitorId: string;
  subreddit: string;
  searchTerms: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Mention {
  id: string;
  competitorId: string;
  source: MentionSource;
  externalId: string;
  author: string;
  content: string;
  url: string;
  score: number;
  numComments: number;
  subreddit?: string | null;
  postType: PostType;
  postedAt: string;
  fetchedAt: string;
  classification?: Classification | null;
}

export interface Classification {
  id: string;
  mentionId: string;
  sentiment: Sentiment;
  category: Category;
  switchIntent: boolean;
  switchIntentTarget?: string | null;
  featureShipped?: string | null;
  urgency: Urgency;
  competitorMentions: string[];
  summary: string;
  confidence: number;
  classifiedAt: string;
}

export interface Cluster {
  id: string;
  competitorId: string;
  label: string;
  category: Category;
  sentiment: Sentiment;
  mentionCount: number;
  trend: Trend;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionJob {
  id: string;
  competitorId: string;
  status: JobStatus;
  mentionsFetched: number;
  mentionsClassified: number;
  error?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Paginated Response ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface CompetitorStats {
  totalMentions: number;
  classified: number;
  sentimentBreakdown: Record<Sentiment, number>;
  categoryBreakdown: Record<Category, number>;
  switchIntentCount: number;
  volumeOverTime: Array<{ date: string; count: number }>;
}

// ─── AI Classification Input/Output ──────────────────────────────────────────

export interface ClassificationInput {
  mentionId: string;
  content: string;
  author: string;
  subreddit?: string;
  score: number;
}

export interface ClassificationOutput {
  mentionId: string;
  sentiment: Sentiment;
  category: Category;
  switchIntent: boolean;
  switchIntentTarget: string | null;
  urgency: Urgency;
  competitorMentions: string[];
  summary: string;
  confidence: number;
}
