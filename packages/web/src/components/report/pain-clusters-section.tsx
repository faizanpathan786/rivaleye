import { useReportComplaintsQuery } from "@/hooks/queries/use-reports";
import { PainClusterCard } from "./pain-cluster-card";

export function PainClustersSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportComplaintsQuery(reportId);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Pain Clusters</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-xl border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Failed to load pain clusters.
        </p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <PainClusterCard key={c.id} complaint={c} />
          ))}
        </div>
      )}
    </section>
  );
}
