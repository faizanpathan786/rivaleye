export function QuoteCard({ quote }: { quote: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <span className="mr-1 font-mono text-lg text-muted-foreground">&ldquo;</span>
      <span className="text-sm">{quote}</span>
    </div>
  );
}
