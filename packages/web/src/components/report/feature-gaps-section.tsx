import { useReportFeatureGapsQuery } from "@/hooks/queries/use-reports";

export function FeatureGapsSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportFeatureGapsQuery(reportId);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Feature Gaps</h2>
      {isLoading ? (
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="h-4 rounded bg-muted animate-pulse"
            />
          ))}
        </ul>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load feature gaps.</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <ul className="space-y-1">
          {data.map((gap) => (
            <li
              key={gap.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground"
            >
              <span className="text-border shrink-0">·</span>
              <span className="min-w-0 flex-1 break-words">{gap.feature}</span>
              <span className="shrink-0 tabular-nums text-xs">
                {gap.votes.toLocaleString()} votes
              </span>
              <span className="shrink-0 tabular-nums text-xs">
                signal {(gap.signal * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
