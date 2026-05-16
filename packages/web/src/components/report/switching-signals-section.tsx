import type { PainReportOutput } from "@rivaleye/shared";

export function SwitchingSignalsSection({ switchingSignals }: { switchingSignals?: PainReportOutput["switchingSignals"] }) {
  if (!switchingSignals?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Switching Signals</h2>
      <ul className="space-y-1">
        {switchingSignals.map((signal, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-border shrink-0">·</span>
            <span>{signal}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
