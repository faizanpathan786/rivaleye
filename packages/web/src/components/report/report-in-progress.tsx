import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { PlatformIcon } from "./platform-icon";
import type {
  ReportPlatformJob,
  ReportProgress,
  ReportRow,
} from "@/api/reports";

const PLATFORM_LABELS: Record<string, string> = {
  reddit: "Reddit",
  g2: "G2",
  capterra: "Capterra",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  producthunt: "Product Hunt",
  appstore: "App Store",
  playstore: "Play Store",
  gmaps: "Google Maps",
  trustpilot: "Trustpilot",
  youtube: "YouTube",
  hn: "Hacker News",
  hackernews: "Hacker News",
  devto: "Dev.to",
  medium: "Medium",
};

const PIPELINE_STEPS: { id: string; label: string; matches: string[] }[] = [
  { id: "queued", label: "Queued in pipeline", matches: ["queued"] },
  { id: "scraping", label: "Scraping platforms", matches: ["scraping"] },
  { id: "clustering", label: "Clustering cross-platform complaints", matches: ["clustering"] },
  { id: "done", label: "Report ready", matches: ["done", "completed"] },
];

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] ?? p;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function buildLogLines(
  jobs: ReportPlatformJob[],
  stage: string,
  status: string,
  startedAt: string,
): string[] {
  const lines: string[] = [];
  const t0 = new Date(startedAt).getTime();
  const stamp = (d: Date | null) => {
    if (!d) return "00:00";
    const ms = d.getTime() - t0;
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  lines.push(`[boot] pipeline initialised for report`);
  lines.push(`[boot] enqueued ${jobs.length} platform scrape jobs`);

  for (const j of jobs) {
    const label = platformLabel(j.platform);
    if (j.started_at) {
      lines.push(`[${stamp(new Date(j.started_at))}] scrape:${j.platform} → running`);
      lines.push(`        ${label} extractor + summariser dispatched`);
    }
    if (j.status === "completed" && j.completed_at) {
      lines.push(`[${stamp(new Date(j.completed_at))}] scrape:${j.platform} → completed`);
    }
    if (j.status === "failed") {
      lines.push(`[${stamp(new Date(j.completed_at ?? j.started_at ?? startedAt))}] scrape:${j.platform} → FAILED`);
      if (j.error) lines.push(`        err: ${j.error}`);
    }
  }

  if (stage === "clustering") {
    lines.push(`[stage] merging per-platform briefs → cross-platform clusters`);
  }
  if (status === "completed") {
    lines.push(`[done] report persisted → opening`);
  }
  if (status === "failed") {
    lines.push(`[fail] pipeline halted`);
  }
  return lines;
}

function StepRow({
  state,
  label,
  sub,
}: {
  state: "done" | "active" | "pending";
  label: string;
  sub?: string;
}) {
  return (
    <div
      className="flex items-center gap-2.5 transition-opacity duration-200"
      style={{ opacity: state === "pending" ? 0.4 : 1 }}
    >
      <span
        className="grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full"
        style={{
          background:
            state === "done"
              ? "var(--pos, #22c55e)"
              : state === "active"
                ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                : "var(--surface-2)",
          color: state === "done" ? "#fff" : "var(--accent)",
          border: state === "active" ? "1px solid var(--accent)" : "0",
        }}
      >
        {state === "done" ? (
          <Icon name="check" size={11} />
        ) : state === "active" ? (
          <span
            className="block animate-pulse rounded-full"
            style={{ width: 5, height: 5, background: "var(--accent)" }}
          />
        ) : null}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="truncate text-[13px]"
          style={{ fontWeight: state === "active" ? 500 : 400 }}
        >
          {label}
        </div>
        {sub && state === "active" && (
          <div className="font-mono-feat text-[11px] text-fg-faint mt-0.5 truncate">
            {sub}
          </div>
        )}
      </div>
      {state === "active" && (
        <span
          className="font-mono-feat text-[11px] animate-pulse"
          style={{ color: "var(--accent)" }}
        >
          running
        </span>
      )}
    </div>
  );
}

function LiveCount({ label, v }: { label: string; v: number }) {
  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
    >
      <div className="re-eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div
        className="font-mono-feat mt-1 tabular-nums"
        style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em" }}
      >
        {fmtNum(v)}
      </div>
    </div>
  );
}

export function ReportInProgress({
  report,
  progress,
}: {
  report: ReportRow;
  progress: ReportProgress | undefined;
}) {
  const navigate = useNavigate();
  const name =
    report.primary_competitor_name ?? report.competitors[0] ?? "Report";
  const jobs = progress?.jobs ?? [];
  const counts = progress?.counts ?? {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
  const metrics = progress?.metrics ?? {
    threads: 0,
    comments: 0,
    quotes: 0,
    complaints: 0,
  };
  const stage = report.stage ?? "queued";
  const status = report.status ?? "queued";
  const done = status === "completed";
  const failed = status === "failed";

  const activePlatforms = jobs.filter((j) => j.status === "running");
  const activeSub =
    activePlatforms.length > 0
      ? activePlatforms.map((j) => platformLabel(j.platform)).join(" · ")
      : `${counts.completed}/${jobs.length} platforms complete`;

  const stepStates = useMemo(() => {
    const finishedScrape = jobs.length > 0 && counts.completed + counts.failed >= jobs.length;
    return PIPELINE_STEPS.map((step) => {
      let state: "done" | "active" | "pending" = "pending";
      if (step.id === "queued") {
        state =
          jobs.length > 0 || stage !== "queued"
            ? "done"
            : status === "queued"
              ? "active"
              : "done";
      } else if (step.id === "scraping") {
        state = finishedScrape
          ? "done"
          : counts.running > 0 || counts.queued > 0
            ? "active"
            : "pending";
      } else if (step.id === "clustering") {
        state =
          stage === "done" || done
            ? "done"
            : stage === "clustering" || (finishedScrape && !done && !failed)
              ? "active"
              : "pending";
      } else if (step.id === "done") {
        state = done ? "done" : "pending";
      }
      return { ...step, state };
    });
  }, [jobs, counts, stage, status, done, failed]);

  const totalSteps = PIPELINE_STEPS.length;
  const doneSteps = stepStates.filter((s) => s.state === "done").length;
  const activeIdx = stepStates.findIndex((s) => s.state === "active");
  const progressFrac = done
    ? 1
    : Math.min(1, (doneSteps + (activeIdx >= 0 ? 0.5 : 0)) / totalSteps);

  const logLines = useMemo(
    () => buildLogLines(jobs, stage, status, report.created_at),
    [jobs, stage, status, report.created_at],
  );
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate(0), 600);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(report.created_at).getTime()) / 1000),
  );

  return (
    <div style={{ padding: "20px 28px 48px", maxWidth: 1080, margin: "0 auto" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="re-eyebrow">
            {done ? "SCAN COMPLETE" : failed ? "SCAN FAILED" : "SCAN IN PROGRESS"}
          </div>
          <h1 className="re-h1 mt-1.5 flex items-center gap-3">
            {name}
            {!done && !failed && (
              <span
                className="inline-block animate-pulse rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: failed ? "var(--destructive)" : "var(--accent)",
                }}
              />
            )}
          </h1>
        </div>
        <button
          className="re-btn"
          onClick={() => navigate("/")}
          disabled={done}
        >
          <Icon name="x" size={14} /> {done ? "Opening…" : "Cancel"}
        </button>
      </div>

      <div className="mt-7 grid grid-cols-4 gap-3">
        <LiveCount label="Threads scanned" v={metrics.threads} />
        <LiveCount label="Comments parsed" v={metrics.comments} />
        <LiveCount label="Quotes extracted" v={metrics.quotes} />
        <LiveCount label="Complaints clustered" v={metrics.complaints} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div
          className="rounded-lg border"
          style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <h3 className="text-[13px] font-medium">Pipeline</h3>
            <span className="font-mono-feat tabular-nums text-[11px] text-fg-faint">
              {Math.round(progressFrac * 100)}%
            </span>
          </div>
          <div className="flex flex-col gap-2.5 p-4">
            {stepStates.map((s) => (
              <StepRow
                key={s.id}
                state={s.state}
                label={s.label}
                sub={s.id === "scraping" ? activeSub : undefined}
              />
            ))}
          </div>

          <div
            className="border-t p-4"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <div className="re-eyebrow mb-2.5" style={{ fontSize: 10 }}>
              Per-platform
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {jobs.length === 0 ? (
                <div className="col-span-2 text-[12px] text-fg-faint">
                  Waiting for jobs…
                </div>
              ) : (
                jobs.map((j) => <PlatformPill key={j.platform} job={j} />)
              )}
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border"
          style={{
            borderColor: "var(--border-soft)",
            background: "var(--bg-sunken, var(--surface-2))",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "var(--border-soft)" }}
          >
            <h3 className="font-mono-feat text-[12px]">
              <span style={{ color: "var(--fg-faint)" }}>$</span> rivaleye scan
            </h3>
            <span className="font-mono-feat text-[11px] text-fg-faint">
              live log
            </span>
          </div>
          <div
            ref={logRef}
            className="font-mono-feat overflow-y-auto p-3.5"
            style={{
              fontSize: 11.5,
              lineHeight: 1.6,
              height: 360,
              color: "var(--fg-muted)",
            }}
          >
            {logLines.map((l, i) => (
              <div key={i} className="flex gap-2.5">
                <span style={{ color: "var(--fg-faint)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="flex-1"
                  style={{
                    color: l.includes("FAILED")
                      ? "var(--destructive)"
                      : l.startsWith("[done]")
                        ? "var(--pos, #22c55e)"
                        : l.startsWith("[stage]") || l.includes("→ completed")
                          ? "var(--fg)"
                          : l.includes("→ running")
                            ? "var(--accent)"
                            : "var(--fg-muted)",
                  }}
                >
                  {l}
                </span>
              </div>
            ))}
            {!done && !failed && (
              <div className="flex gap-2.5">
                <span style={{ color: "var(--fg-faint)" }}>
                  {String(logLines.length + 1).padStart(2, "0")}
                </span>
                <span className="animate-pulse">▍</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--surface-2)" }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressFrac * 100}%`,
              background: done
                ? "var(--pos, #22c55e)"
                : failed
                  ? "var(--destructive)"
                  : "var(--accent)",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono-feat text-[11px]">
          <span className="text-fg-faint">
            ELAPSED {Math.floor(elapsed / 60)}m {elapsed % 60}s
          </span>
          {done ? (
            <span style={{ color: "var(--pos, #22c55e)" }}>
              ✓ scan complete — opening report
            </span>
          ) : failed ? (
            <span style={{ color: "var(--destructive)" }}>
              ✕ pipeline failed — {report.error ?? "unknown error"}
            </span>
          ) : (
            <span className="text-fg-faint">refreshing every 2s</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformPill({ job }: { job: ReportPlatformJob }) {
  const tone =
    job.status === "completed"
      ? "var(--pos, #22c55e)"
      : job.status === "running"
        ? "var(--accent)"
        : job.status === "failed"
          ? "var(--destructive)"
          : "var(--fg-faint)";
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg, transparent)",
      }}
      title={job.error ?? job.status}
    >
      <span style={{ color: tone }}>
        <PlatformIcon id={job.platform} active size={14} />
      </span>
      <span className="text-[11.5px] truncate flex-1">
        {platformLabel(job.platform)}
      </span>
      {job.status === "running" && (
        <span
          className="block animate-pulse rounded-full"
          style={{ width: 5, height: 5, background: tone }}
        />
      )}
      {job.status === "completed" && (
        <Icon name="check" size={10} className="text-fg-faint" />
      )}
      {job.status === "failed" && (
        <Icon name="x" size={10} className="text-destructive" />
      )}
    </div>
  );
}
