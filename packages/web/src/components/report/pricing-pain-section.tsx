import { useReportPricingQuery } from "@/hooks/queries/use-reports";

export function PricingPainSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportPricingQuery(reportId);

  const hasContent =
    data &&
    (data.tiers.length > 0 ||
      data.quotes.length > 0 ||
      data.blended ||
      data.pain_score !== null);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Pricing Pain</h2>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-md bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Failed to load pricing pain.</p>
      ) : !hasContent ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-4">
          {(data!.blended || data!.pain_score !== null) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {data!.blended ? (
                <span>
                  Blended:{" "}
                  <span className="text-foreground">{data!.blended}</span>
                </span>
              ) : null}
              {data!.pain_score !== null ? (
                <span>
                  Pain score{" "}
                  <span className="text-foreground">
                    {(data!.pain_score * 100).toFixed(0)}%
                  </span>
                </span>
              ) : null}
            </div>
          )}

          {data!.tiers.length > 0 ? (
            <ul className="space-y-2">
              {data!.tiers.map((t) => (
                <li
                  key={t.tier}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{t.tier}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      pain {(t.pain * 100).toFixed(0)}%
                    </span>
                  </div>
                  {t.note ? (
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {data!.quotes.length > 0 ? (
            <ul className="space-y-2">
              {data!.quotes.map((q, i) => (
                <li
                  key={i}
                  className="border-l-2 border-muted pl-3 text-sm text-foreground/80"
                >
                  <p className="italic">"{q.text}"</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.who}
                    {q.sub ? ` · ${q.sub}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
