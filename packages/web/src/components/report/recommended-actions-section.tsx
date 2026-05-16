import { useReportActionsQuery } from "@/hooks/queries/use-reports";

export function RecommendedActionsSection({ reportId }: { reportId: string }) {
  const { data, isLoading, isError, error, refetch } =
    useReportActionsQuery(reportId);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Recommended Next Actions
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded bg-muted/40"
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
          Recommended Next Actions
        </h2>
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>{(error as Error)?.message ?? "Failed to load actions."}</span>
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
        Recommended Next Actions
      </h2>
      <ol className="space-y-2">
        {data.map((action, i) => (
          <li key={action.id} className="flex gap-3 text-sm">
            <span className="font-mono text-muted-foreground shrink-0 tabular-nums">
              {i + 1}.
            </span>
            <span className="flex-1">
              <span className="font-medium">{action.step}</span>
              {action.detail && (
                <span className="text-muted-foreground"> — {action.detail}</span>
              )}
              {(action.effort || action.role) && (
                <span className="ml-2 inline-flex gap-2 text-xs text-muted-foreground">
                  {action.effort && (
                    <span className="font-mono uppercase">
                      {action.effort}
                    </span>
                  )}
                  {action.role && <span>· {action.role}</span>}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
