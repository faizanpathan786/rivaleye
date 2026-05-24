/**
 * ConfidenceIndicator
 *
 * Renders a colour-coded badge for a doc-16 `Confidence` object:
 *   "low"    → amber  (--warn)
 *   "medium" → blue   (custom inline, keeping CSS-variable palette)
 *   "high"   → green  (--pos)
 *
 * Shows `<percent>%` inline and, when `basis` is non-null, exposes it via the
 * native `title` attribute so it appears on hover without new dependencies.
 * (No Tooltip primitive exists in the current `components/ui/` set.)
 *
 * @param confidence - A `Confidence` object from the doc-16 contract.
 *
 * @example
 *   <ConfidenceIndicator confidence={{ score: 0.71, label: "medium", basis: "68 signals" }} />
 */

import type { Confidence } from "@/lib/dashboard-helpers";
import { confidencePercent } from "@/lib/dashboard-helpers";
import { cn } from "@/lib/utils";

export type ConfidenceIndicatorProps = {
  confidence: Confidence;
  className?: string;
};

/** Tailwind classes per confidence label, using the project's CSS-variable palette. */
const LABEL_CLASSES: Record<Confidence["label"], string> = {
  low: "bg-amber-100 text-amber-800 border-amber-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-green-50 text-green-700 border-green-200",
};

export function ConfidenceIndicator({
  confidence,
  className,
}: ConfidenceIndicatorProps) {
  const pct = confidencePercent(confidence);
  const labelText =
    confidence.label.charAt(0).toUpperCase() + confidence.label.slice(1);

  return (
    <span
      title={confidence.basis ?? undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium select-none",
        LABEL_CLASSES[confidence.label],
        className,
      )}
    >
      <span>{labelText}</span>
      <span className="opacity-70">{pct}%</span>
    </span>
  );
}
