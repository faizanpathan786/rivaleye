import { useReportsQuery } from "@/hooks/queries/use-reports";
import {
  HistoryTable,
  HistoryTableSkeleton,
} from "@/components/history/history-table";
import { EmptyState } from "@/components/history/empty-state";
import { ClearHistoryButton } from "@/components/history/clear-history-button";

export function HistoryPage() {
  const { data, isLoading, isError, error } = useReportsQuery();

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="re-eyebrow">HISTORY</div>
          <h1 className="re-h1" style={{ marginTop: 8 }}>
            Scan history
          </h1>
          <p className="text-fg-muted" style={{ marginTop: 6 }}>
            Every scan you've run. Re-run, archive, or export.
          </p>
        </div>
        <ClearHistoryButton />
      </div>

      <div className="re-card" style={{ marginTop: 18 }}>
        {isLoading ? (
          <HistoryTableSkeleton />
        ) : isError ? (
          <div className="border border-destructive/40 bg-destructive/10 text-destructive p-4 text-sm rounded-md">
            Failed to load scan history
            {error instanceof Error ? `: ${error.message}` : "."}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState />
        ) : (
          <HistoryTable rows={data} />
        )}
      </div>
    </div>
  );
}
