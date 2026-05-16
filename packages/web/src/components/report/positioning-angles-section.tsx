import type { PainReportOutput } from "@rivaleye/shared";

export function PositioningAnglesSection({ positioningAngles }: { positioningAngles?: PainReportOutput["positioningAngles"] }) {
  if (!positioningAngles?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Positioning Angles</h2>
      <ol className="space-y-2">
        {positioningAngles.map((angle, i) => (
          <li key={i} className="flex gap-3 text-sm text-muted-foreground">
            <span className="font-mono text-primary shrink-0 tabular-nums">{i + 1}.</span>
            <span>{angle}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
