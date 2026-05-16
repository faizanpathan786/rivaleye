import { toast } from "sonner";
import { Copy, Download, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { GOAL_LABELS } from "@/lib/goal-labels";
import type { ReportRow } from "@/lib/api";

type Props = {
  report: ReportRow;
  onCopyMarkdown?: () => string;
};

export function ReportHeader({ report, onCopyMarkdown }: Props) {
  const competitor = report.competitors[0] ?? "Report";
  const goalLabel = GOAL_LABELS[report.goal];

  function handleCopyLink() {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        toast.success("Link copied!");
      })
      .catch(() => {
        toast.error("Could not copy link");
      });
  }

  function handleCopyMarkdown() {
    if (!onCopyMarkdown) return;
    const md = onCopyMarkdown();
    navigator.clipboard
      .writeText(md)
      .then(() => {
        toast.success("Report copied as Markdown!");
      })
      .catch(() => {
        toast.error("Could not copy to clipboard");
      });
  }

  function handleDownload() {
    if (!onCopyMarkdown) return;
    const md = onCopyMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rivaleye-${competitor.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{competitor}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {report.category && (
              <Badge variant="secondary" className="font-mono text-xs">
                {report.category}
              </Badge>
            )}
            {goalLabel && (
              <Badge variant="outline" className="text-xs">
                {goalLabel}
              </Badge>
            )}
            <StatusBadge status={report.status} />
            <span className="font-mono text-xs text-muted-foreground">{report.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopyLink}>
            <LinkIcon className="mr-1 h-4 w-4" />
            Copy link
          </Button>
          {onCopyMarkdown && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCopyMarkdown}>
                <Copy className="mr-1 h-4 w-4" />
                Copy as Markdown
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownload}>
                <Download className="mr-1 h-4 w-4" />
                Download .md
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
