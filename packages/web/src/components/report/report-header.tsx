import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";

type Props = {
  report: ReportRow;
  partial?: boolean;
  failed_platforms?: string[];
  onRetryFailed?: () => void;
};

export function ReportHeader({
  report,
  partial,
  failed_platforms,
  onRetryFailed,
}: Props) {
  const name =
    report.primary_competitor_name ?? report.competitors[0] ?? "Report";
  const domain = report.primary_competitor_domain;
  const sentiment = report.sentiment_overall;
  const sentimentTrend = report.sentiment_trend;
  const scanned = formatRelative(report.scanned_at);

  return (
    <div className="space-y-4 border-b border-border pb-6">
      {partial && failed_platforms && failed_platforms.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          <span className="min-w-0 break-words">
            Partial report. Missing platforms:{" "}
            <span className="font-medium">{failed_platforms.join(", ")}</span>.
          </span>
          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="ml-2 underline underline-offset-2 hover:no-underline"
            >
              Retry failed platforms
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl break-words">
              {name}
            </h1>
            {domain && (
              <span className="font-mono text-sm text-muted-foreground break-all">
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
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:w-auto">
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
