"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Local Types ──────────────────────────────────────────────────────────────

interface CompetitorStats {
  totalMentions: number;
  classified: number;
  sentimentBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  switchIntentCount: number;
  volumeOverTime: Array<{ date: string; count: number }>;
}

interface Mention {
  id: string;
  classification?: {
    switchIntentTarget?: string | null;
    competitorMentions: string[];
  } | null;
}

interface GrowthTabProps {
  competitorId: string;
  stats: CompetitorStats;
  leads: Mention[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTIMENT_COLORS: Record<string, string> = {
  positive: "#10b981",
  negative: "#ef4444",
  neutral: "#94a3b8",
  mixed: "#f59e0b",
};

const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
];

const CATEGORY_LABELS: Record<string, string> = {
  complaint: "Complaints",
  praise: "Praises",
  feature_request: "Feature Requests",
  comparison: "Comparisons",
  pricing: "Pricing",
  ux: "UX Issues",
  performance: "Performance",
  support: "Support",
  other: "Other",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveHealthScore(breakdown: Record<string, number>): number {
  const pos = breakdown.positive ?? 0;
  const neg = breakdown.negative ?? 0;
  const neutral = breakdown.neutral ?? 0;
  const mixed = breakdown.mixed ?? 0;
  const total = pos + neg + neutral + mixed;
  if (total === 0) return 0;
  return Math.round(((pos + mixed * 0.5) / total) * 100);
}

function healthLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: "Healthy", color: "text-emerald-600", bg: "bg-emerald-50" };
  if (score >= 40) return { label: "Mixed", color: "text-amber-600", bg: "bg-amber-50" };
  return { label: "Struggling", color: "text-red-600", bg: "bg-red-50" };
}

// Terms that are categories/generic descriptors, not specific products
const NOISE_TERMS = new Set([
  "project management", "project management tool", "project management software",
  "okr software", "okr tool", "alternatives", "alternative", "other tools",
  "other tool", "something else", "another tool", "different tool",
  "competitor", "competitors", "google", "microsoft", "apple",
  "productivity tool", "productivity software", "task manager", "task management",
  "crm", "erp", "saas", "software", "app", "tool", "platform",
]);

function isSpecificProduct(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (lower.length < 3) return false;
  if (NOISE_TERMS.has(lower)) return false;
  // Exclude strings that are just generic descriptors (contain "software", "tool", "app" as standalone words)
  if (/\b(software|tool|app|platform|system|solution|service)\b/.test(lower) && lower.split(" ").length > 1) return false;
  return true;
}

function aggregateAlternatives(leads: Mention[]): Array<{ name: string; count: number }> {
  const counts: Record<string, number> = {};

  for (const lead of leads) {
    const cls = lead.classification;
    if (!cls) continue;
    if (cls.switchIntentTarget) {
      const key = cls.switchIntentTarget.trim();
      if (key && isSpecificProduct(key)) counts[key] = (counts[key] ?? 0) + 1;
    }
    for (const mention of cls.competitorMentions ?? []) {
      const key = mention.trim();
      if (key && isSpecificProduct(key)) counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
      <p className="text-muted-foreground text-sm max-w-xs mx-auto">{message}</p>
    </div>
  );
}

// ─── Section 1: Volume Trend ──────────────────────────────────────────────────

function VolumeTrendSection({ volumeOverTime }: { volumeOverTime: CompetitorStats["volumeOverTime"] }) {
  const volumeData = volumeOverTime.slice(-30).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    mentions: d.count,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Mention Volume — last 30 days</CardTitle>
        </div>
        <CardDescription>Daily mention count from monitored sources</CardDescription>
      </CardHeader>
      <CardContent>
        {volumeData.length === 0 ? (
          <EmptyState message="Not enough data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={volumeData} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="mentionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(243, 75%, 59%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(243, 75%, 59%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                tickLine={false}
                interval={Math.floor(volumeData.length / 6)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="mentions"
                stroke="hsl(243, 75%, 59%)"
                strokeWidth={2}
                fill="url(#mentionGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 2: Sentiment Health Score ────────────────────────────────────────

function SentimentHealthSection({ sentimentBreakdown }: { sentimentBreakdown: Record<string, number> }) {
  const score = deriveHealthScore(sentimentBreakdown);
  const { label, color, bg } = healthLabel(score);

  const sentimentRows: Array<{ key: string; label: string; color: string }> = [
    { key: "positive", label: "Positive", color: SENTIMENT_COLORS["positive"]! },
    { key: "negative", label: "Negative", color: SENTIMENT_COLORS["negative"]! },
    { key: "neutral", label: "Neutral", color: SENTIMENT_COLORS["neutral"]! },
    { key: "mixed", label: "Mixed", color: SENTIMENT_COLORS["mixed"]! },
  ];

  const total = sentimentRows.reduce((sum, r) => sum + (sentimentBreakdown[r.key] ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Sentiment Health Score</CardTitle>
        </div>
        <CardDescription>Derived from classified mention breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState message="No classified mentions yet" />
        ) : (
          <div className="flex items-start gap-8">
            {/* Score display */}
            <div className="flex flex-col items-center gap-2 min-w-[96px]">
              <span className="text-5xl font-bold tracking-tight">{score}</span>
              <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${bg} ${color}`}>
                {label}
              </span>
            </div>

            {/* Breakdown rows */}
            <div className="flex-1 space-y-3 pt-1">
              {sentimentRows.map(({ key, label: rowLabel, color: dotColor }) => {
                const count = sentimentBreakdown[key] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: dotColor }}
                    />
                    <span className="text-sm text-muted-foreground w-16">{rowLabel}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: dotColor }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 3: Alternatives Landscape ────────────────────────────────────────

function AlternativesSection({ leads }: { leads: Mention[] }) {
  const alternatives = aggregateAlternatives(leads);
  const maxCount = alternatives[0]?.count ?? 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500" />
          <CardTitle className="text-base">Products Winning Users Away</CardTitle>
        </div>
        <CardDescription>
          Alternatives mentioned by users with switch intent
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alternatives.length === 0 ? (
          <EmptyState message="No alternative products identified yet" />
        ) : (
          <div className="space-y-3">
            {alternatives.map(({ name, count }, index) => {
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-muted-foreground w-5 text-right flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium w-32 truncate flex-shrink-0">{name}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: "hsl(243, 75%, 59%)",
                        opacity: 0.85 - index * 0.07,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 4: Category Breakdown ────────────────────────────────────────────

function CategoryBreakdownSection({ categoryBreakdown }: { categoryBreakdown: Record<string, number> }) {
  const categories = Object.entries(categoryBreakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  const maxCount = categories[0]?.[1] ?? 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">What People Are Talking About</CardTitle>
        </div>
        <CardDescription>Category breakdown across all classified mentions</CardDescription>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <EmptyState message="No classified mentions yet" />
        ) : (
          <div className="space-y-3">
            {categories.map(([key, count], index) => {
              const pct = Math.round((count / maxCount) * 100);
              const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
              return (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-sm text-muted-foreground w-36 truncate flex-shrink-0">
                    {CATEGORY_LABELS[key] ?? key}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <span className="text-sm font-semibold w-8 text-right flex-shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Root Export ──────────────────────────────────────────────────────────────

export function GrowthTab({ stats, leads }: GrowthTabProps) {
  return (
    <div className="space-y-6">
      {/* Section 1: Volume trend */}
      <VolumeTrendSection volumeOverTime={stats.volumeOverTime} />

      {/* Section 2 + 3 side by side on wider screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SentimentHealthSection sentimentBreakdown={stats.sentimentBreakdown} />
        <AlternativesSection leads={leads} />
      </div>

      {/* Section 4: Category breakdown */}
      <CategoryBreakdownSection categoryBreakdown={stats.categoryBreakdown} />
    </div>
  );
}
