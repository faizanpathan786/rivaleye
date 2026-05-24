/**
 * ScoreFactors
 *
 * Renders an ordered horizontal bar chart for a fixed-key factor object
 * (e.g. `OpportunityScore.factors` from the doc-16 contract).
 *
 * Each key is humanised for display:
 *   `pain_frequency` → "Pain frequency"
 *   `gap_severity`   → "Gap severity"
 *   etc.
 *
 * Bars are sorted descending by value so the most influential factor appears
 * first.  There is intentionally no per-factor colour (`tone` was a mock
 * invention removed in Phase 5b).  A single accent colour (the project's
 * `--accent` token) is used for all bars.
 *
 * @param factors - A `Record<string, number>` where each value is 0–1.
 * @param className - Optional extra class names for the container.
 *
 * @example
 *   <ScoreFactors factors={{ pain_frequency: 0.81, gap_severity: 0.72 }} />
 */

import { cn } from "@/lib/utils";

export type ScoreFactorsProps = {
  factors: Record<string, number>;
  className?: string;
};

/** Replaces underscores with spaces and capitalises the first letter. */
function humaniseKey(key: string): string {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function ScoreFactors({ factors, className }: ScoreFactorsProps) {
  const sorted = Object.entries(factors).sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {sorted.map(([key, value]) => {
        const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
        return (
          <div key={key} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-xs text-[var(--fg-muted)]">
              <span>{humaniseKey(key)}</span>
              <span className="tabular-nums font-medium text-[var(--fg)]">
                {pct}%
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full bg-[var(--bg-sunken)] overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={humaniseKey(key)}
            >
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
