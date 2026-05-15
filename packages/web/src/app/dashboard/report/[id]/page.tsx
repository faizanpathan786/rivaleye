"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Copy,
  Loader2,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/lib/use-toast";
import { api } from "@/lib/api";
import type { Competitor } from "@rivaleye/shared";

interface ReportData {
  id: string;
  competitorId: string;
  status: "pending" | "processing" | "completed" | "failed";
  reportData: {
    summary: string;
    painThemes: Array<{
      theme: string;
      category: string;
      mentionCount: number;
      quotes: Array<{
        mentionId: string;
        text: string;
        score: number;
        subreddit: string;
        author: string;
        url: string;
      }>;
      sentimentDistribution: {
        positive: number;
        negative: number;
        neutral: number;
        mixed: number;
      };
    }>;
    featureRequests: Array<{
      request: string;
      count: number;
      mentions: string[];
    }>;
    positioningOpportunity: string;
    validationSteps: string[];
    signalStrength: "weak" | "medium" | "strong";
    mentionCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTheme, setExpandedTheme] = useState<string | null>(null);
  const [selectedQuotes, setSelectedQuotes] = useState<ReportData["reportData"]["painThemes"][0]["quotes"] | null>(null);
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [compData, reportData] = await Promise.all([
        api.get<Competitor>(`/api/competitors/${params.id}`),
        api.get<ReportData>(`/api/competitors/${params.id}/report`),
      ]);
      setCompetitor(compData);
      setReport(reportData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCopyToClipboard = async () => {
    if (!report?.reportData) return;

    const text = generateReportText(competitor, report.reportData);
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Report copied to clipboard",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = () => {
    if (!report?.reportData || !competitor) return;

    toast({
      title: "Coming Soon",
      description: "PDF export will be available in the next update",
    });
  };

  const handleViewEvidence = (quotes: ReportData["reportData"]["painThemes"][0]["quotes"]) => {
    setSelectedQuotes(quotes);
    setShowEvidenceDrawer(true);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!report || !competitor) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {report ? "Competitor not found." : "Report not found or still generating..."}
        </p>
        <Link href="/dashboard" className="text-primary text-sm mt-2 inline-block hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const data = report.reportData;

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
                <h1 className="text-xl font-bold leading-tight">{competitor.name} Report</h1>
                <p className="text-xs text-muted-foreground">
                  Generated {new Date(report.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Export menu */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyToClipboard}
              className="gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-6 space-y-8 max-w-4xl">
          {/* Executive Summary */}
          <section>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-blue-900">Executive Summary</h2>
                  <p className="text-sm text-blue-800 mt-2 leading-relaxed">
                    {data.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase">Total Mentions</p>
                  <p className="text-2xl font-bold mt-1">{data.mentionCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase">Pain Themes</p>
                  <p className="text-2xl font-bold mt-1">{data.painThemes.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase">Signal Strength</p>
                  <p className="text-2xl font-bold mt-1 capitalize">{data.signalStrength}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator />

          {/* Pain Themes */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Pain Themes
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                User complaints and friction points
              </p>
            </div>

            <div className="space-y-3">
              {data.painThemes.map((theme, idx) => (
                <Card
                  key={`${theme.theme}-${idx}`}
                  className="border-red-100 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() =>
                    setExpandedTheme(expandedTheme === theme.theme ? null : theme.theme)
                  }
                >
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-semibold">{theme.theme}</p>
                        <p className="text-sm text-muted-foreground mt-1">{theme.category}</p>
                      </div>
                      {expandedTheme === theme.theme ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {theme.mentionCount} mentions
                      </Badge>
                    </div>

                    {expandedTheme === theme.theme && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Positive</p>
                              <p className="font-semibold">{theme.sentimentDistribution.positive}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Negative</p>
                              <p className="font-semibold">{theme.sentimentDistribution.negative}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Neutral</p>
                              <p className="font-semibold">{theme.sentimentDistribution.neutral}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Mixed</p>
                              <p className="font-semibold">{theme.sentimentDistribution.mixed}</p>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewEvidence(theme.quotes);
                            }}
                            className="w-full justify-center"
                          >
                            View Evidence {theme.quotes.length > 0 && `(${theme.quotes.length})`}
                            <ChevronDown className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Separator />

          {/* Feature Requests */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 text-indigo-600">
                <TrendingUp className="h-5 w-5" />
                Feature Requests
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                What users are asking for
              </p>
            </div>

            <Card>
              <CardContent className="pt-5 pb-4">
                <ul className="space-y-2">
                  {data.featureRequests.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm">
                      <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{req.request}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.count} mention{req.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Positioning Opportunity */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-emerald-600">Positioning Opportunity</h2>
            </div>

            <Card className="border-emerald-100 bg-emerald-50/30">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm leading-relaxed">{data.positioningOpportunity}</p>
              </CardContent>
            </Card>
          </section>

          <Separator />

          {/* Validation Next Steps */}
          <section className="space-y-4 pb-12">
            <div>
              <h2 className="text-lg font-semibold">Validation Next Steps</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Action items to validate this opportunity
              </p>
            </div>

            <Card>
              <CardContent className="pt-5 pb-4">
                <ol className="space-y-3">
                  {data.validationSteps.map((step, idx) => (
                    <li key={idx} className="flex gap-3 text-sm">
                      <span className="font-semibold text-primary flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <p>{step}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      {/* Evidence Drawer Dialog */}
      <Dialog open={showEvidenceDrawer} onOpenChange={setShowEvidenceDrawer}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evidence Quotes</DialogTitle>
            <DialogDescription>
              Real user feedback supporting this theme
            </DialogDescription>
            <DialogClose />
          </DialogHeader>

          {selectedQuotes && (
            <div className="space-y-4 mt-4">
              {selectedQuotes.map((quote, idx) => (
                <Card key={`${quote.mentionId}-${idx}`} className="border-l-4 border-l-blue-400">
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div>
                      <p className="text-sm italic text-muted-foreground leading-relaxed">
                        "{quote.text.length > 300 ? quote.text.slice(0, 300) + "..." : quote.text}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="text-xs">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {quote.score > 0 ? `↑ ${quote.score}` : quote.score}
                      </Badge>
                      {quote.subreddit && (
                        <Badge variant="secondary" className="text-xs">
                          r/{quote.subreddit}
                        </Badge>
                      )}
                      <span className="text-muted-foreground">u/{quote.author}</span>
                    </div>

                    <a
                      href={quote.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on Reddit
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper function to generate report text for clipboard
function generateReportText(
  competitor: Competitor | null,
  data: ReportData["reportData"]
): string {
  if (!competitor) return "";

  const lines: string[] = [
    `${competitor.name} Competitive Report`,
    "=".repeat(50),
    "",
    "EXECUTIVE SUMMARY",
    "-".repeat(50),
    data.summary,
    "",
    `Total Mentions: ${data.mentionCount}`,
    `Pain Themes: ${data.painThemes.length}`,
    `Signal Strength: ${data.signalStrength}`,
    "",
    "PAIN THEMES",
    "-".repeat(50),
  ];

  data.painThemes.forEach((theme) => {
    lines.push(`\n${theme.theme}`);
    lines.push(`Category: ${theme.category}`);
    lines.push(`Mentions: ${theme.mentionCount}`);
    lines.push(
      `Sentiment: Positive(${theme.sentimentDistribution.positive}) Negative(${theme.sentimentDistribution.negative}) Neutral(${theme.sentimentDistribution.neutral}) Mixed(${theme.sentimentDistribution.mixed})`
    );
    lines.push("\nQuotes:");
    theme.quotes.slice(0, 3).forEach((quote, idx) => {
      lines.push(`  ${idx + 1}. "${quote.text.slice(0, 150)}..."`);
      lines.push(`     Score: ${quote.score} | r/${quote.subreddit} | ${quote.url}`);
    });
  });

  lines.push("", "", "FEATURE REQUESTS", "-".repeat(50));
  data.featureRequests.forEach((req) => {
    lines.push(`• ${req.request} (${req.count} mentions)`);
  });

  lines.push("", "", "POSITIONING OPPORTUNITY", "-".repeat(50));
  lines.push(data.positioningOpportunity);

  lines.push("", "", "VALIDATION NEXT STEPS", "-".repeat(50));
  data.validationSteps.forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step}`);
  });

  return lines.join("\n");
}
