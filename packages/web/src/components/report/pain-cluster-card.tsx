import type { Complaint } from "@/api/reports";

interface PainClusterCardProps {
  complaint: Complaint;
}

export function PainClusterCard({ complaint }: PainClusterCardProps) {
  return (
    <div
      id={complaint.external_id}
      className="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-base leading-snug">
          {complaint.title}
        </h3>
        {complaint.tag ? (
          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {complaint.tag}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{complaint.mentions.toLocaleString()} mentions</span>
        {complaint.delta ? <span>{complaint.delta}</span> : null}
        <span>{complaint.threads} threads</span>
        <span>severity {(complaint.severity * 100).toFixed(0)}%</span>
      </div>

      {complaint.summary ? (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {complaint.summary}
        </p>
      ) : null}

      {complaint.sample ? (
        <blockquote className="border-l-2 border-muted pl-3 text-sm text-foreground/80 italic">
          "{complaint.sample}"
        </blockquote>
      ) : null}
    </div>
  );
}
