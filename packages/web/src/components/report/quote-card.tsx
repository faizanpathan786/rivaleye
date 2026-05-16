import type { QuoteRow } from "@/api/reports";

export function QuoteCard({ quote }: { quote: QuoteRow }) {
  const sentimentTone =
    quote.sentiment > 0.1
      ? "text-emerald-500"
      : quote.sentiment < -0.1
        ? "text-rose-500"
        : "text-muted-foreground";

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{quote.who}</span>
        {quote.sub ? <span>· {quote.sub}</span> : null}
        {quote.when_label ? <span>· {quote.when_label}</span> : null}
        <span className="ml-auto flex items-center gap-2">
          <span className="font-mono tabular-nums">{quote.score}</span>
          <span className={`font-mono tabular-nums ${sentimentTone}`}>
            {quote.sentiment > 0 ? "+" : ""}
            {quote.sentiment.toFixed(2)}
          </span>
        </span>
      </div>
      <div className="text-sm leading-relaxed">
        <span className="mr-1 font-mono text-lg text-muted-foreground">
          &ldquo;
        </span>
        {quote.text}
      </div>
    </div>
  );
}
