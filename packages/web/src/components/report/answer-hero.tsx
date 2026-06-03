import type { ReportRow } from "@/api/reports";

export function AnswerHero({ report }: { report: ReportRow }) {
  const summary = report.voice_summary;
  const phrases = report.voice_phrases ?? [];
  const wedge = report.switching_net_signal;
  const pricing = report.pricing_blended;

  if (!summary && !phrases.length && !wedge && !pricing) {
    return null;
  }

  return (
    <div className="w-full min-w-0 space-y-4 rounded-lg border-l-4 border-primary bg-primary/5 p-4 md:p-6">
      {summary && (
        <div className="min-w-0">
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            What users are saying
          </p>
          <p className="text-sm leading-relaxed break-words">{summary}</p>
        </div>
      )}
      {phrases.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Repeated phrases
          </p>
          <ul className="space-y-1">
            {phrases.slice(0, 3).map((p, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="shrink-0 font-mono text-primary">
                  {i + 1}→
                </span>
                <span className="min-w-0 break-words italic">"{p}"</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {wedge && (
        <div className="min-w-0">
          <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Switching signal
          </p>
          <p className="text-sm break-words">{wedge}</p>
        </div>
      )}
      {pricing && (
        <div className="min-w-0">
          <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Pricing ask
          </p>
          <p className="text-sm font-mono break-words">{pricing}</p>
        </div>
      )}
    </div>
  );
}
