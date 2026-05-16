import { useReportLeadsQuery } from "@/hooks/queries/use-reports";

export function CompetitorWeaknessesSection({
  reportId,
}: {
  reportId: string;
}) {
  const { data, isLoading, isError, error, refetch } =
    useReportLeadsQuery(reportId);

  if (isLoading) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          Competitor Weaknesses
        </h2>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-8 animate-pulse rounded bg-muted/40"
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
          Competitor Weaknesses
        </h2>
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>{(error as Error)?.message ?? "Failed to load leads."}</span>
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
        Competitor Weaknesses
      </h2>
      <ul className="space-y-2">
        {data.map((l) => (
          <li
            key={l.id}
            className="flex gap-2 text-sm text-muted-foreground"
          >
            <span className="text-border shrink-0">·</span>
            <div className="flex-1 space-y-0.5">
              <div className="text-foreground">{l.quote}</div>
              <div className="text-xs font-mono">
                {l.who}
                {l.sub && ` · ${l.sub}`}
                {l.when_label && ` · ${l.when_label}`}
                {` · ${l.score}↑`}
                {l.signal && ` · ${l.signal}`}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
