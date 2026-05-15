"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, RefreshCw, X, ArrowRight, Clock, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Competitor } from "@rivaleye/shared";

const POLL_INTERVAL = 30_000;

export default function DashboardPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchCompetitors = useCallback(async () => {
    try {
      const data = await api.get<Competitor[]>("/api/competitors");
      setCompetitors(data);
    } catch {
      // silent poll failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCompetitors();
    const interval = setInterval(() => void fetchCompetitors(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCompetitors]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const competitor = await api.post<Competitor>("/api/competitors", { name: name.trim() });
      setCompetitors((prev) => [competitor, ...prev]);
      setName("");
      setShowAdd(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add competitor");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competitors</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor what users say about your competitors in real time
          </p>
        </div>
        <Button onClick={() => { setShowAdd(true); setAddError(""); }}>
          <Plus className="h-4 w-4" />
          Add Competitor
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="border-primary/30 bg-accent/30">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold">Track a new competitor</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  We&apos;ll auto-discover their Reddit community and start monitoring mentions.
                </p>
              </div>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="flex gap-3">
              <Input
                autoFocus
                placeholder="e.g. ClickUp, Notion, Linear, Jira..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={adding}>
                {adding && <Loader2 className="h-4 w-4 animate-spin" />}
                {adding ? "Adding..." : "Add"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </form>
            {addError && (
              <p className="text-sm text-destructive mt-2">{addError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Competitor grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Plus className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No competitors yet</h3>
          <p className="text-muted-foreground text-sm mt-2 mb-6 max-w-xs mx-auto">
            Add a competitor name and we&apos;ll automatically find their Reddit community and start monitoring.
          </p>
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add your first competitor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {competitors.map((competitor) => (
            <CompetitorCard key={competitor.id} competitor={competitor} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: Competitor }) {
  const isSyncing = !competitor.lastSyncedAt;

  return (
    <Link href={`/dashboard/competitors/${competitor.id}`} className="block group">
      <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30 group-hover:-translate-y-0.5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-sm">
                  {competitor.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{competitor.name}</h3>
                {competitor.website && (
                  <p className="text-xs text-muted-foreground truncate">{competitor.website}</p>
                )}
              </div>
            </div>
            <Badge variant={competitor.status as "active" | "paused" | "archived"} className="flex-shrink-0">
              {competitor.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Sync status */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-primary font-medium">Discovering sources...</span>
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  <span>Synced {new Date(competitor.lastSyncedAt!).toLocaleDateString()}</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              View signals
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-xs text-muted-foreground">Monitoring Reddit</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
