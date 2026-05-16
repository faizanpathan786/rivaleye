import type { PainReportOutput } from "@rivaleye/shared";

export function ProductOpportunitiesSection({ productOpportunities }: { productOpportunities?: PainReportOutput["productOpportunities"] }) {
  if (!productOpportunities?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Product Opportunities</h2>
      <ol className="space-y-2">
        {productOpportunities.map((opp, i) => (
          <li key={i} className="flex gap-3 text-base">
            <span className="font-mono text-primary shrink-0 tabular-nums">{i + 1}.</span>
            <span>{opp}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
