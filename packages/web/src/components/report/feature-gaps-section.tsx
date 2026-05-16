import type { PainReportOutput } from "@rivaleye/shared";

export function FeatureGapsSection({ featureGaps }: { featureGaps?: PainReportOutput["featureGaps"] }) {
  if (!featureGaps?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Feature Gaps</h2>
      <ul className="space-y-1">
        {featureGaps.map((gap, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-border shrink-0">·</span>
            <span>{gap}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
