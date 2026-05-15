"use client";

import { useState } from "react";
import { ExternalLink, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

// ─── Local types ─────────────────────────────────────────────────────────────

interface Mention {
  id: string;
  author: string;
  content: string;
  url: string;
  score: number;
  subreddit?: string | null;
  postedAt: string;
  classification?: {
    sentiment: string;
    switchIntent: boolean;
    switchIntentTarget?: string | null;
    urgency: string;
    summary: string;
  } | null;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

interface SalesTabProps {
  competitorId: string;
  leads: Mention[];
  totalLeads: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOISE_TERMS_SALES = new Set([
  "project management", "project management tool", "project management software",
  "okr software", "okr tool", "alternatives", "alternative", "other tools",
  "something else", "another tool", "different tool", "competitor", "competitors",
  "google", "microsoft", "productivity tool", "productivity software",
  "task manager", "task management", "crm", "erp", "saas", "software", "app", "tool",
]);

function isNamedProduct(target: string): boolean {
  const lower = target.toLowerCase().trim();
  if (lower.length < 3) return false;
  if (NOISE_TERMS_SALES.has(lower)) return false;
  if (/\b(software|tool|app|platform|system|solution|service)\b/.test(lower) && lower.split(" ").length > 1) return false;
  return true;
}

function getSwitchTarget(mention: Mention): string | null {
  const raw = mention.classification?.switchIntentTarget?.trim();
  if (!raw || !isNamedProduct(raw)) return null;
  return raw;
}

function buildTargetCounts(leads: Mention[]): { target: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const lead of leads) {
    const raw = lead.classification?.switchIntentTarget?.trim();
    if (raw && isNamedProduct(raw)) {
      counts[raw] = (counts[raw] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([target, count]) => ({ target, count }))
    .sort((a, b) => b.count - a.count);
}

function getLeadSummary(mention: Mention): string {
  const summary = mention.classification?.summary;
  if (summary) return summary;
  return mention.content.length > 80
    ? mention.content.slice(0, 80) + "…"
    : mention.content;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SalesTab({ competitorId, leads: initialLeads, totalLeads }: SalesTabProps) {
  const [leads, setLeads] = useState<Mention[]>(initialLeads);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(2);

  const hasMore = totalLeads > leads.length;

  async function loadMore() {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Mention>>(
        `/api/competitors/${competitorId}/leads?page=${page}&limit=20`
      );
      setLeads((prev) => [...prev, ...res.items]);
      setPage((p) => p + 1);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }

  const targetCounts = buildTargetCounts(leads);

  // ── Empty state ──
  if (totalLeads === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <Zap className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          No switch-intent leads yet. They&apos;ll appear after classification finds users
          expressing intent to switch products.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary bar ── */}
      <Card className="border-orange-200 bg-orange-50/60">
        <CardHeader className="pb-2">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-orange-600">{totalLeads}</span>
            <CardTitle className="text-orange-700 text-lg font-semibold">
              switch-intent leads found
            </CardTitle>
          </div>
          <CardDescription className="text-orange-600/80">
            Reddit users publicly expressing intent to leave this product
          </CardDescription>
        </CardHeader>
      </Card>

      {/* ── "Switching To" breakdown ── */}
      {targetCounts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Where they&apos;re going:
          </p>
          <div className="flex flex-wrap gap-2">
            {targetCounts.map(({ target, count }) => (
              <Badge
                key={target}
                variant="switch_intent"
                className="text-sm px-3 py-1"
              >
                {target} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* ── Leads table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                  Author
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                  Switching To
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                  Why They&apos;re Leaving
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                  Subreddit
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
                  Score
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((lead) => {
                const summary = getLeadSummary(lead);
                return (
                  <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                    {/* Author */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-foreground">
                        u/{lead.author}
                      </span>
                    </td>

                    {/* Switching To */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const target = getSwitchTarget(lead);
                        return target ? (
                          <Badge variant="switch_intent">{target}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        );
                      })()}
                    </td>

                    {/* Why They're Leaving */}
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-sm text-foreground/80 leading-snug line-clamp-2">
                        {summary}
                      </p>
                    </td>

                    {/* Subreddit */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.subreddit && (
                        <span className="text-xs text-muted-foreground">
                          r/{lead.subreddit}
                        </span>
                      )}
                    </td>

                    {/* Score */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          lead.score > 0
                            ? "text-orange-500 font-semibold text-xs"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {lead.score}
                      </span>
                    </td>

                    {/* Link */}
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Open Reddit post"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Load more ── */}
        {hasMore && (
          <div className="flex justify-center py-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
