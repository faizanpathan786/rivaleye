import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { PlatformIcon } from "./platform-icon";
import { retryPlatform, cancelReport } from "@/api/reports";
import { useCreateReportMutation } from "@/hooks/queries/use-reports";
import type {
  CreateReportPayload,
  ReportProgress,
  ReportProgressEvent,
  ReportProgressPlatform,
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

const PIPELINE_STEPS: { id: string; label: string }[] = [
  { id: "queued", label: "Queued in pipeline" },
  { id: "scraping", label: "Scraping platforms" },
  { id: "clustering", label: "Clustering cross-platform complaints" },
  { id: "done", label: "Report ready" },
];

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] ?? p;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

function eventColor(ev: ReportProgressEvent): string {
  if (ev.event === "failed") return "var(--destructive)";
  if (ev.event === "completed") return "var(--pos, #22c55e)";
  if (ev.event === "retrying") return "var(--warning, #f59e0b)";
  return "var(--accent)";
}

function eventLine(ev: ReportProgressEvent): string {
  const when = new Date(ev.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const platform = ev.platform ? `${ev.platform}:` : "";
  const dur = ev.duration_ms != null ? ` (${ev.duration_ms}ms)` : "";
  return `[${when}] ${platform}${ev.stage} → ${ev.event}${dur}`;
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
        style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 500, letterSpacing: "-0.02em" }}
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
  const qc = useQueryClient();

  const name =
    report.primary_competitor_name ?? report.competitors[0] ?? "Report";

  const platforms = progress?.platforms ?? [];
  const events = progress?.events ?? [];
  const metrics = progress?.metrics ?? {
    mentions: 0,
    comments: 0,
    quotes: 0,
    complaints: 0,
  };

  const stage = report.stage ?? "queued";
  const status = progress?.report.status ?? report.status ?? "queued";
  const done = status === "completed";
  const failed = status === "failed";
  const cancelled = status === "cancelled";

  const counts = useMemo(() => {
    return platforms.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [platforms]);

  const activePlatforms = platforms.filter((p) => p.status === "running");
  const activeSub =
    activePlatforms.length > 0
      ? activePlatforms.map((p) => platformLabel(p.platform)).join(" · ")
      : `${counts["completed"] ?? 0}/${platforms.length} platforms complete`;

  const stepStates = useMemo(() => {
    const completedCount = counts["completed"] ?? 0;
    const failedCount = counts["failed"] ?? 0;
    const cancelledCount = counts["cancelled"] ?? 0;
    const finishedScrape =
      platforms.length > 0 &&
      completedCount + failedCount + cancelledCount >= platforms.length;
    return PIPELINE_STEPS.map((step) => {
      let state: "done" | "active" | "pending" = "pending";
      if (step.id === "queued") {
        state =
          platforms.length > 0 || stage !== "queued"
            ? "done"
            : status === "queued"
              ? "active"
              : "done";
      } else if (step.id === "scraping") {
        state = finishedScrape
          ? "done"
          : (counts["running"] ?? 0) > 0 || (counts["queued"] ?? 0) > 0
            ? "active"
            : "pending";
      } else if (step.id === "clustering") {
        state =
          stage === "done" || done
            ? "done"
            : stage === "clustering" || (finishedScrape && !done && !failed && !cancelled)
              ? "active"
              : "pending";
      } else if (step.id === "done") {
        state = done ? "done" : "pending";
      }
      return { ...step, state };
    });
  }, [platforms, counts, stage, status, done, failed, cancelled]);

  const totalSteps = PIPELINE_STEPS.length;
  const doneSteps = stepStates.filter((s) => s.state === "done").length;
  const activeIdx = stepStates.findIndex((s) => s.state === "active");
  const progressFrac = done || cancelled
    ? 1
    : Math.min(1, (doneSteps + (activeIdx >= 0 ? 0.5 : 0)) / totalSteps);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);


  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(report.created_at).getTime()) / 1000),
  );

  const retryMutation = useMutation<void, unknown, string>({
    mutationFn: (platform) => retryPlatform(report.id, platform),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["report-progress", report.id],
      });
    },
  });

  const cancelMutation = useMutation<void, unknown, void>({
    mutationFn: () => cancelReport(report.id),
    onSuccess: () => {
      navigate("/");
    },
  });

  const rescanMutation = useCreateReportMutation();

  const startRescan = () => {
    const scanPlatforms =
      platforms.length > 0
        ? platforms.map((p) => p.platform)
        : report.failed_platforms;
    const payload: CreateReportPayload = {
      category: report.category,
      competitors: report.competitors,
      target_audience: report.audience ?? "",
      founder_goal: report.goal,
      selected_platforms: scanPlatforms,
      ...(report.primary_competitor_domain
        ? { website_url: report.primary_competitor_domain }
        : {}),
    };
    rescanMutation.mutate(payload, {
      onSuccess: (res) => {
        navigate(`/scan-report/${res.id}`);
      },
      onError: (err) => {
        const message = err && typeof err === "object" && "message" in err
          ? String((err as Record<string, unknown>).message)
          : err instanceof Error
            ? err.message
            : String(err);
        toast.error(message || "Failed to start rescan. Please try again.");
      },
    });
  };

  return (
    <div className="px-4 pt-4 pb-10 md:px-7 md:pt-5 w-full" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="re-eyebrow">
            {done ? "SCAN COMPLETE" : failed ? "SCAN FAILED" : cancelled ? "SCAN CANCELLED" : "SCAN IN PROGRESS"}
          </div>
          <h1 className="re-h1 mt-1.5 flex items-center gap-3 min-w-0 break-words">
            <span className="min-w-0 break-words">{name}</span>
            {!done && !failed && !cancelled && (
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
        <div className="flex flex-shrink-0 gap-2 self-start sm:self-auto">
          {failed && (
            <button
              className="re-btn"
              onClick={startRescan}
              disabled={rescanMutation.isPending}
            >
              <Icon name="refresh" size={14} /> {rescanMutation.isPending ? "Starting…" : "Rescan"}
            </button>
          )}
          <button
            className="re-btn"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending || done || failed || cancelled}
          >
            <Icon name="x" size={14} /> {cancelMutation.isPending ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LiveCount label="Mentions found" v={metrics.mentions} />
        <LiveCount label="Comments parsed" v={metrics.comments} />
        <LiveCount label="Quotes extracted" v={metrics.quotes} />
        <LiveCount label="Complaints clustered" v={metrics.complaints} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              {platforms.length === 0 ? (
                <div className="col-span-2 text-[12px] text-fg-faint">
                  Waiting for jobs…
                </div>
              ) : (
                platforms.map((p) => (
                  <PlatformPill
                    key={p.platform}
                    platform={p}
                    onRetry={() => retryMutation.mutate(p.platform)}
                    retrying={
                      retryMutation.isPending &&
                      retryMutation.variables === p.platform
                    }
                  />
                ))
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
            className="font-mono-feat overflow-y-auto overflow-x-hidden p-3.5 h-60 sm:h-[360px]"
            style={{
              fontSize: 11.5,
              lineHeight: 1.6,
              color: "var(--fg-muted)",
            }}
          >
            {events.length === 0 ? (
              <div className="text-fg-faint">Waiting for events…</div>
            ) : (
              events.map((ev, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="flex-shrink-0" style={{ color: "var(--fg-faint)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="flex-1 min-w-0 break-words"
                    style={{ color: eventColor(ev) }}
                  >
                    {eventLine(ev)}
                  </span>
                </div>
              ))
            )}
            {!done && !failed && !cancelled && (
              <div className="flex gap-2.5">
                <span style={{ color: "var(--fg-faint)" }}>
                  {String(events.length + 1).padStart(2, "0")}
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
        <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono-feat text-[11px]">
          <span className="text-fg-faint flex-shrink-0">
            ELAPSED {Math.floor(elapsed / 60)}m {elapsed % 60}s
          </span>
          {done ? (
            <span style={{ color: "var(--pos, #22c55e)" }}>
              ✓ scan complete — opening report
            </span>
          ) : failed ? (
            <span className="min-w-0 break-words" style={{ color: "var(--destructive)" }}>
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

function PlatformPill({
  platform,
  onRetry,
  retrying,
}: {
  platform: ReportProgressPlatform;
  onRetry: () => void;
  retrying: boolean;
}) {
  const tone =
    platform.status === "completed"
      ? "var(--pos, #22c55e)"
      : platform.status === "running"
        ? "var(--accent)"
        : platform.status === "failed"
          ? "var(--destructive)"
          : "var(--fg-faint)";
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg, transparent)",
      }}
      title={platform.last_error ?? platform.status}
    >
      <span style={{ color: tone }}>
        <PlatformIcon id={platform.platform} active size={14} />
      </span>
      <span className="text-[11.5px] truncate flex-1">
        {platformLabel(platform.platform)}
      </span>
      {platform.status === "running" && (
        <span
          className="block animate-pulse rounded-full"
          style={{ width: 5, height: 5, background: tone }}
        />
      )}
      {platform.status === "completed" && (
        <Icon name="check" size={10} className="text-fg-faint" />
      )}
      {platform.status === "failed" && (
        <button
          className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            color: "var(--destructive)",
            background: "color-mix(in srgb, var(--destructive) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--destructive) 30%, transparent)",
          }}
          onClick={onRetry}
          disabled={retrying}
          title="Retry this platform"
        >
          <svg width={9} height={9} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8a6 6 0 1 0 1.8-4.3M2 3v3h3"/>
          </svg>
          {retrying ? "…" : "retry"}
        </button>
      )}
    </div>
  );
}
