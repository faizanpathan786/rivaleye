type Stage = "queued" | "running" | "clustering" | "completed" | "failed" | string;

export function StageIndicator({ stage, status }: { stage?: Stage; status?: string }) {
  if (status === "completed" || status === "failed") return null;

  const steps = ["Queued", "Scraping Reddit", "Clustering"];
  const activeStep = stage === "clustering" ? 2 : stage === "scraping" ? 1 : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-mono ${
              i < activeStep
                ? "bg-primary text-primary-foreground"
                : i === activeStep
                  ? "bg-accent text-accent-foreground ring-2 ring-accent/50"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < activeStep ? "✓" : i + 1}
          </div>
          <span className={i === activeStep ? "text-foreground" : "text-muted-foreground"}>
            {step}
          </span>
          {i < steps.length - 1 && <span className="text-border">—</span>}
        </div>
      ))}
    </div>
  );
}
