import { PainClusterCard } from "./pain-cluster-card";
import type { PainReportOutput } from "@rivaleye/shared";

export function PainClustersSection({
  painClusters,
}: {
  painClusters?: PainReportOutput["painClusters"];
}) {
  if (!painClusters?.length) return null;
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Pain Clusters</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {painClusters.map((cluster) => (
          <PainClusterCard key={cluster.title} cluster={cluster} />
        ))}
      </div>
    </section>
  );
}
