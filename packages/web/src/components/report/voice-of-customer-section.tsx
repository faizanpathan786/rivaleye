import { useReportVoiceQuery } from "@/hooks/queries/use-reports";
import type { VoiceWord } from "@/api/reports";

function WordList({
  title,
  words,
  tone,
}: {
  title: string;
  words: VoiceWord[];
  tone: "pos" | "neg";
}) {
  const accent = tone === "pos" ? "text-emerald-500" : "text-rose-500";
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-1">
        {words.map((w) => (
          <li
            key={w.word}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className={`${accent} min-w-0 break-words`}>{w.word}</span>
            <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
              {w.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VoiceOfCustomerSection({ reportId }: { reportId: string }) {
  const { data, isLoading, error } = useReportVoiceQuery(reportId);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">
        Voice of Customer
      </h2>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-20 rounded-md border border-border bg-card animate-pulse" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-md border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          Failed to load voice of customer.
        </p>
      ) : !data ||
        (!data.summary &&
          !data.phrases.length &&
          !data.positive.length &&
          !data.negative.length) ? (
        <p className="text-sm text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-4">
          {data.summary ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {data.summary}
            </p>
          ) : null}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {data.positive.length ? (
              <WordList title="Positive" words={data.positive} tone="pos" />
            ) : null}
            {data.negative.length ? (
              <WordList title="Negative" words={data.negative} tone="neg" />
            ) : null}
          </div>
          {data.phrases.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Phrases
              </h3>
              <ul className="space-y-1">
                {data.phrases.map((p, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-border shrink-0">·</span>
                    <span className="min-w-0 break-words">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
