import { QuoteCard } from "./quote-card";
import type { PainReportOutput } from "@rivaleye/shared";

export function VoiceOfCustomerSection({ voiceOfCustomer }: { voiceOfCustomer?: PainReportOutput["voiceOfCustomer"] }) {
  if (!voiceOfCustomer?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">Voice of Customer</h2>
      <div className="space-y-2">
        {voiceOfCustomer.map((quote, i) => (
          <QuoteCard key={i} quote={quote} />
        ))}
      </div>
    </section>
  );
}
