import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ReportStatus = "queued" | "running" | "completed" | "failed";

export function StatusBadge({ status }: { status: ReportStatus }) {
  const config = {
    queued: { label: "Queued", icon: Clock, className: "bg-muted text-muted-foreground" },
    running: { label: "Running", icon: Loader2, className: "bg-accent/20 text-accent animate-pulse" },
    completed: { label: "Done", icon: CheckCircle2, className: "bg-primary/20 text-primary" },
    failed: { label: "Failed", icon: XCircle, className: "bg-destructive/20 text-destructive" },
  } as const;

  const { label, icon: Icon, className } = config[status] ?? config.queued;

  return (
    <Badge variant="outline" className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
