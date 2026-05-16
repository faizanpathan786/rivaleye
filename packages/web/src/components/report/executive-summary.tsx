export function ExecutiveSummary({ summary }: { summary?: string }) {
  if (!summary) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">Summary</h2>
      <p className="text-muted-foreground leading-relaxed">{summary}</p>
    </section>
  );
}
