/**
 * EvidenceDrawer
 *
 * A modal overlay that resolves and displays evidence quotes for a dashboard
 * insight.  It intersects `refs.quote_ids` with `evidenceSection?.quotes` to
 * show only the quotes relevant to the current insight.
 *
 * Fallback: if `evidenceSection` is null/undefined, or `refs.quote_ids` is
 * empty, or no quotes match, renders "Evidence not available for this insight."
 *
 * Implementation note: no Sheet/Dialog/Tooltip primitives are currently
 * installed in `components/ui/`, so this component uses a simple fixed overlay
 * (backdrop + panel) that is fully keyboard-accessible via the close button.
 * When a Dialog/Sheet primitive is added in a later task, this component can be
 * refactored to use it without changing the external API.
 *
 * @param open            - Whether the drawer is visible.
 * @param onClose         - Called when the user dismisses the drawer.
 * @param refs            - The `EvidenceRef` from the insight being inspected.
 * @param evidenceSection - The full `EvidenceSection` for the report (may be null).
 *
 * @example
 *   <EvidenceDrawer
 *     open={drawerOpen}
 *     onClose={() => setDrawerOpen(false)}
 *     refs={insight.evidence_refs}
 *     evidenceSection={sections.evidence}
 *   />
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { EvidenceRef, EvidenceSection } from "@/lib/dashboard-helpers";
import { cn } from "@/lib/utils";

export type EvidenceDrawerProps = {
  open: boolean;
  onClose: () => void;
  refs: EvidenceRef;
  evidenceSection: EvidenceSection | null | undefined;
  className?: string;
};

export function EvidenceDrawer({
  open,
  onClose,
  refs,
  evidenceSection,
  className,
}: EvidenceDrawerProps) {
  // Close on Escape key + lock background scroll while the drawer is open so
  // the page behind it doesn't move under the overlay.
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

  // Resolve quotes: filter evidenceSection.quotes to those whose id is in
  // refs.quote_ids.
  const quotesById = evidenceSection
    ? Object.fromEntries(evidenceSection.quotes.map((q) => [q.id, q]))
    : {};

  const resolvedQuotes = refs.quote_ids.flatMap((id) => {
    const q = quotesById[id];
    return q ? [q] : [];
  });

  const hasEvidence = resolvedQuotes.length > 0;

  // Render through a portal to document.body so the fixed-position overlay is
  // anchored to the viewport, not to any transformed/filtered ancestor (which
  // would otherwise force the user to scroll to reach the drawer).
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
        role="dialog"
        aria-modal="true"
        aria-label="Evidence"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[92vw] max-w-md flex-col sm:w-full",
          "bg-[var(--surface-solid)] shadow-[var(--shadow-lg)]",
          "border-l border-[var(--border-soft)]",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3 md:px-5">
          <span className="text-sm font-semibold text-[var(--fg)]">
            Evidence
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence drawer"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--fg-muted)] hover:bg-[var(--hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {!hasEvidence ? (
            <p className="text-sm text-[var(--fg-muted)]">
              Evidence not available for this insight.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {resolvedQuotes.map((quote) => (
                <li
                  key={quote.id}
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] p-4"
                >
                  <blockquote className="mb-2 text-sm italic text-[var(--fg)] leading-relaxed break-words">
                    &ldquo;{quote.text}&rdquo;
                  </blockquote>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                    <span className="min-w-0 break-words font-medium">{quote.source}</span>
                    {quote.signal_type && (
                      <span className="rounded bg-[var(--bg-sunken)] px-1.5 py-0.5 capitalize">
                        {quote.signal_type}
                      </span>
                    )}
                    {quote.sentiment !== null && (
                      <span
                        className={
                          quote.sentiment > 0
                            ? "text-[var(--pos)]"
                            : quote.sentiment < 0
                              ? "text-[var(--neg)]"
                              : "text-[var(--neu)]"
                        }
                      >
                        {quote.sentiment > 0 ? "+" : ""}
                        {quote.sentiment.toFixed(2)}
                      </span>
                    )}
                    {quote.source_url && (
                      <a
                        href={quote.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      >
                        Source
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
