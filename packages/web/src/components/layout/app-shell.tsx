import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { useMeQuery } from "@/hooks/queries/use-me";
import { useDashboardQuery } from "@/hooks/queries/use-dashboard";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import type { ReportRow } from "@/api/reports";

interface CrumbConfig {
  [path: string]: string[];
}

const CRUMB_MAP: CrumbConfig = {
  "/": ["Stitchworks", "Overview"],
  "/radar": ["Stitchworks", "Radar"],
  "/competitors": ["Stitchworks", "Competitors"],
  "/scan": ["Stitchworks", "New scan"],
  "/compare": ["Stitchworks", "Compare"],
  "/scan-report": ["Stitchworks", "Scan Report"],
  "/history": ["Stitchworks", "History"],
  "/account": ["Stitchworks", "Settings"],
};

function deriveCrumbs(pathname: string): string[] {
  if (pathname.startsWith("/reports/")) return ["Stitchworks", "Reports", "Linear"];
  return CRUMB_MAP[pathname] ?? ["Stitchworks"];
}

function initialOf(value: string | null | undefined): string {
  if (!value) return "?";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = deriveCrumbs(location.pathname);
  const meQuery = useMeQuery();
  const userInitial = initialOf(meQuery.data?.name ?? meQuery.data?.email);

  return (
    <div className="app grid h-full" style={{ gridTemplateColumns: "212px 1fr", gridTemplateRows: "52px 1fr", position: "relative" }}>
      <div className="dot-grid-bg absolute inset-0 pointer-events-none" />
      <TopBar
        crumbs={crumbs}
        userInitial={userInitial}
        onBrandClick={() => navigate("/")}
        onNewScan={() => navigate("/scan")}
        onAccount={() => navigate("/account")}
      />
      <Sidebar />
      <main className="main relative z-[1] overflow-y-auto overflow-x-hidden bg-transparent">
        <Outlet />
      </main>
    </div>
  );
}

interface TopBarProps {
  crumbs: string[];
  userInitial: string;
  onBrandClick: () => void;
  onNewScan: () => void;
  onAccount: () => void;
}

function TopBar({ crumbs, userInitial, onBrandClick, onNewScan, onAccount }: TopBarProps) {
  return (
    <header
      className="topbar glass-blur relative z-[5] flex items-center gap-4 border-b border-soft px-4"
      style={{ gridColumn: "1 / -1", background: "var(--glass)" }}
    >
      <div
        className="brand flex items-center gap-2.5 cursor-pointer font-mono-feat font-semibold tracking-[-0.01em]"
        style={{ width: 180, fontSize: 13 }}
        onClick={onBrandClick}
      >
        <div className="logo relative grid place-items-center" style={{ width: 28, height: 28 }}>
          <img src="/logo.svg" alt="RivalEye logo" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
        </div>
        <span className="flex items-baseline tracking-[-0.02em]">
          Rival<span style={{ color: "var(--accent)" }}>Eye</span>
        </span>
        <span className="re-chip" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>BETA</span>
      </div>
      <nav className="crumbs flex items-center gap-2 flex-1 font-mono-feat text-fg-muted" style={{ fontSize: 12 }}>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-fg-faint">/</span>}
            {i === crumbs.length - 1
              ? <b className="text-fg font-medium">{c}</b>
              : <span>{c}</span>}
          </span>
        ))}
      </nav>
      <div className="actions flex items-center gap-1.5">
        <button className="re-btn re-btn-ghost re-btn-sm" title="Search">
          <Icon name="search" size={14} />
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>⌘K</span>
        </button>
        <span className="block" style={{ width: 1, height: 18, background: "var(--border-soft)" }} />
        <button className="re-btn re-btn-sm" onClick={onNewScan}>
          <Icon name="plus" size={14} /> New scan
        </button>
        <button className="re-btn re-btn-ghost re-btn-icon re-btn-sm" onClick={onAccount} title="Account">
          <span
            className="grid place-items-center text-white font-semibold"
            style={{ width: 22, height: 22, borderRadius: 99, background: "linear-gradient(135deg,#0284c7,#38bdf8)", fontSize: 11 }}
          >{userInitial}</span>
        </button>
      </div>
    </header>
  );
}

interface NavBadge {
  count: number | null;
  tone?: "default" | "alert";
}

const NAV_ITEMS: Array<{
  to: string;
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  badgeKey?: "competitors" | "radar";
}> = [
  { to: "/",            icon: "home",    label: "Overview" },
  { to: "/radar",       icon: "spark",   label: "Radar", badgeKey: "radar" },
  { to: "/competitors", icon: "user",    label: "Competitors", badgeKey: "competitors" },
  { to: "/scan",        icon: "scan",    label: "New scan" },
  { to: "/compare",     icon: "compare", label: "Compare" },
  { to: "/history",     icon: "history", label: "History" },
];

function Sidebar() {
  const dashboardQuery = useDashboardQuery();
  const reportsQuery = useReportsQuery();
  const stats = dashboardQuery.data?.stats;

  const badges: Record<"competitors" | "radar", NavBadge> = {
    competitors: { count: stats?.total_competitors ?? null },
    radar: { count: stats?.urgent_radar_events_7d ?? null, tone: "alert" },
  };

  const recent: ReportRow[] = (reportsQuery.data ?? []).slice(0, 5);

  return (
    <aside
      className="sidebar glass-blur flex flex-col gap-px overflow-y-auto border-r border-soft"
      style={{ background: "var(--glass)", padding: "10px 8px" }}
    >
      {NAV_ITEMS.map((item) => {
        const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `sb-item flex items-center gap-2.5 rounded-md px-2.5 py-1.5 w-full text-left border-0 cursor-pointer ${
                isActive ? "sb-active" : "sb-idle"
              }`
            }
            style={{ fontSize: 13 }}
          >
            <Icon name={item.icon} size={14} className="sb-icon flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
            {badge && badge.count !== null && badge.count > 0 && (
              <span
                className="font-mono-feat"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 99,
                  background: badge.tone === "alert" ? "var(--accent-soft)" : "var(--surface-2)",
                  color: badge.tone === "alert" ? "var(--accent)" : "var(--fg-muted)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                {badge.count}
              </span>
            )}
          </NavLink>
        );
      })}

      <div className="font-mono-feat text-fg-faint uppercase" style={{ fontSize: 10, letterSpacing: "0.08em", padding: "10px 10px 4px" }}>
        Recent scans
      </div>
      {recent.map((r) => {
        const label = r.primary_competitor_name ?? r.competitors[0] ?? r.category;
        return (
          <NavLink
            key={r.id}
            to="/scan-report"
            title={`${label} — ${relativeTime(r.scanned_at ?? r.created_at)}`}
            className={({ isActive }) =>
              `sb-item flex items-center gap-2.5 rounded-md px-2.5 py-1.5 w-full text-left border-0 cursor-pointer ${
                isActive ? "sb-active" : "sb-idle"
              }`
            }
            style={{ fontSize: 13 }}
          >
            <span
              className="grid place-items-center font-mono-feat font-semibold flex-shrink-0 text-fg-muted"
              style={{
                width: 14, height: 14, borderRadius: 3,
                background: "var(--surface-2)",
                border: "1px solid var(--border-soft)",
                fontSize: 9,
              }}
            >{initialOf(label)}</span>
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>{relativeTime(r.scanned_at ?? r.created_at)}</span>
          </NavLink>
        );
      })}

      <div className="mt-auto" style={{ padding: "12px 8px" }}>
        <div
          className="text-fg-muted"
          style={{
            padding: 10,
            border: "1px solid var(--border-soft)",
            borderRadius: 8,
            fontSize: 11,
            background: "var(--surface-2)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>SCANS THIS MONTH</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-fg" style={{ fontSize: 16, fontWeight: 600 }}>
              {reportsQuery.data ? reportsQuery.data.length : "—"}
            </span>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>/ 50</span>
          </div>
          <div className="re-meter mt-1.5">
            <i style={{ width: reportsQuery.data ? `${Math.min(100, (reportsQuery.data.length / 50) * 100)}%` : "0%" }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
