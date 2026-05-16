import type { PainCluster } from "@rivaleye/shared";

interface PainClusterCardProps {
  cluster: PainCluster;
}

export function PainClusterCard({ cluster }: PainClusterCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-base leading-snug">{cluster.title}</h3>
        <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {cluster.evidence.length} quotes
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{cluster.description}</p>
      {cluster.evidence.slice(0, 3).map((quote, i) => (
        <blockquote
          key={i}
          className="border-l-2 border-muted pl-3 text-sm text-foreground/80 italic"
        >
          "{quote}"
        </blockquote>
      ))}
    </div>
  );
}
