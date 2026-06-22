import { useState, useRef, type ComponentType, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Check, Globe, Search, Star } from "lucide-react";
import {
  FaAppStoreIos,
  FaDev,
  FaGooglePlay,
  FaLinkedin,
  FaSquareHackerNews,
  FaXTwitter,
} from "react-icons/fa6";
import { SiGooglemaps, SiProducthunt, SiReddit } from "react-icons/si";
import { useCreateReportMutation } from "@/hooks/queries/use-reports";
import { useBalanceQuery } from "@/hooks/queries/use-billing";
import { PaywallModal } from "@/components/billing/paywall-modal";
import type { ReportGoal } from "@rivaleye/shared";

type BrandIcon = ComponentType<{ size?: number | string; color?: string; className?: string }>;

const PLATFORM_BRANDS: Record<string, { Icon: BrandIcon; color: string }> = {
  reddit: { Icon: SiReddit, color: "#FF4500" },
  producthunt: { Icon: SiProducthunt, color: "#DA552F" },
  appstore: { Icon: FaAppStoreIos, color: "#0D96F6" },
  playstore: { Icon: FaGooglePlay, color: "#0F9D58" },
  hackernews: { Icon: FaSquareHackerNews, color: "#FF6600" },
  devto: { Icon: FaDev, color: "var(--fg)" },
  website: { Icon: Globe, color: "var(--accent)" },
  twitter: { Icon: FaXTwitter, color: "var(--fg)" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2" },
  capterra: { Icon: Star, color: "#FF9D28" },
  gmaps: { Icon: SiGooglemaps, color: "#1A73E8" },
};

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

// Every scan produces the full perception report — we never narrow at scan
// time. The user narrows later via report lenses. The pipeline still requires a
// goal value, so we send a fixed default the worker treats as "comprehensive".
const DEFAULT_GOAL: ReportGoal = "find_user_pain";

export function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const onNav = (t: NavTarget) => navigate(navPath(t));

  const prefillCompetitor =
    (location.state as { prefillCompetitor?: string } | null)?.prefillCompetitor ?? "";
  const [name, setName] = useState(prefillCompetitor);
  const [nameFocused, setNameFocused] = useState(false);
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [platforms, setPlatforms] = useState<Record<PlatformId, boolean>>({
    reddit: true, producthunt: true, appstore: true, playstore: true,
    hackernews: true, devto: true, website: false,
    twitter: false, linkedin: false, capterra: false, gmaps: false,
  });
  const [websiteUrl, setWebsiteUrl] = useState("");

  const { mutateAsync, isPending, error } = useCreateReportMutation();
  const { data: balance } = useBalanceQuery();
  const [showPaywall, setShowPaywall] = useState(false);
  const pendingScanRef = useRef<(() => Promise<void>) | null>(null);

  const needsCredits = balance !== undefined && balance.free_scan_used && balance.balance < 1;

  const selectedPlatformCount = PLATFORMS.filter((p) => p.live && platforms[p.id]).length;

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
      founder_goal: DEFAULT_GOAL,
      selected_platforms: activePlatforms.length > 0 ? activePlatforms : PLATFORMS.filter((p) => p.live).map((p) => p.id),
      website_url: platforms.website && websiteUrl.trim() ? websiteUrl.trim() : undefined,
    });
    navigate(`/scan-report/${res.id}/summary`, { replace: true });
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

  if (isPending) {
    return (
      <div
        className="px-4 py-16 md:px-7"
        style={{ textAlign: "center", color: "var(--fg-muted)", maxWidth: 920, margin: "0 auto" }}
      >
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 16 }}>Launching scan</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--fg)", marginBottom: 8 }}>
          Starting your scan…
        </div>
        <div style={{ fontSize: 14, color: "var(--fg-muted)" }}>
          Setting up intelligence report for <b style={{ color: "var(--fg)" }}>{name}</b>
        </div>
      </div>
    );
  }

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
    <div className="px-4 py-5 md:px-7 pb-16 w-full" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div className="re-eyebrow">New scan</div>
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
            <Search size={16} className="text-fg-faint" />
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

      <Step n={3} label="Platforms to scan">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
          {PLATFORMS.map((p) => (
            <PlatformTile
              key={p.id}
              id={p.id}
              name={p.name}
              sub={p.sub}
              live={p.live}
              on={platforms[p.id]}
              onToggle={() => setPlatforms((s) => ({ ...s, [p.id]: !s[p.id] }))}
            />
          ))}
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
          <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>Ready to run</div>
          <div className="break-words" style={{ fontSize: 14, marginTop: 4 }}>
            <b>{name || "—"}</b> · {selectedPlatformCount} platforms
          </div>
        </div>
        <div className="flex flex-col sm:flex-row" style={{ gap: 8 }}>
          <button
            className="re-btn w-full sm:w-auto"
            onClick={() => onNav("dashboard")}
            disabled={isPending}
            style={{ height: 36 }}
          >
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
              <>Run scan <ArrowRight size={14} /></>
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

function PlatformTile({
  id,
  name,
  sub,
  live,
  on,
  onToggle,
}: {
  id: string;
  name: string;
  sub: string;
  live: boolean;
  on: boolean;
  onToggle: () => void;
}) {
  const brand = PLATFORM_BRANDS[id] ?? { Icon: Globe, color: "var(--accent)" };
  const { Icon: BrandLogo, color } = brand;
  const selected = on && live;

  return (
    <button
      type="button"
      onClick={() => live && onToggle()}
      disabled={!live}
      aria-pressed={selected}
      className="group text-left"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${selected ? color : "var(--border-soft)"}`,
        background: selected ? `color-mix(in srgb, ${color} 7%, var(--surface))` : "var(--surface)",
        boxShadow: selected ? `0 0 0 1px ${color} inset` : "var(--shadow-sm)",
        cursor: live ? "pointer" : "default",
        opacity: live ? 1 : 0.6,
        transition: "border-color 120ms, background 120ms, box-shadow 120ms",
      }}
    >
      <span
        className="grid place-items-center shrink-0"
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `color-mix(in srgb, ${color} 13%, transparent)`,
          color,
        }}
      >
        <BrandLogo size={19} color={color} />
      </span>
      <span className="min-w-0" style={{ flex: 1 }}>
        <span className="block" style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.005em" }}>{name}</span>
        <span className="block text-fg-muted" style={{ fontSize: 11, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {live ? sub : "Coming soon"}
        </span>
      </span>
      {!live ? (
        <span className="font-mono-feat shrink-0" style={{ fontSize: 9.5, color: "var(--fg-faint)", border: "1px solid var(--border-soft)", borderRadius: 99, padding: "1px 7px" }}>
          Soon
        </span>
      ) : (
        <span
          className="grid place-items-center shrink-0"
          style={{
            width: 20, height: 20, borderRadius: 6,
            border: `1.5px solid ${selected ? color : "var(--border-strong)"}`,
            background: selected ? color : "transparent",
            color: "#fff",
            transition: "background 120ms, border-color 120ms",
          }}
        >
          {selected && <Check size={13} strokeWidth={3} />}
        </span>
      )}
    </button>
  );
}
