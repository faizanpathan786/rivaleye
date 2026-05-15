import { useParams } from "react-router-dom";
import { useReport } from "@/hooks/queries/use-report";
import { PainClusterCard } from "@/components/pain-cluster-card";
import type { PainReportOutput } from "@rivaleye/shared";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-muted text-muted-foreground",
    running: "bg-yellow-500/20 text-yellow-500",
    completed: "bg-green-500/20 text-green-600",
    failed: "bg-destructive/20 text-destructive",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? colors["queued"]}`}>
      {status}
    </span>
  );
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useReport(id!);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">Loading report...</p>
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-destructive text-sm">Failed to load report.</p>
      </main>
    );
  }

  const output = data.output as PainReportOutput | null;

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {(data.competitors as string[]).join(", ")}
          </h1>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          {data.category} · {data.goal.replace(/_/g, " ")}
        </p>
      </div>

      {(data.status === "queued" || data.status === "running") && (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
          <p className="text-sm font-medium animate-pulse">
            {data.status === "queued" ? "Queued — starting shortly..." : "Scraping Reddit and clustering pain points..."}
          </p>
          <p className="text-xs text-muted-foreground">This takes 1–3 minutes. Page auto-refreshes.</p>
        </div>
      )}

      {data.status === "failed" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">Report generation failed. Try again.</p>
        </div>
      )}

      {data.status === "completed" && output && (
        <div className="space-y-6">
          {output.summary && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary</h2>
              <p className="text-sm">{output.summary}</p>
            </div>
          )}

          {output.painClusters.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Pain Clusters</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {output.painClusters.map((cluster, i) => (
                  <PainClusterCard key={i} cluster={cluster} />
                ))}
              </div>
            </section>
          )}

          {output.featureGaps.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Feature Gaps</h2>
              <ul className="space-y-1">
                {output.featureGaps.map((gap, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-foreground">·</span> {gap}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {output.positioningAngles.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Positioning Angles</h2>
              <ul className="space-y-1">
                {output.positioningAngles.map((angle, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-foreground">·</span> {angle}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
