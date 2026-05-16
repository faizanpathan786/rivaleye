import { useReportOpportunitiesQuery } from "@/hooks/queries/use-reports";

export function ProductOpportunitiesSection({
  reportId,
}: {
  reportId: string;
}) {
  const { data, isLoading, isError, error, refetch } =
    useReportOpportunitiesQuery(reportId);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Product Opportunities
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded bg-muted/40"
            />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Product Opportunities
        </h2>
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>
            {(error as Error)?.message ?? "Failed to load opportunities."}
          </span>
          <button
            onClick={() => refetch()}
            className="underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (!data?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">
        Product Opportunities
      </h2>
      <ol className="space-y-3">
        {data.map((opp, i) => (
          <li key={opp.id} className="flex gap-3 text-base">
            <span className="font-mono text-primary shrink-0 tabular-nums">
              {i + 1}.
            </span>
            <div className="flex-1 space-y-1">
              <div className="font-medium">{opp.title}</div>
              <div className="text-sm text-muted-foreground">{opp.thesis}</div>
              <div className="flex gap-3 text-xs text-muted-foreground font-mono uppercase">
                {opp.effort && <span>effort: {opp.effort}</span>}
                {opp.payoff && <span>payoff: {opp.payoff}</span>}
                {opp.anchor_complaint_id && (
                  <span>anchor: {opp.anchor_complaint_id.slice(0, 8)}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
