import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { useMeQuery } from "@/hooks/queries/use-me";
import { useDashboardQuery } from "@/hooks/queries/use-dashboard";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import { useBalanceQuery } from "@/hooks/queries/use-billing";
import { authClient } from "@/lib/auth-client";
import { clearSessionHint } from "@/auth/session-hint";
import { clearQueryCache } from "@/lib/query-client";
import type { ReportRow } from "@/api/reports";

interface CrumbConfig {
  [path: string]: string[];
}

const CRUMB_MAP: CrumbConfig = {
  "/": ["RivalEye", "Overview"],
  "/radar": ["RivalEye", "Radar"],
  "/competitors": ["RivalEye", "Competitors"],
  "/scan": ["RivalEye", "New scan"],
  "/compare": ["RivalEye", "Compare"],
  "/scan-report": ["RivalEye", "Scan Report"],
  "/history": ["RivalEye", "History"],
  "/my-plan": ["RivalEye", "My Plan"],
  "/account": ["RivalEye", "Settings"],
};

function deriveCrumbs(pathname: string, reports?: ReportRow[]): string[] {
  if (pathname.startsWith("/reports/")) {
    const id = pathname.split("/")[2];
    const report = reports?.find((r) => r.id === id);
    const name = report?.primary_competitor_name ?? report?.competitors?.[0] ?? "Report";
    return ["RivalEye", "Reports", name];
  }
  if (pathname.startsWith("/scan-report/")) {
    const id = pathname.split("/")[2];
    const report = reports?.find((r) => r.id === id);
    const name = report?.primary_competitor_name ?? report?.competitors?.[0] ?? "Scan Report";
    return ["RivalEye", "Scan Report", name];
  }
  return CRUMB_MAP[pathname] ?? ["RivalEye"];
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
  const reportsForCrumbs = useReportsQuery();
  const crumbs = deriveCrumbs(location.pathname, reportsForCrumbs.data ?? []);
  const meQuery = useMeQuery();
  const userInitial = initialOf(meQuery.data?.name ?? meQuery.data?.email);
  const userImage = meQuery.data?.image ?? null;

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div
      className="app relative grid h-full md:[grid-template-columns:212px_1fr] [grid-template-columns:1fr]"
      style={{ gridTemplateRows: "52px minmax(0, 1fr)" }}
    >
      <div className="dot-grid-bg absolute inset-0 pointer-events-none" />
      <TopBar
        crumbs={crumbs}
        userInitial={userInitial}
        userImage={userImage}
        onBrandClick={() => navigate("/")}
        onNewScan={() => navigate("/scan")}
        onAccount={() => navigate("/account")}
        onToggleMenu={() => setDrawerOpen((v) => !v)}
      />

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar open={drawerOpen} />

      <main className="main relative z-[1] min-h-0 overflow-y-auto overflow-x-hidden bg-transparent">
        <Outlet />
      </main>
    </div>
  );
}

interface TopBarProps {
  crumbs: string[];
  userInitial: string;
  userImage: string | null;
  onBrandClick: () => void;
  onNewScan: () => void;
  onAccount: () => void;
  onToggleMenu: () => void;
}

function TopBar({ crumbs, userInitial, userImage, onBrandClick, onNewScan, onAccount, onToggleMenu }: TopBarProps) {
  return (
    <header
      className="topbar glass-blur relative z-[5] flex items-center gap-3 md:gap-4 border-b border-soft px-4"
      style={{ gridColumn: "1 / -1", background: "var(--glass)" }}
    >
      <button
        className="re-btn re-btn-ghost re-btn-icon re-btn-sm md:hidden grid place-items-center"
        style={{ minWidth: 36, minHeight: 36 }}
        onClick={onToggleMenu}
        title="Menu"
        aria-label="Toggle menu"
      >
        <Icon name="list" size={18} />
      </button>
      <div
        className="brand flex items-center gap-2.5 cursor-pointer font-mono-feat font-semibold tracking-[-0.01em] md:w-[180px]"
        style={{ fontSize: 13 }}
        onClick={onBrandClick}
      >
        <div className="logo relative grid place-items-center" style={{ width: 28, height: 28 }}>
          <img src="/logo.svg" alt="RivalEye logo" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
        </div>
        <span className="flex items-baseline tracking-[-0.02em]">
          Rival<span style={{ color: "var(--accent)" }}>Eye</span>
        </span>
        <span className="re-chip hidden sm:inline" style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px" }}>BETA</span>
      </div>
      <nav className="crumbs hidden md:flex items-center gap-2 flex-1 font-mono-feat text-fg-muted min-w-0" style={{ fontSize: 12 }}>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2 min-w-0">
            {i > 0 && <span className="text-fg-faint">/</span>}
            {i === crumbs.length - 1
              ? <b className="text-fg font-medium truncate">{c}</b>
              : <span className="truncate">{c}</span>}
          </span>
        ))}
      </nav>
      <div className="actions flex flex-1 md:flex-none items-center justify-end gap-1.5">
        <button type="button" className="re-btn re-btn-sm" onClick={onNewScan}>
          <Icon name="plus" size={14} /> New scan
        </button>
        <button type="button" className="re-btn re-btn-ghost re-btn-icon re-btn-sm" onClick={onAccount} title="Account">
          {userImage ? (
            <img
              src={userImage}
              alt="Account"
              style={{ width: 22, height: 22, borderRadius: 99, objectFit: "cover" }}
            />
          ) : (
            <span
              className="grid place-items-center text-white font-semibold"
              style={{ width: 22, height: 22, borderRadius: 99, background: "linear-gradient(135deg,#004d8f,#0061B1)", fontSize: 11 }}
            >{userInitial}</span>
          )}
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
  { to: "/billing",     icon: "spark",   label: "Credits" },
];

interface SidebarProps {
  open: boolean;
}

function Sidebar({ open }: SidebarProps) {
  const navigate = useNavigate();
  const dashboardQuery = useDashboardQuery();
  const reportsQuery = useReportsQuery();
  const balanceQuery = useBalanceQuery();
  const stats = dashboardQuery.data?.stats;

  function onSignOut() {
    // Navigate first so sign-out feels instant; tear down the session in the
    // background. Clear the session hint immediately and the query cache (memory
    // + persisted localStorage) after sign-out so the next account on this
    // machine can never see the previous user's name, reports, or credits.
    clearSessionHint();
    navigate("/signin", { replace: true, state: { signedOut: true } });
    void authClient.signOut().finally(() => {
      void clearQueryCache();
    });
  }

  const badges: Record<"competitors" | "radar", NavBadge> = {
    competitors: { count: stats?.total_competitors ?? null },
    radar: { count: stats?.urgent_radar_events_7d ?? null, tone: "alert" },
  };

  const recent: ReportRow[] = (reportsQuery.data ?? []).slice(0, 5);

  return (
    <aside
      className={`sidebar glass-blur flex-col gap-px overflow-y-auto border-r border-soft md:flex md:static md:z-auto md:w-auto fixed inset-y-0 left-0 z-50 w-[260px] md:!flex ${
        open ? "flex" : "hidden"
      }`}
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
            to={`/scan-report/${r.id}`}
            title={`${label} — ${relativeTime(r.scanned_at ?? r.created_at)}`}
            className={({ isActive }) =>
              `sb-item flex items-center gap-2.5 rounded-md px-2.5 py-1.5 w-full text-left border-0 cursor-pointer ${
                isActive ? "sb-active" : "sb-idle"
              }`
            }
            style={{ fontSize: 13 }}
          >
            <CompetitorAvatar name={label} domain={r.primary_competitor_domain} size={20} borderRadius={4} />
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>{relativeTime(r.scanned_at ?? r.created_at)}</span>
          </NavLink>
        );
      })}

      <div className="mt-auto" style={{ padding: "12px 8px" }}>
        <NavLink
          to="/billing"
          className={({ isActive }) =>
            `text-fg-muted block ${isActive ? "" : ""}`
          }
          style={{
            padding: 10,
            border: "1px solid var(--border-soft)",
            borderRadius: 8,
            fontSize: 11,
            background: "var(--surface-2)",
            textDecoration: "none",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>CREDITS</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-fg" style={{ fontSize: 16, fontWeight: 600 }}>
              {balanceQuery.data
                ? balanceQuery.data.free_scan_used === false
                  ? "Free"
                  : balanceQuery.data.balance
                : "—"}
            </span>
            {balanceQuery.data?.free_scan_used && (
              <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>remaining</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
            {balanceQuery.data?.free_scan_used === false ? "1 free scan available" : "tap to buy more"}
          </div>
        </NavLink>

        <button
          type="button"
          onClick={onSignOut}
          className="sb-item sb-idle flex items-center gap-2.5 rounded-md px-2.5 py-1.5 w-full text-left border-0 cursor-pointer mt-1"
          style={{ fontSize: 13, color: "var(--neg)" }}
        >
          <Icon name="log-out" size={14} className="flex-shrink-0" />
          <span className="flex-1">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
