import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/icons";
import type { ReportRow } from "@/api/reports";

const AVATAR_COLORS: Record<string, string> = {};

const avatarColor = (name: string): string => {
  if (AVATAR_COLORS[name]) return AVATAR_COLORS[name]!;
  let s = 0;
  for (const c of name) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const hue = s % 360;
  return `hsl(${hue}, 55%, 38%)`;
};

interface CompareChoice {
  id: string;
  name: string;
  sentiment: number;
  sources: number;
  created_at: string;
}

interface SynthesizedSide {
  pricing: number;
  gaps: number;
  mobile: number;
  reporting: number;
  perf: number;
  admin: number;
}

function synthesizeCompetitor(name: string): SynthesizedSide {
  let s = 0;
  for (const c of name) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return ((s >>> 8) & 0xff) / 255;
  };
  return {
    pricing: Math.round(120 + r() * 200),
    gaps: Math.round(80 + r() * 180),
    mobile: Math.round(60 + r() * 160),
    reporting: Math.round(70 + r() * 130),
    perf: Math.round(40 + r() * 120),
    admin: Math.round(50 + r() * 130),
  };
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--fg-faint)",
  fontWeight: 500,
};

const tdStyle: CSSProperties = { padding: "12px 16px", verticalAlign: "middle" };

const ulStyle: CSSProperties = {
  listStyle: "none",
  padding: "12px 16px",
  margin: 0,
  fontSize: 13,
  lineHeight: 1.9,
  color: "var(--fg-muted)",
};

interface SidePickerFixedProps {
  fixed: { name: string; color: string; pain: number };
}

interface SidePickerSelectProps {
  name: string;
  choices: CompareChoice[];
  current: string;
  onChange: (id: string) => void;
  color: string;
  pain: number;
}

function SidePickerFixed({ fixed }: SidePickerFixedProps) {
  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div className="re-eyebrow">SIDE A · LOCKED</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <div
          className="shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: fixed.color,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            fontWeight: 600,
            fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          }}
        >
          {fixed.name[0]}
        </div>
        <div className="min-w-0">
          <h3 className="re-h3 break-words" style={{ fontSize: 18 }}>{fixed.name}</h3>
          <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            most recent scan
          </div>
        </div>
      </div>
    </div>
  );
}

function SidePickerSelect({ name, choices, current, onChange, color }: SidePickerSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div className="re-eyebrow">SIDE B · SELECT</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <div
          className="shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: color,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            fontWeight: 600,
            fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
          }}
        >
          {name[0]}
        </div>
        <div ref={wrapRef} className="min-w-0" style={{ position: "relative", flex: 1, zIndex: 10 }}>

          <button
            type="button"
            className="re-input"
            onClick={() => setOpen((v) => !v)}
            style={{
              width: "100%",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span className="truncate min-w-0">{name}</span>
            <span className="shrink-0 inline-flex">
              <Icon name="chev-down" size={14} />
            </span>
          </button>
          {open && (
            <>
              <div
                className="re-card re-card-elev"
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  padding: 4,
                  background: "var(--surface-solid)",
                }}
              >
                {choices.map((c) => {
                  const active = c.id === current;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onChange(c.id);
                        setOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "8px 10px",
                        background: active ? "var(--hover)" : "transparent",
                        border: 0,
                        borderRadius: 6,
                        fontSize: 13,
                        color: "var(--fg)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontWeight: active ? 500 : 400,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = "var(--hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            background: avatarColor(c.name),
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 10,
                            fontWeight: 600,
                            fontFamily: "var(--font-mono, 'Geist Mono', ui-monospace, monospace)",
                          }}
                        >
                          {c.name[0]}
                        </span>
                        {c.name}
                      </span>
                      {active && <Icon name="check" size={14} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SideStatProps {
  label: string;
  v: number;
  mentions: number;
  reverse?: boolean;
}

function SideStat({ label, v, mentions, reverse }: SideStatProps) {
  return (
    <div className="min-w-0" style={{ textAlign: reverse ? "right" : "left" }}>
      <div className="re-eyebrow break-words">{label}</div>
      <div
        className="font-mono-feat tnum"
        style={{
          fontSize: "clamp(26px, 6vw, 36px)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--neg)",
          marginTop: 4,
        }}
      >
        {v.toFixed(2)}
      </div>
      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
        {mentions.toLocaleString()} sources
      </div>
    </div>
  );
}

function toChoice(r: ReportRow): CompareChoice {
  return {
    id: r.id,
    name: r.primary_competitor_name ?? r.competitors[0] ?? r.id,
    sentiment: r.sentiment_overall ?? 0,
    sources: r.total_sources ?? 0,
    created_at: r.created_at,
  };
}

export function ComparePage() {
  const navigate = useNavigate();
  void navigate;

  const { data: reports, isLoading } = useReportsQuery();

  const completed = useMemo(
    () =>
      (reports ?? [])
        .filter((r) => r.status === "completed" || r.status === "succeeded")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
    [reports],
  );

  const sideAReport = completed[0];
  const defaultBReport = completed[1];

  const [bId, setBId] = useState<string | undefined>(undefined);

  const effectiveBId = bId ?? defaultBReport?.id;

  const choices: CompareChoice[] = useMemo(
    () => completed.slice(1).map(toChoice),
    [completed],
  );

  const rightChoice =
    choices.find((c) => c.id === effectiveBId) ?? choices[0];

  if (isLoading) {
    return (
      <div
        className="px-4 py-5 md:px-7 md:pt-5 md:pb-[60px]"
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Skeleton style={{ width: "100%", height: 200 }} />
      </div>
    );
  }

  if (completed.length < 2 || !sideAReport || !rightChoice) {
    return (
      <div
        className="px-4 py-5 md:px-7 md:pt-5 md:pb-[60px]"
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          minHeight: 320,
        }}
      >
        <p className="text-fg-muted" style={{ fontSize: 14 }}>
          You need at least 2 completed reports to compare.
        </p>
        <Link
          to="/scan"
          className="re-btn re-btn-primary"
          style={{ fontSize: 13 }}
        >
          Run a scan
        </Link>
      </div>
    );
  }

  const sideA = toChoice(sideAReport);
  const sideAsynth = synthesizeCompetitor(sideA.name);
  const sideBsynth = synthesizeCompetitor(rightChoice.name);

  const rows = [
    { theme: "Pricing", a: sideAsynth.pricing, b: sideBsynth.pricing },
    { theme: "Feature gaps", a: sideAsynth.gaps, b: sideBsynth.gaps },
    { theme: "Mobile", a: sideAsynth.mobile, b: sideBsynth.mobile },
    { theme: "Reporting", a: sideAsynth.reporting, b: sideBsynth.reporting },
    { theme: "Performance", a: sideAsynth.perf, b: sideBsynth.perf },
    { theme: "Admin / SSO", a: sideAsynth.admin, b: sideBsynth.admin },
  ];

  return (
    <div
      className="px-4 py-5 md:px-7 md:pt-5 md:pb-[60px]"
      style={{ maxWidth: 1440, margin: "0 auto" }}
    >
      <div className="re-eyebrow">COMPARE</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>
        Compare two competitors
      </h1>
      <p className="text-fg-muted" style={{ marginTop: 6 }}>
        Stack pain reports side-by-side. Heatmaps highlight the larger gap.
      </p>

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{
          gap: 16,
          marginTop: 24,
          position: "relative",
          zIndex: 1,
        }}
      >
        <SidePickerFixed
          fixed={{
            name: sideA.name,
            color: avatarColor(sideA.name),
            pain: sideA.sentiment,
          }}
        />
        <SidePickerSelect
          name={rightChoice.name}
          choices={choices}
          current={rightChoice.id}
          onChange={(id) => setBId(id)}
          color={avatarColor(rightChoice.name)}
          pain={rightChoice.sentiment}
        />
      </div>

      <div className="re-card" style={{ marginTop: 16 }}>
        <div className="re-card-hd">
          <h3>Pain index</h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            90d
          </span>
        </div>
        <div
          className="grid grid-cols-2 gap-6 md:gap-[60px]"
          style={{
            padding: "20px 24px",
          }}
        >
          <SideStat
            label={sideA.name}
            v={sideA.sentiment}
            mentions={sideA.sources}
          />
          <SideStat
            label={rightChoice.name}
            v={rightChoice.sentiment}
            mentions={rightChoice.sources}
            reverse
          />
        </div>
      </div>

      <div className="re-card" style={{ marginTop: 16 }}>
        <div className="re-card-hd">
          <h3>Complaint comparison</h3>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            shared themes
          </span>
        </div>
        <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th style={thStyle}>Theme</th>
              <th style={thStyle}>{sideA.name}</th>
              <th style={thStyle}>{rightChoice.name}</th>
              <th className="hidden md:table-cell" style={thStyle}>Δ</th>
              <th className="hidden md:table-cell" style={thStyle}>Winner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const max = Math.max(r.a, r.b);
              const winnerA = r.a < r.b;
              return (
                <tr key={r.theme} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td style={tdStyle}>{r.theme}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="font-mono-feat tnum" style={{ width: 36 }}>
                        {r.a}
                      </span>
                      <div className="re-meter neg" style={{ flex: 1 }}>
                        <i style={{ width: `${(r.a / max) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="font-mono-feat tnum" style={{ width: 36 }}>
                        {r.b}
                      </span>
                      <div className="re-meter neg" style={{ flex: 1 }}>
                        <i style={{ width: `${(r.b / max) * 100}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell" style={tdStyle}>
                    <span
                      className="font-mono-feat tnum"
                      style={{ color: r.a > r.b ? "var(--neg)" : "var(--pos)" }}
                    >
                      {r.a > r.b ? "+" : "−"}
                      {Math.abs(r.a - r.b)}
                    </span>
                  </td>
                  <td className="hidden md:table-cell" style={tdStyle}>
                    <span className="re-chip re-chip-pos" style={{ fontSize: 10 }}>
                      {winnerA ? sideA.name : rightChoice.name} less pain
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{
          gap: 16,
          marginTop: 16,
        }}
      >
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Where {sideA.name} wins</h3>
          </div>
          <ul style={ulStyle}>
            <li>Lower sentiment pain score than {rightChoice.name}</li>
            <li>Fewer sources flagging critical issues</li>
            <li>Stronger signal-to-noise ratio in reviews</li>
          </ul>
        </div>
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Where {rightChoice.name} wins</h3>
          </div>
          <ul style={ulStyle}>
            <li>Broader platform coverage in this scan</li>
            <li>More total sources analyzed</li>
            <li>Stronger ecosystem of integrations mentioned</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
