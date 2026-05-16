import { pickAnswerHeroData } from "@/lib/report-output";
import type { PainReportOutput } from "@rivaleye/shared";

export function AnswerHero({ output }: { output: PainReportOutput }) {
  const { topOpportunities, positioningAngle, wedge } = pickAnswerHeroData(output);

  if (!topOpportunities.length && !positioningAngle && !wedge) {
    const fallback = output.painClusters?.[0]?.title;
    if (!fallback) return null;
    return (
      <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-6">
        <p className="text-sm font-mono text-muted-foreground">Top finding</p>
        <p className="mt-1 text-lg font-medium">{fallback}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-6 space-y-4">
      {topOpportunities.length > 0 && (
        <div>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Top 3 Opportunities
          </p>
          <ol className="space-y-1">
            {topOpportunities.map((opp, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="font-mono text-primary shrink-0">{i + 1}→</span>
                <span>{opp}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {positioningAngle && (
        <div>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">
            Strongest Positioning Angle
          </p>
          <p className="text-sm">{positioningAngle}</p>
        </div>
      )}
      {wedge && (
        <div>
          <p className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">
            Best Wedge
          </p>
          <p className="text-sm">{wedge}</p>
        </div>
      )}
    </div>
  );
}
