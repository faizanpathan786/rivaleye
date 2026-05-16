import { useReportPositioningQuery } from "@/hooks/queries/use-reports";

export function PositioningAnglesSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportPositioningQuery(reportId);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">
        Positioning Angles
      </h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-md border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Failed to load positioning angles.
        </p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <ol className="space-y-3">
          {data.map((p, i) => (
            <li
              key={p.id}
              className="rounded-md border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-primary shrink-0 tabular-nums text-sm">
                  {i + 1}.
                </span>
                <h3 className="font-medium">{p.angle}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {p.thesis}
              </p>
              {(p.audience || p.against) ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {p.audience ? (
                    <span>
                      <span className="font-medium text-foreground">
                        Audience:
                      </span>{" "}
                      {p.audience}
                    </span>
                  ) : null}
                  {p.against ? (
                    <span>
                      <span className="font-medium text-foreground">
                        Against:
                      </span>{" "}
                      {p.against}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
