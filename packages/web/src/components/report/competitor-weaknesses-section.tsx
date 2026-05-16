import type { PainReportOutput } from "@rivaleye/shared";

export function CompetitorWeaknessesSection({ competitorWeaknesses }: { competitorWeaknesses?: PainReportOutput["competitorWeaknesses"] }) {
  if (!competitorWeaknesses?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Competitor Weaknesses</h2>
      <ul className="space-y-1">
        {competitorWeaknesses.map((weakness, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-border shrink-0">·</span>
            <span>{weakness}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
