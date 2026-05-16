import type { PainReportOutput } from "@rivaleye/shared";

export function PricingPainSection({ pricingPain }: { pricingPain?: PainReportOutput["pricingPain"] }) {
  if (!pricingPain) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">Pricing Pain</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{pricingPain}</p>
    </section>
  );
}
