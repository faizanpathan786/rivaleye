import { useState, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { useCreateReportMutation } from "@/hooks/queries/use-reports";
import { useBalanceQuery } from "@/hooks/queries/use-billing";
import { PaywallModal } from "@/components/billing/paywall-modal";
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

const PLATFORMS = [
  { id: "reddit",      name: "Reddit",        sub: "Threads, comments, subreddits",   live: true  },
  { id: "producthunt", name: "Product Hunt",  sub: "Launch comments, alternatives",   live: true  },
  { id: "appstore",    name: "App Store",     sub: "iOS low-star reviews",            live: true  },
  { id: "playstore",   name: "Play Store",    sub: "Android low-star reviews",        live: true  },
  { id: "hackernews",  name: "Hacker News",   sub: "Show HN, Ask HN, comments",       live: true  },
  { id: "devto",       name: "Dev.to",        sub: "Articles & community comments",   live: true  },
  { id: "website",     name: "Website",       sub: "Marketing site, pricing, features", live: true },
  { id: "twitter",     name: "X / Twitter",   sub: "Complaint & switching tweets",    live: true  },
  { id: "linkedin",    name: "LinkedIn",      sub: "Public posts & comments",         live: false },
  { id: "capterra",    name: "Capterra",      sub: "Verified buyer reviews",          live: false },
  { id: "gmaps",       name: "Google Maps",   sub: "Local & product reviews",         live: false },
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

export function ScanPage() {
  const navigate = useNavigate();
  const onNav = (t: NavTarget) => navigate(navPath(t));

  const [name, setName] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState<Record<PlatformId, boolean>>({
    reddit: true, producthunt: true, appstore: true, playstore: true,
    hackernews: true, devto: true, website: false,
    twitter: false, linkedin: false, capterra: false, gmaps: false,
  });
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [goal, setGoal] = useState<ReportGoal>("find_weaknesses");

  const { mutateAsync, isPending, error } = useCreateReportMutation();
  const { data: balance } = useBalanceQuery();
  const [showPaywall, setShowPaywall] = useState(false);
  const pendingScanRef = useRef<(() => Promise<void>) | null>(null);

  const needsCredits = balance !== undefined && balance.free_scan_used && balance.balance < 1;

  const selectedPlatformCount = PLATFORMS.filter((p) => p.live && platforms[p.id]).length;
  const goalLabel = GOALS.find((g) => g.id === goal)?.label.toLowerCase() ?? "";

  const canSubmit =
    !isPending &&
    name.trim().length > 0 &&
    category.trim().length > 0 &&
    audience.trim().length > 0 &&
    (!platforms.website || websiteUrl.trim().length > 0);

  const runScan = async () => {
    const activePlatforms = PLATFORMS.filter((p) => p.live && platforms[p.id]).map((p) => p.id);
    const res = await mutateAsync({
      category: category.trim(),
      competitors: [name.trim()],
      target_audience: audience.trim(),
      founder_goal: goal,
      selected_platforms: activePlatforms.length > 0 ? activePlatforms : PLATFORMS.filter((p) => p.live).map((p) => p.id),
      website_url: platforms.website && websiteUrl.trim() ? websiteUrl.trim() : undefined,
    });
    navigate(`/scan-report/${res.id}`);
  };

  const start = async () => {
    if (!canSubmit) return;
    // instant check — no round trip needed
    if (needsCredits) {
      pendingScanRef.current = runScan;
      setShowPaywall(true);
      return;
    }
    try {
      await runScan();
    } catch (e) {
      const errObj = e as { error?: string };
      if (errObj?.error === "PAYMENT_REQUIRED") {
        pendingScanRef.current = runScan;
        setShowPaywall(true);
      }
      // other errors surfaced via `error` below
    }
  };

  const errorMessage =
    error instanceof Error ? error.message :
    (error as { error?: string } | null)?.error === "PAYMENT_REQUIRED" ? null :
    error ? "Failed to start scan" : null;

  return (
    <>
    {showPaywall && (
      <PaywallModal
        onClose={() => setShowPaywall(false)}
        onPurchaseSuccess={async () => {
          setShowPaywall(false);
          if (pendingScanRef.current) {
            try { await pendingScanRef.current(); } catch { /* surfaced by mutation error */ }
            pendingScanRef.current = null;
          }
        }}
      />
    )}
    <div className="px-4 py-5 md:px-7 pb-16 w-full" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="re-eyebrow">NEW SCAN</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>Run a competitor scan</h1>
      <p className="text-fg-muted w-full max-w-[580px]" style={{ marginTop: 8 }}>
        Point RivalEye at a competitor. We pull complaints, switching signals,
        feature gaps, and high-intent leads from every platform you select,
        cluster the themes, and hand you an intel report.
      </p>

      <Step n={1} label="Competitor">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr]" style={{ gap: 10 }}>
          <div className="min-w-0" style={{
            display: "flex", alignItems: "center", gap: 8,
            border: `1px solid ${nameFocused ? "var(--accent)" : "var(--border-strong)"}`,
            borderRadius: 8,
            background: "var(--surface)",
            padding: "0 12px",
            height: 44,
            boxShadow: nameFocused ? "0 0 0 3px var(--accent-soft)" : "none",
            transition: "border-color 120ms, box-shadow 120ms",
          }}>
            <Icon name="search" size={16} className="text-fg-faint" />
            <input
              className="min-w-0"
              style={{
                flex: 1, border: 0, height: "100%", padding: 0,
                fontSize: 15, background: "transparent",
                outline: "none", color: "var(--fg)",
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" style={{ gap: 8 }}>
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

      <Step n={4} label="Platforms to scan">
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 6 }}>
          {PLATFORMS.map((p) => {
            const on = platforms[p.id];
            const disabled = !p.live;
            return (
              <button
                key={p.id}
                onClick={() => !disabled && setPlatforms((s) => ({ ...s, [p.id]: !s[p.id] }))}
                className="re-btn"
                disabled={disabled}
                style={{
                  justifyContent: "space-between",
                  background: disabled ? "var(--surface)" : on ? "var(--accent-soft)" : "var(--surface)",
                  borderColor: disabled ? "var(--border-soft)" : on ? "var(--accent)" : "var(--border-strong)",
                  color: disabled ? "var(--fg-faint)" : on ? "var(--accent)" : "var(--fg)",
                  height: 52,
                  padding: "0 12px",
                  opacity: disabled ? 0.55 : 1,
                  cursor: disabled ? "default" : "pointer",
                }}
              >
                <span className="min-w-0" style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
                  <PlatformIcon id={p.id} active={on && !disabled} />
                  <span className="min-w-0" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</span>
                    <span className="text-fg-muted" style={{ fontSize: 11, fontWeight: 400 }}>
                      {disabled ? "Coming soon" : p.sub}
                    </span>
                  </span>
                </span>
                {!disabled && on && <Icon name="check" size={14} />}
              </button>
            );
          })}
        </div>
        {platforms.website && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
              Competitor website URL <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>(required for Website platform)</span>
            </div>
            <input
              className="re-input"
              style={{ height: 40, fontSize: 14, width: "100%" }}
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://linear.app"
            />
          </div>
        )}
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

      <div
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        style={{
          marginTop: 32,
          padding: "16px 20px",
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          borderRadius: 10,
        }}
      >
        <div className="min-w-0">
          <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>READY TO RUN</div>
          <div className="break-words" style={{ fontSize: 14, marginTop: 4 }}>
            <b>{name || "—"}</b> · {goalLabel} · {selectedPlatformCount} platforms
          </div>
        </div>
        <div className="flex flex-col sm:flex-row" style={{ gap: 8 }}>
          <button className="re-btn w-full sm:w-auto" onClick={() => onNav("dashboard")} disabled={isPending}>
            Cancel
          </button>
          <button
            className="re-btn re-btn-accent w-full sm:w-auto"
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
    </>
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
    case "appstore":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M11 4.6c-.6 0-1.5.4-2 .4-.6 0-1.4-.4-2.1-.4-1.2 0-2.3.9-2.3 2.7 0 1.1.3 2.3.9 3.4.6 1 1.1 1.7 1.7 1.7.5 0 .8-.3 1.6-.3.7 0 1 .3 1.6.3.6 0 1.2-.6 1.7-1.6.4-.7.5-1.4.5-1.4s-1.3-.4-1.3-1.9c0-1.2 1-1.8 1-1.8s-.5-1.1-1.3-1.1Z" />
          <path d="M9.5 4c.3-.4.5-1 .4-1.5-.5 0-1.1.3-1.4.7-.3.3-.5.9-.4 1.4.5 0 1-.3 1.4-.6Z" />
        </svg>
      );
    case "playstore":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 2.5l10 5.5-10 5.5V2.5Z" strokeLinejoin="round" />
        </svg>
      );
    case "hackernews":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M5 5.5l3 3.5 3-3.5M8 9v3" strokeLinecap="round" />
        </svg>
      );
    case "devto":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1.5" y="3" width="13" height="10" rx="2" />
          <path d="M5 6.5v3M7 6.5c1 0 2 .7 2 1.5S8 9.5 7 9.5" strokeLinecap="round" />
          <path d="M10.5 6.5h1.5M10.5 8h1M10.5 9.5h1.5" strokeLinecap="round" />
        </svg>
      );
    case "website":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <path d="M2 8h12M8 2c-1.5 2-2.5 3.8-2.5 6s1 4 2.5 6M8 2c1.5 2 2.5 3.8 2.5 6s-1 4-2.5 6" strokeLinecap="round" />
        </svg>
      );
    case "capterra":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2L2 6v8h4V9h4v5h4V6L8 2Z" strokeLinejoin="round" />
        </svg>
      );
    case "gmaps":
      return (
        <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6c0-2.5-2-4.5-4.5-4.5Z" strokeLinejoin="round" />
          <circle cx="8" cy="6" r="1.5" />
        </svg>
      );
    default:
      return <Icon name="spark" size={14} />;
  }
}
