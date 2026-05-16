import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";

type Props = {
  report: ReportRow;
};

export function ReportHeader({ report }: Props) {
  const name =
    report.primary_competitor_name ?? report.competitors[0] ?? "Report";
  const domain = report.primary_competitor_domain;
  const sentiment = report.sentiment_overall;
  const sentimentTrend = report.sentiment_trend;
  const scanned = formatRelative(report.scanned_at);

  return (
    <div className="space-y-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            {domain && (
              <span className="font-mono text-sm text-muted-foreground">
                {domain}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {report.category && (
              <Badge variant="secondary" className="font-mono text-xs">
                {report.category}
              </Badge>
            )}
            {report.time_range && (
              <Badge variant="outline" className="text-xs">
                {report.time_range}
              </Badge>
            )}
            <StatusBadge
              status={
                report.status as "queued" | "running" | "completed" | "failed"
              }
            />
            <span className="font-mono text-xs text-muted-foreground">
              scanned {scanned}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Metric
            label="Sources"
            value={
              report.total_sources != null
                ? report.total_sources.toLocaleString()
                : "—"
            }
          />
          <Metric
            label="Threads"
            value={
              report.total_threads != null
                ? report.total_threads.toLocaleString()
                : "—"
            }
          />
          <Metric
            label="Sentiment"
            value={sentiment != null ? sentiment.toFixed(2) : "—"}
            sub={sentimentTrend ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-lg font-medium tabular-nums">{value}</div>
      {sub && (
        <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}
