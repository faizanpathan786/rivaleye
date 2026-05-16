import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { useCreateReportMutation } from "@/hooks/queries/use-reports";
import type { ReportGoal } from "@rivaleye/shared";

type NavTarget = "scan" | "dashboard" | "radar" | "competitors" | "compare" | "history" | "account" | "signin";

function navPath(t: NavTarget): string {
  switch (t) {
    case "scan":        return "/scan";
    case "radar":       return "/radar";
    case "competitors": return "/competitors";
    case "compare":     return "/compare";
    case "history":     return "/history";
    case "account":     return "/account";
    case "signin":      return "/signin";
    case "dashboard":
    default:            return "/";
  }
}

// TODO(backend): platform selection isn't yet wired to a backend field on
// reports — keep as a static suggestion list until the worker supports
// per-platform fan-out config from the create payload.
const PLATFORMS = [
  { id: "reddit",      name: "Reddit",       sub: "Threads, comments, subreddits" },
  { id: "g2",          name: "G2",           sub: "Detractor reviews & 1–3★ ratings" },
  { id: "linkedin",    name: "LinkedIn",     sub: "Public posts & comments" },
  { id: "producthunt", name: "Product Hunt", sub: "Launch comments, alternatives" },
  { id: "twitter",     name: "X / Twitter",  sub: "Complaint & switching tweets" },
  { id: "youtube",     name: "YouTube",      sub: "Review videos & comments" },
  { id: "appstore",    name: "App Store",    sub: "iOS + Android low-star reviews" },
  { id: "hn",          name: "Hacker News",  sub: "Show HN, Ask HN" },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

// Goal options mirror @rivaleye/shared reportGoalSchema enum values.
const GOALS: { id: ReportGoal; label: string; hint: string }[] = [
  { id: "validate_idea",       label: "Validate an idea",         hint: "Focus on pain intensity & market demand" },
  { id: "find_weaknesses",     label: "Find competitor weakness", hint: "Where to attack · wedge angles" },
  { id: "improve_positioning", label: "Improve positioning",      hint: "Messaging angles · copy ideas" },
  { id: "decide_mvp_features", label: "Decide MVP features",      hint: "Feature gaps · repeated requests" },
  { id: "find_user_pain",      label: "Find user pain",           hint: "Surface verbatim complaints" },
];

// TODO(backend): time range is not part of CreateReportPayload yet — kept
// as a UI suggestion until the worker supports a time-window filter.
const RANGES = [
  { v: "30d", l: "30 days" },
  { v: "90d", l: "90 days" },
  { v: "1y",  l: "1 year" },
  { v: "all", l: "All time" },
] as const;

// TODO(backend): analysis depth is not part of CreateReportPayload — kept
// as a UI suggestion until the worker supports tiered LLM passes.
const DEPTHS = [
  { v: "fast",     l: "Fast",     d: "Sentiment + top complaints" },
  { v: "standard", l: "Standard", d: "+ feature gaps & switching" },
  { v: "deep",     l: "Deep",     d: "+ quote extraction, threading" },
] as const;

export function ScanPage() {
  const navigate = useNavigate();
  const onNav = (t: NavTarget) => navigate(navPath(t));

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [range, setRange] = useState<string>("90d");
  const [platforms, setPlatforms] = useState<Record<PlatformId, boolean>>({
    reddit: true, g2: true, linkedin: true, producthunt: true,
    twitter: true, youtube: false, appstore: false, hn: false,
  });
  const [goal, setGoal] = useState<ReportGoal>("find_weaknesses");
  const [depth, setDepth] = useState<string>("standard");

  const { mutateAsync, isPending, error } = useCreateReportMutation();

  const selectedPlatformCount = Object.values(platforms).filter(Boolean).length;
  const goalLabel = GOALS.find((g) => g.id === goal)?.label.toLowerCase() ?? "";
  const rangeLabel = RANGES.find((r) => r.v === range)?.l ?? "";

  const canSubmit =
    !isPending &&
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    audience.trim().length > 0;

  const start = async () => {
    if (!canSubmit) return;
    try {
      const res = await mutateAsync({
        category: category.trim(),
        competitors: [name.trim()],
        target_audience: audience.trim(),
        founder_goal: goal,
      });
      navigate(`/reports/${res.id}`);
    } catch {
      // surfaced via `error` below
    }
  };

  const errorMessage =
    error instanceof Error ? error.message : error ? "Failed to start scan" : null;

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 880, margin: "0 auto" }}>
      <div className="re-eyebrow">NEW SCAN</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>Run a competitor scan</h1>
      <p className="text-fg-muted" style={{ marginTop: 8, maxWidth: 580 }}>
        Point RivalEye at a competitor. We pull complaints, switching signals,
        feature gaps, and high-intent leads from every platform you select,
        cluster the themes, and hand you an intel report.
      </p>

      <Step n={1} label="Competitor">
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            background: "var(--surface)",
            padding: "0 12px",
            height: 44,
          }}>
            <Icon name="search" size={16} className="text-fg-faint" />
            <input
              className="re-input"
              style={{
                flex: 1, border: 0, height: "100%", padding: 0,
                fontSize: 15, background: "transparent",
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Competitor name or domain (e.g. Linear)"
            />
          </div>
          <input
            className="re-input"
            style={{ height: 44, fontSize: 15 }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Project management)"
          />
        </div>
      </Step>

      <Step n={2} label="Target audience">
        <input
          className="re-input"
          style={{ height: 44, fontSize: 15, width: "100%" }}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="Who are you building for? (e.g. early-stage B2B SaaS founders)"
        />
        <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginTop: 8 }}>
          Used to focus the LLM on pain points relevant to your audience.
        </div>
      </Step>

      <Step n={3} label="What are you trying to learn?">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {GOALS.map((g) => {
            const active = goal === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className="re-btn"
                style={{
                  flexDirection: "column", alignItems: "flex-start",
                  padding: 12, height: "auto", gap: 4,
                  borderColor: active ? "var(--fg)" : "var(--border-strong)",
                  background: active ? "var(--surface-2)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{g.label}</span>
                  {active && <div style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)" }} />}
                </div>
                <span className="text-fg-muted" style={{ fontSize: 11, fontWeight: 400, textAlign: "left", lineHeight: 1.4 }}>
                  {g.hint}
                </span>
              </button>
            );
          })}
        </div>
        <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginTop: 8 }}>
          We tune the report sections and ranking to match your goal.
        </div>
      </Step>

      <Step n={4} label="Time range">
        <div style={{ display: "flex", gap: 8 }}>
          {RANGES.map((r) => (
            <button
              key={r.v}
              className={`re-btn ${range === r.v ? "re-btn-primary" : ""}`}
              onClick={() => setRange(r.v)}
              style={{ height: 36 }}
            >
              {r.l}
            </button>
          ))}
        </div>
      </Step>

      <Step n={5} label="Platforms to scan">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {PLATFORMS.map((p) => {
            const on = platforms[p.id];
            return (
              <button
                key={p.id}
                onClick={() => setPlatforms((s) => ({ ...s, [p.id]: !s[p.id] }))}
                className="re-btn"
                style={{
                  justifyContent: "space-between",
                  background: on ? "var(--accent-soft)" : "var(--surface)",
                  borderColor: on ? "var(--accent)" : "var(--border-strong)",
                  color: on ? "var(--accent)" : "var(--fg)",
                  height: 52,
                  padding: "0 12px",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                  <PlatformIcon id={p.id} active={on} />
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    <span className="text-fg-muted" style={{ fontSize: 11, fontWeight: 400 }}>{p.sub}</span>
                  </span>
                </span>
                {on && <Icon name="check" size={14} />}
              </button>
            );
          })}
        </div>
        <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginTop: 8 }}>
          ESTIMATED {selectedPlatformCount * 220}+ items · cost ≈ {selectedPlatformCount} scan credits
        </div>
      </Step>

      <Step n={6} label="Analysis depth">
        <div style={{ display: "flex", gap: 8 }}>
          {DEPTHS.map((d) => {
            const active = depth === d.v;
            return (
              <button
                key={d.v}
                onClick={() => setDepth(d.v)}
                className="re-btn"
                style={{
                  flex: 1,
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: 14,
                  height: "auto",
                  gap: 4,
                  borderColor: active ? "var(--fg)" : "var(--border-strong)",
                  background: active ? "var(--surface-2)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{d.l}</span>
                  {active && <div style={{ width: 10, height: 10, borderRadius: 99, background: "var(--accent)" }} />}
                </div>
                <span className="text-fg-muted" style={{ fontSize: 11, fontWeight: 400, textAlign: "left", lineHeight: 1.4 }}>
                  {d.d}
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      {errorMessage && (
        <div
          role="alert"
          style={{
            marginTop: 20,
            padding: "12px 16px",
            background: "var(--neg-soft, var(--surface))",
            border: "1px solid var(--neg, var(--border-strong))",
            borderRadius: 8,
            color: "var(--neg, var(--fg))",
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{
        marginTop: 32,
        padding: "16px 20px",
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>READY TO RUN</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            <b>{name || "—"}</b> · {goalLabel} · {rangeLabel} · {selectedPlatformCount} platforms · {depth}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="re-btn" onClick={() => onNav("dashboard")} disabled={isPending}>
            Cancel
          </button>
          <button
            className="re-btn re-btn-accent"
            onClick={start}
            disabled={!canSubmit}
            style={{ height: 36 }}
          >
            {isPending ? (
              <>Starting…</>
            ) : (
              <>Run scan <Icon name="arrow-right" size={14} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span className="font-mono-feat tnum" style={{
          width: 22, height: 22, borderRadius: 99,
          background: "var(--surface-2)",
          border: "1px solid var(--border-soft)",
          display: "grid", placeItems: "center",
          fontSize: 11, color: "var(--fg-muted)",
        }}>{n}</span>
        <h3 className="re-h3">{label}</h3>
      </div>
      {children}
    </section>
  );
}

function PlatformIcon({ id, active }: { id: PlatformId; active: boolean }) {
  const color = active ? "currentColor" : "var(--fg-muted)";
  const s = { width: 18, height: 18, color } as const;
  switch (id) {
    case "reddit":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="9" r="5.5" />
          <circle cx="6" cy="9" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="10" cy="9" r="0.9" fill="currentColor" stroke="none" />
          <path d="M5.5 11.2c.7.6 1.6 1 2.5 1s1.8-.4 2.5-1" strokeLinecap="round" />
          <circle cx="13" cy="6" r="1.2" />
          <path d="M12 5.2 9.5 2.5" strokeLinecap="round" />
        </svg>
      );
    case "g2":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <path d="M5.8 6.2c.3-.7 1.1-1.2 2-1.2 1.1 0 2 .7 2 1.7 0 .8-.4 1.3-1.2 1.9-.9.6-1.6 1.1-1.6 1.9v.6h2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="currentColor">
          <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <rect x="3.5" y="6" width="1.6" height="6" />
          <circle cx="4.3" cy="4.3" r="0.9" />
          <path d="M6.8 6h1.5v.8c.3-.5.9-.9 1.7-.9 1.3 0 1.9.8 1.9 2.2V12h-1.6V8.5c0-.8-.3-1.2-.9-1.2s-1.1.4-1.1 1.3V12H6.8V6Z" />
        </svg>
      );
    case "producthunt":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <path d="M6.5 11.5V4.5h2.2c1.1 0 2 .8 2 1.9 0 1-.9 1.9-2 1.9H6.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "twitter":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="currentColor">
          <path d="M11.5 2h2L9.4 7l4.6 7h-3.7l-3-4.5L4 14H2l4.4-5.2L2 2h3.8l2.8 4.1L11.5 2Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="3.5" width="13" height="9" rx="2" />
          <path d="M6.8 6 10 8l-3.2 2V6Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "appstore":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M11 4.6c-.6 0-1.5.4-2 .4-.6 0-1.4-.4-2.1-.4-1.2 0-2.3.9-2.3 2.7 0 1.1.3 2.3.9 3.4.6 1 1.1 1.7 1.7 1.7.5 0 .8-.3 1.6-.3.7 0 1 .3 1.6.3.6 0 1.2-.6 1.7-1.6.4-.7.5-1.4.5-1.4s-1.3-.4-1.3-1.9c0-1.2 1-1.8 1-1.8s-.5-1.1-1.3-1.1Z" />
          <path d="M9.5 4c.3-.4.5-1 .4-1.5-.5 0-1.1.3-1.4.7-.3.3-.5.9-.4 1.4.5 0 1-.3 1.4-.6Z" />
        </svg>
      );
    case "hn":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M5 5.5l3 3.5 3-3.5M8 9v3" strokeLinecap="round" />
        </svg>
      );
    default:
      return <Icon name="spark" size={14} />;
  }
}
