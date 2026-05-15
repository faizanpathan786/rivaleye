"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  TrendingDown,
  MessageSquare,
  AlertTriangle,
  Zap,
  Cpu,
  LineChart,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import PMTab from "./tabs/pm-tab";
import { SalesTab } from "./tabs/sales-tab";
import { GrowthTab } from "./tabs/growth-tab";
import type { Competitor, Mention, Cluster, PaginatedResponse, CompetitorStats } from "@rivaleye/shared";

const POLL_INTERVAL = 30_000;

type Tab = "pm" | "sales" | "growth";

const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "pm",
    label: "PM View",
    icon: <Cpu className="h-3.5 w-3.5" />,
    description: "Pain points, feature gaps, competitor strengths",
  },
  {
    id: "sales",
    label: "Sales",
    icon: <Users className="h-3.5 w-3.5" />,
    description: "Switch-intent leads ready to convert",
  },
  {
    id: "growth",
    label: "Growth",
    icon: <LineChart className="h-3.5 w-3.5" />,
    description: "Sentiment trends, alternatives, volume",
  },
];

export default function CompetitorDetailPage({ params }: { params: { id: string } }) {
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [tab, setTab] = useState<Tab>("pm");
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [leads, setLeads] = useState<PaginatedResponse<Mention> | null>(null);
  const [stats, setStats] = useState<CompetitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [comp, clusterData, leadData, statsData] = await Promise.all([
        api.get<Competitor>(`/api/competitors/${params.id}`),
        api.get<Cluster[]>(`/api/competitors/${params.id}/clusters`),
        api.get<PaginatedResponse<Mention>>(`/api/competitors/${params.id}/leads?limit=20`),
        api.get<CompetitorStats>(`/api/competitors/${params.id}/stats`),
      ]);
      setCompetitor(comp);
      setClusters(clusterData);
      setLeads(leadData);
      setStats(statsData);
    } catch {
      // handle
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => void fetchData(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleSync() {
    setSyncing(true);
    try {
      await api.post(`/api/competitors/${params.id}/sync`, {});
      setTimeout(() => void fetchData(), 2000);
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!competitor) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Competitor not found.</p>
        <Link href="/dashboard" className="text-primary text-sm mt-2 inline-block hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const classifiedPct = stats
    ? Math.round((stats.classified / Math.max(stats.totalMentions, 1)) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background border-b px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-sm">
                  {competitor.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold leading-tight">{competitor.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {competitor.lastSyncedAt
                    ? `Last synced ${new Date(competitor.lastSyncedAt).toLocaleString()}`
                    : "Syncing..."}
                </p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-6 space-y-6">
          {/* Stats row */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Relevant Mentions"
                value={stats.classified.toLocaleString()}
                icon={<MessageSquare className="h-4 w-4" />}
                sub={`${classifiedPct}% of ${stats.totalMentions} fetched`}
                color="primary"
              />
              <StatCard
                label="Negative Sentiment"
                value={(stats.sentimentBreakdown.negative ?? 0).toLocaleString()}
                icon={<TrendingDown className="h-4 w-4" />}
                sub="unhappy users detected"
                color="red"
              />
              <StatCard
                label="Switch Intent Leads"
                value={stats.switchIntentCount.toLocaleString()}
                icon={<Zap className="h-4 w-4" />}
                sub="users ready to switch"
                color="orange"
              />
              <StatCard
                label="Complaint Clusters"
                value={clusters.filter((c) => c.category === "complaint").length.toLocaleString()}
                icon={<AlertTriangle className="h-4 w-4" />}
                sub={`of ${clusters.length} total themes`}
                color="purple"
              />
            </div>
          )}

          {/* Classification progress banner */}
          {stats && stats.classified < stats.totalMentions && stats.totalMentions > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
              <p className="text-sm text-primary">
                <span className="font-semibold">{stats.classified.toLocaleString()}</span> of{" "}
                <span className="font-semibold">{stats.totalMentions.toLocaleString()}</span> mentions
                classified — results updating live
              </p>
            </div>
          )}

          {/* Persona tab bar */}
          <div className="border-b flex gap-0">
            {TAB_CONFIG.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-5 pb-3 pt-1 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "text-primary border-b-2 border-primary -mb-px"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {t.icon}
                  {t.label}
                  {t.id === "sales" && leads && leads.total > 0 && (
                    <span className="rounded-full bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 font-semibold">
                      {leads.total}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "pm" && (
            <PMTab competitorId={params.id} clusters={clusters} />
          )}
          {tab === "sales" && leads && (
            <SalesTab
              competitorId={params.id}
              leads={leads.items}
              totalLeads={leads.total}
            />
          )}
          {tab === "growth" && stats && leads && (
            <GrowthTab
              competitorId={params.id}
              stats={stats}
              leads={leads.items}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  sub,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    red: "bg-red-100 text-red-600",
    orange: "bg-orange-100 text-orange-600",
    purple: "bg-purple-100 text-purple-600",
  };

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {label}
            </p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] ?? colorMap.primary}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
