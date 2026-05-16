import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { MOCK_DATA } from "@/lib/mock/data";
import { Icon } from "@/components/icons";

type HistoryEntry = (typeof MOCK_DATA.history)[number];

const AVATAR_COLORS: Record<string, string> = {
  Notion: "#000",
  Figma: "#f24e1e",
  Superhuman: "#503ce6",
  Slack: "#4a154b",
  Asana: "#f06a6a",
};

const avatarColor = (name: string): string => AVATAR_COLORS[name] ?? "#444";

interface SynthesizedSide {
  pricing: number;
  gaps: number;
  mobile: number;
  reporting: number;
  perf: number;
  admin: number;
}

function synthesizeCompetitor(h: HistoryEntry): SynthesizedSide {
  let s = 0;
  for (const c of h.name) s = (s * 31 + c.charCodeAt(0)) >>> 0;
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
  choices: HistoryEntry[];
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
        <div>
          <h3 className="re-h3" style={{ fontSize: 18 }}>{fixed.name}</h3>
          <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            your current focus
          </div>
        </div>
      </div>
    </div>
  );
}

function SidePickerSelect({ name, choices, current, onChange, color }: SidePickerSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div className="re-eyebrow">SIDE B · SELECT</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <div
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
        <div ref={wrapRef} style={{ position: "relative", flex: 1 }}>
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
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span>{name}</span>
            <Icon name="chev-down" size={14} />
          </button>
          {open && (
            <>
              <div
                onClick={() => setOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 20 }}
              />
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
  delta: string;
  reverse?: boolean;
}

function SideStat({ label, v, mentions, delta, reverse }: SideStatProps) {
  return (
    <div style={{ textAlign: reverse ? "right" : "left" }}>
      <div className="re-eyebrow">{label}</div>
      <div
        className="font-mono-feat tnum"
        style={{
          fontSize: 36,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--neg)",
          marginTop: 4,
        }}
      >
        {v.toFixed(2)}
      </div>
      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
        {mentions.toLocaleString()} mentions · {delta} vs prev
      </div>
    </div>
  );
}

export function ComparePage() {
  // navigate is wired for future onNav-style screen switches.
  const navigate = useNavigate();
  void navigate;

  const [b, setB] = useState("notion");
  const choices = useMemo(
    () => MOCK_DATA.history.filter((h) => h.id !== "linear"),
    [],
  );
  const right = choices.find((c) => c.id === b) ?? choices[0]!;
  const sideB = synthesizeCompetitor(right);

  const rows = [
    { theme: "Pricing", a: 187, b: sideB.pricing },
    { theme: "Feature gaps", a: 152, b: sideB.gaps },
    { theme: "Mobile", a: 134, b: sideB.mobile },
    { theme: "Reporting", a: 119, b: sideB.reporting },
    { theme: "Performance", a: 74, b: sideB.perf },
    { theme: "Admin / SSO", a: 96, b: sideB.admin },
  ];

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
      <div className="re-eyebrow">COMPARE</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>
        Compare two competitors
      </h1>
      <p className="text-fg-muted" style={{ marginTop: 6 }}>
        Stack pain reports side-by-side. Heatmaps highlight the larger gap.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 24,
        }}
      >
        <SidePickerFixed
          fixed={{
            name: "Linear",
            color: "#5e6ad2",
            pain: MOCK_DATA.competitor.sentiment.overall,
          }}
        />
        <SidePickerSelect
          name={right.name}
          choices={choices}
          current={b}
          onChange={setB}
          color={avatarColor(right.name)}
          pain={right.pain}
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
          style={{
            padding: "20px 24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 60,
          }}
        >
          <SideStat
            label="Linear"
            v={MOCK_DATA.competitor.sentiment.overall}
            mentions={MOCK_DATA.competitor.sources}
            delta="+0.08"
          />
          <SideStat
            label={right.name}
            v={right.pain}
            mentions={right.mentions}
            delta="+0.02"
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th style={thStyle}>Theme</th>
              <th style={thStyle}>Linear</th>
              <th style={thStyle}>{right.name}</th>
              <th style={thStyle}>Δ</th>
              <th style={thStyle}>Winner</th>
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
                  <td style={tdStyle}>
                    <span
                      className="font-mono-feat tnum"
                      style={{ color: r.a > r.b ? "var(--neg)" : "var(--pos)" }}
                    >
                      {r.a > r.b ? "+" : "−"}
                      {Math.abs(r.a - r.b)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span className="re-chip re-chip-pos" style={{ fontSize: 10 }}>
                      {winnerA ? "Linear" : right.name} less pain
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Where Linear wins</h3>
          </div>
          <ul style={ulStyle}>
            <li>Praised for speed and keyboard-driven UX</li>
            <li>Lower pricing pain than {right.name}&apos;s enterprise tier</li>
            <li>Cleaner onboarding cited in 38 posts</li>
          </ul>
        </div>
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Where {right.name} wins</h3>
          </div>
          <ul style={ulStyle}>
            <li>
              {right.name === "Notion"
                ? "Flexibility for non-engineering teams"
                : "Familiarity in larger orgs"}
            </li>
            <li>
              {right.name === "Notion"
                ? "Documentation in the same surface"
                : "Better mobile parity"}
            </li>
            <li>Stronger ecosystem of integrations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
