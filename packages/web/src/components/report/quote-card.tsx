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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="min-w-0 break-words font-medium text-foreground">
          {quote.who}
        </span>
        {quote.sub ? (
          <span className="min-w-0 break-words">· {quote.sub}</span>
        ) : null}
        {quote.when_label ? <span>· {quote.when_label}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="font-mono tabular-nums">{quote.score}</span>
          <span className={`font-mono tabular-nums ${sentimentTone}`}>
            {quote.sentiment > 0 ? "+" : ""}
            {quote.sentiment.toFixed(2)}
          </span>
        </span>
      </div>
      <div className="text-sm leading-relaxed break-words">
        <span className="mr-1 font-mono text-lg text-muted-foreground">
          &ldquo;
        </span>
        {quote.text}
      </div>
    </div>
  );
}
