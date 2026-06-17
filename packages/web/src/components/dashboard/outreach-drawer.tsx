import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { useOutreachQuery, useRemoveOutreach } from "@/hooks/queries/use-outreach";
import { Skeleton } from "@/components/ui/skeleton";

export type OutreachDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function OutreachDrawer({ open, onClose }: OutreachDrawerProps) {
  const { data, isLoading, error } = useOutreachQuery();
  const remove = useRemoveOutreach();

  useEffect(() => {
    console.log("OutreachDrawer open state:", open);
  }, [open]);

  // Close on Escape key + lock background scroll while the drawer is open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-background shadow-lg"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Outreach</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-accent/10"
            aria-label="Close"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ height: "calc(100% - 65px)" }}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to load outreach items.</p>
          ) : !data?.length ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No saved leads yet. Click "Add to outreach" on a pricing lead in the Growth lens.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm">{item.title}</h3>
                      {item.pricing_issue && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.pricing_issue}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="re-btn re-btn-ghost re-btn-sm shrink-0"
                      onClick={() => remove.mutate(item.id)}
                      disabled={remove.isPending}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>

                  {item.suggested_pricing_angle && (
                    <p className="mt-2 text-xs">{item.suggested_pricing_angle}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {item.team_size_hint && <span>Team: {item.team_size_hint}</span>}
                    {item.budget_sensitivity && <span>Budget: {item.budget_sensitivity}</span>}
                    {item.source_url && (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-foreground"
                      >
                        Open source
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
