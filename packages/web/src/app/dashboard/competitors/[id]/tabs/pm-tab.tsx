"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Star,
  Lightbulb,
  Rocket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Sentiment = "positive" | "negative" | "neutral" | "mixed";
type Category =
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
type Trend = "rising" | "falling" | "stable";

interface Classification {
  id: string;
  mentionId: string;
  sentiment: Sentiment;
  category: Category;
  switchIntent: boolean;
  switchIntentTarget?: string | null;
  featureShipped?: string | null;
  urgency: "low" | "medium" | "high";
  competitorMentions: string[];
  summary: string;
  confidence: number;
  classifiedAt: string;
}

interface Mention {
  id: string;
  competitorId: string;
  source: "reddit";
  externalId: string;
  author: string;
  content: string;
  url: string;
  score: number;
  numComments: number;
  subreddit?: string | null;
  postType: "post" | "comment";
  postedAt: string;
  fetchedAt: string;
  classification?: Classification | null;
}

interface Cluster {
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

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PMTabProps {
  competitorId: string;
  clusters: Cluster[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SENTIMENT_BADGE: Record<Sentiment, "positive" | "negative" | "neutral" | "mixed"> = {
  positive: "positive",
  negative: "negative",
  neutral: "neutral",
  mixed: "mixed",
};

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "rising")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
        <TrendingUp className="h-3.5 w-3.5" /> Rising
      </span>
    );
  if (trend === "falling")
    return (
      <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
        <TrendingDown className="h-3.5 w-3.5" /> Falling
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold">
      <Minus className="h-3.5 w-3.5" /> Stable
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
      <p className="text-muted-foreground text-sm max-w-xs mx-auto">{message}</p>
    </div>
  );
}

// ─── Pain Points Section ──────────────────────────────────────────────────────

function PainPointsSection({ clusters }: { clusters: Cluster[] }) {
  const complaints = clusters
    .filter((c) => c.category === "complaint")
    .sort((a, b) => b.mentionCount - a.mentionCount);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-4 w-4" />
          Pain Points
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Recurring complaints from their users — your biggest opportunities.
        </p>
      </div>

      {complaints.length === 0 ? (
        <EmptyState message="No complaint clusters found yet. They'll appear once classification finishes." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {complaints.map((cluster) => (
            <Card key={cluster.id} className="hover:shadow-sm transition-shadow border-red-100">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold leading-snug">{cluster.label}</p>
                  <TrendIcon trend={cluster.trend} />
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={SENTIMENT_BADGE[cluster.sentiment] ?? "neutral"}>
                    {cluster.sentiment}
                  </Badge>
                  <Badge variant="complaint">Complaint</Badge>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {cluster.mentionCount} mentions
                  </span>
                  <span>Updated {new Date(cluster.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Feature Requests Section ─────────────────────────────────────────────────

function FeatureRequestCard({ mention }: { mention: Mention }) {
  const cls = mention.classification;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="pt-5 pb-4 space-y-3">
        {/* AI summary */}
        {cls?.summary ? (
          <p className="text-sm italic text-muted-foreground bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
            {cls.summary}
          </p>
        ) : (
          <p className="text-sm text-foreground leading-relaxed line-clamp-3">{mention.content}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">u/{mention.author}</span>
          {mention.subreddit && <span>r/{mention.subreddit}</span>}
          <span>{new Date(mention.postedAt).toLocaleDateString()}</span>
          <span className="ml-auto flex items-center gap-3">
            {mention.score > 0 && (
              <span className="text-primary font-semibold">↑ {mention.score}</span>
            )}
            <a
              href={mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureRequestsSection({ competitorId }: { competitorId: string }) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<PaginatedResponse<Mention>>(
        `/api/competitors/${competitorId}/mentions?category=feature_request&limit=30`,
      )
      .then((res) => {
        const sorted = [...res.items].sort((a, b) => b.score - a.score);
        setMentions(sorted);
        setTotal(res.total);
      })
      .catch(() => {
        setMentions([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [competitorId]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 text-indigo-600">
          <Lightbulb className="h-4 w-4" />
          Feature Requests
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          What their users are asking for — gaps you can fill first.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : mentions.length === 0 ? (
        <EmptyState message="No feature request mentions found yet. They'll appear once classification identifies them." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> feature request
            {total !== 1 ? "s" : ""} found
          </p>
          <div className="space-y-3">
            {mentions.map((mention) => (
              <FeatureRequestCard key={mention.id} mention={mention} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ─── What They Do Well Section ────────────────────────────────────────────────

function StrengthsSection({ clusters }: { clusters: Cluster[] }) {
  const praises = clusters
    .filter((c) => c.category === "praise")
    .sort((a, b) => b.mentionCount - a.mentionCount);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 text-emerald-600">
          <Star className="h-4 w-4" />
          What They Do Well
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          These are your competitor&apos;s strengths — features you need to match or exceed.
        </p>
      </div>

      {praises.length === 0 ? (
        <EmptyState message="No praise clusters found yet. They'll appear once classification identifies what users love about this competitor." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {praises.map((cluster) => (
            <Card key={cluster.id} className="hover:shadow-sm transition-shadow border-emerald-100">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold leading-snug">{cluster.label}</p>
                  <TrendIcon trend={cluster.trend} />
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={SENTIMENT_BADGE[cluster.sentiment] ?? "neutral"}>
                    {cluster.sentiment}
                  </Badge>
                  <Badge variant="praise">Praise</Badge>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {cluster.mentionCount} mentions
                  </span>
                  <span>Updated {new Date(cluster.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── What They're Shipping Section ───────────────────────────────────────────

function ShippingCard({ mention }: { mention: Mention }) {
  const cls = mention.classification;
  const featureName = cls?.featureShipped ?? cls?.summary ?? "New update";

  return (
    <Card className="hover:shadow-sm transition-shadow border-violet-100">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug">{featureName}</p>
          {cls && (
            <Badge variant={SENTIMENT_BADGE[cls.sentiment] ?? "neutral"}>
              {cls.sentiment}
            </Badge>
          )}
        </div>

        {cls?.summary && cls.featureShipped && (
          <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-md px-3 py-2 leading-relaxed">
            {cls.summary}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">u/{mention.author}</span>
          {mention.subreddit && <span>r/{mention.subreddit}</span>}
          <span>{new Date(mention.postedAt).toLocaleDateString()}</span>
          <span className="ml-auto flex items-center gap-3">
            {mention.score > 0 && (
              <span className="text-primary font-semibold">↑ {mention.score}</span>
            )}
            <a
              href={mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ShippingSection({ competitorId }: { competitorId: string }) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<PaginatedResponse<Mention>>(
        `/api/competitors/${competitorId}/mentions?category=competitor_update&limit=20`,
      )
      .then((res) => {
        setMentions(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setMentions([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [competitorId]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 text-violet-600">
          <Rocket className="h-4 w-4" />
          What They&apos;re Shipping
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Recent competitor updates and how users are reacting.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : mentions.length === 0 ? (
        <EmptyState message="No competitor updates detected yet. This section fills as users discuss new features or changes shipped by this competitor." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> update
            {total !== 1 ? "s" : ""} detected
          </p>
          <div className="space-y-3">
            {mentions.map((mention) => (
              <ShippingCard key={mention.id} mention={mention} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ─── PM Tab ───────────────────────────────────────────────────────────────────

export default function PMTab({ competitorId, clusters }: PMTabProps) {
  return (
    <div className="space-y-10">
      <PainPointsSection clusters={clusters} />
      <FeatureRequestsSection competitorId={competitorId} />
      <StrengthsSection clusters={clusters} />
      <ShippingSection competitorId={competitorId} />
    </div>
  );
}
