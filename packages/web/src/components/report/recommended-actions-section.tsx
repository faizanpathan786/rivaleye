import type { PainReportOutput } from "@rivaleye/shared";

export function RecommendedActionsSection({ recommendedActions }: { recommendedActions?: PainReportOutput["recommendedActions"] }) {
  if (!recommendedActions?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Recommended Next Actions</h2>
      <ol className="space-y-2">
        {recommendedActions.map((action, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="font-mono text-muted-foreground shrink-0 tabular-nums">{i + 1}.</span>
            <span>{action}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
