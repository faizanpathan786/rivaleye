import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { MOCK_DATA } from "@/lib/mock/data";

interface CrumbConfig {
  [path: string]: string[];
}

const CRUMB_MAP: CrumbConfig = {
  "/": ["Stitchworks", "Overview"],
  "/radar": ["Stitchworks", "Radar"],
  "/competitors": ["Stitchworks", "Competitors"],
  "/scan": ["Stitchworks", "New scan"],
  "/compare": ["Stitchworks", "Compare"],
  "/history": ["Stitchworks", "History"],
  "/account": ["Stitchworks", "Settings"],
};

function deriveCrumbs(pathname: string): string[] {
  if (pathname.startsWith("/reports/")) return ["Stitchworks", "Reports", "Linear"];
  return CRUMB_MAP[pathname] ?? ["Stitchworks"];
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const crumbs = deriveCrumbs(location.pathname);

  return (
    <div className="app grid h-full" style={{ gridTemplateColumns: "212px 1fr", gridTemplateRows: "52px 1fr", position: "relative" }}>
      <div className="dot-grid-bg absolute inset-0 pointer-events-none" />
      <TopBar crumbs={crumbs} onBrandClick={() => navigate("/")} onNewScan={() => navigate("/scan")} onAccount={() => navigate("/account")} />
      <Sidebar />
      <main className="main relative z-[1] overflow-y-auto overflow-x-hidden bg-transparent">
        <Outlet />
      </main>
    </div>
  );
}

interface TopBarProps {
  crumbs: string[];
  onBrandClick: () => void;
  onNewScan: () => void;
  onAccount: () => void;
}

function TopBar({ crumbs, onBrandClick, onNewScan, onAccount }: TopBarProps) {
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
        <div className="logo relative grid place-items-center" style={{ width: 28, height: 28, color: "var(--accent)" }}>
          <span className="absolute" style={{ inset: -2, background: "var(--accent-soft)", borderRadius: 7, zIndex: 0 }} />
          <span className="relative z-[1]"><Icon name="logo" size={18} /></span>
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
            style={{ width: 22, height: 22, borderRadius: 99, background: "linear-gradient(135deg,#ff5c1a,#ffb05a)", fontSize: 11 }}
          >K</span>
        </button>
      </div>
    </header>
  );
}

const NAV_ITEMS: Array<{ to: string; icon: Parameters<typeof Icon>[0]["name"]; label: string }> = [
  { to: "/",            icon: "home",    label: "Overview" },
  { to: "/radar",       icon: "spark",   label: "Radar" },
  { to: "/competitors", icon: "user",    label: "Competitors" },
  { to: "/scan",        icon: "scan",    label: "New scan" },
  { to: "/compare",     icon: "compare", label: "Compare" },
  { to: "/history",     icon: "history", label: "History" },
];

function Sidebar() {
  const history = MOCK_DATA.history;
  return (
    <aside
      className="sidebar glass-blur flex flex-col gap-px overflow-y-auto border-r border-soft"
      style={{ background: "var(--glass)", padding: "10px 8px" }}
    >
      {NAV_ITEMS.map((item) => (
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
          <span>{item.label}</span>
        </NavLink>
      ))}

      <div className="font-mono-feat text-fg-faint uppercase" style={{ fontSize: 10, letterSpacing: "0.08em", padding: "10px 10px 4px" }}>
        Recent scans
      </div>
      {history.slice(0, 5).map((h) => (
        <NavLink
          key={h.id}
          to={`/reports/${h.id}`}
          title={`${h.name} — ${h.lastRun}`}
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
          >{h.name[0]}</span>
          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{h.name}</span>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10 }}>{h.lastRun}</span>
        </NavLink>
      ))}

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
            <span className="text-fg" style={{ fontSize: 16, fontWeight: 600 }}>39</span>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>/ 50</span>
          </div>
          <div className="re-meter mt-1.5"><i style={{ width: "78%" }} /></div>
        </div>
      </div>
    </aside>
  );
}
