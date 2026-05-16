import type { PainReportOutput } from "@rivaleye/shared";

export function SourceEvidenceSection({ painClusters }: { painClusters?: PainReportOutput["painClusters"] }) {
  if (!painClusters?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">Source Evidence</h2>
      <div className="w-full divide-y divide-border rounded-md border border-border">
        {painClusters.map((cluster, i) => (
          <details key={i} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
              <span>{cluster.title}</span>
              <span className="ml-2 shrink-0 text-muted-foreground transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="px-4 pb-3 pt-1">
              <ul className="space-y-1">
                {cluster.evidence.slice(0, 5).map((e, j) => (
                  <li key={j} className="font-mono text-xs text-muted-foreground">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
