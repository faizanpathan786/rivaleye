import { useReportSwitchingQuery } from "@/hooks/queries/use-reports";
import type { SwitchingFlow } from "@/api/reports";

function FlowList({
  title,
  flows,
}: {
  title: string;
  flows: SwitchingFlow[];
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1">
        {flows.map((flow) => (
          <li
            key={flow.competitor_name}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="min-w-0 break-words">{flow.competitor_name}</span>
            <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
              {flow.count} · {Math.round(flow.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SwitchingSignalsSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportSwitchingQuery(reportId);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">
        Switching Signals
      </h2>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-md border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Failed to load switching signals.
        </p>
      ) : !data || (!data.inbound.length && !data.outbound.length) ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-4">
          {data.net_signal ? (
            <p className="text-sm text-muted-foreground">{data.net_signal}</p>
          ) : null}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {data.inbound.length ? (
              <FlowList title="Inbound" flows={data.inbound} />
            ) : null}
            {data.outbound.length ? (
              <FlowList title="Outbound" flows={data.outbound} />
            ) : null}
          </div>
          {data.reasons_out.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Reasons out
              </h3>
              <ul className="space-y-1">
                {data.reasons_out.map((reason, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-border shrink-0">·</span>
                    <span className="min-w-0 break-words">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
