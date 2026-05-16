import { useReportThreadsQuery } from "@/hooks/queries/use-reports";

export function SourceEvidenceSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportThreadsQuery(reportId);

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">Source Evidence</h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-md border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Failed to load source evidence.
        </p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="w-full divide-y divide-border rounded-md border border-border">
          {data.map((thread) => (
            <details key={thread.id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                <span className="truncate">{thread.title}</span>
                <span className="ml-2 flex shrink-0 items-center gap-2 text-muted-foreground">
                  {thread.source ? (
                    <span className="font-mono text-xs">{thread.source}</span>
                  ) : null}
                  <span className="font-mono tabular-nums text-xs">
                    {thread.score}
                  </span>
                  <span className="transition-transform group-open:rotate-90">
                    ›
                  </span>
                </span>
              </summary>
              <div className="space-y-2 px-4 pb-3 pt-1">
                {thread.excerpt ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {thread.excerpt}
                  </p>
                ) : null}
                {thread.url ? (
                  <a
                    href={thread.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {thread.url}
                  </a>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
