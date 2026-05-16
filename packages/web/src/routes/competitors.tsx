import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { MOCK_DATA } from "@/lib/mock/data";

type Competitor = {
  id: string;
  name: string;
  website: string;
  category: string;
  color: string;
  added: string;
  priority: string;
  tags: readonly string[] | string[];
  socials: Record<string, string | undefined>;
  monitor: {
    enabled: boolean;
    sensitivity: string;
    watch: readonly string[] | string[];
  };
  stats: {
    sentiment: number;
    mentions: number;
    alerts7d: number;
    lastActivity: string;
  };
  notes?: string;
};

type FilterKey = "all" | "active" | "paused" | "primary";

const PALETTE = [
  "#5e6ad2",
  "#f24e1e",
  "#0ea5e9",
  "#16a34a",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#06b6d4",
  "#3469f4",
  "#f06a6a",
];

function pickColor(name: string): string {
  let s = 0;
  for (const ch of name) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[s % PALETTE.length] ?? "#5e6ad2";
}

const PLATFORM_LETTER: Record<string, string> = {
  linkedin: "in",
  twitter: "X",
  youtube: "YT",
  producthunt: "P",
  github: "GH",
  blog: "B",
  reddit: "R",
  g2: "G2",
};

function PlatformChip({ id, dim }: { id: string; dim: boolean }) {
  return (
    <span
      title={id}
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: 18,
        height: 18,
        borderRadius: 4,
        border: "1px solid var(--border-strong)",
        background: "var(--surface)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: 9,
        fontWeight: 600,
        color: dim ? "var(--fg-faint)" : "var(--fg-muted)",
        textTransform: "uppercase",
        letterSpacing: 0,
      }}
    >
      {PLATFORM_LETTER[id] ?? id.slice(0, 2)}
    </span>
  );
}

function MonitorToggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 99,
        background: on ? "rgba(22,163,74,0.08)" : "var(--surface-2)",
        border: `1px solid ${on ? "rgba(22,163,74,0.3)" : "var(--border-soft)"}`,
        cursor: "pointer",
      }}
    >
      <span
        className={`re-dot ${on ? "re-dot-pos" : ""}`}
        style={{ animation: on ? "pulse-dot 1.6s ease-in-out infinite" : "none" }}
      />
      <span
        className="font-mono-feat"
        style={{
          fontSize: 10,
          color: on ? "var(--pos)" : "var(--fg-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {on ? "Monitoring" : "Paused"}
      </span>
    </div>
  );
}

function MicroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "neg" | "warn" | null;
}) {
  const color =
    tone === "neg"
      ? "var(--neg)"
      : tone === "warn"
        ? "var(--warn)"
        : "var(--fg)";
  return (
    <div>
      <div
        className="font-mono-feat"
        style={{
          fontSize: 9,
          color: "var(--fg-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        className="font-mono-feat tnum"
        style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color }}
      >
        {value}
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        padding: 0,
        border: "1px solid var(--border-strong)",
        borderRadius: 99,
        background: value ? "var(--accent)" : "var(--surface-2)",
        position: "relative",
        cursor: "pointer",
        transition: "background 120ms",
      }}
      aria-pressed={value}
    >
      <span
        style={{
          position: "absolute",
          top: 1,
          left: value ? 17 : 1,
          width: 16,
          height: 16,
          borderRadius: 99,
          background: "#fff",
          boxShadow: "var(--shadow-sm)",
          transition: "left 120ms",
        }}
      />
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Section({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 10 }}>
        <div className="re-eyebrow" style={{ fontSize: 10 }}>
          {label}
        </div>
        {sub && (
          <div
            style={{ fontSize: 11, marginTop: 2, color: "var(--fg-muted)" }}
          >
            {sub}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </section>
  );
}

function CompetitorCard({
  c,
  onOpen,
  onToggle,
  onScan,
}: {
  c: Competitor;
  onOpen: () => void;
  onToggle: () => void;
  onScan: () => void;
}) {
  const socialKeys = Object.keys(c.socials || {});
  return (
    <div
      className="re-card"
      onClick={onOpen}
      style={{ cursor: "pointer", transition: "border-color 100ms, box-shadow 100ms" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-soft)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: c.color,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: 16,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {c.name[0]}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {c.name}
              </div>
              <div
                className="font-mono-feat"
                style={{
                  fontSize: 11,
                  color: "var(--fg-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.website}
              </div>
            </div>
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <MonitorToggle on={c.monitor.enabled} />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <span className="re-chip" style={{ fontSize: 10 }}>
            {c.category}
          </span>
          <span
            className={`re-chip ${c.priority === "primary" ? "re-chip-accent" : ""}`}
            style={{ fontSize: 10 }}
          >
            {c.priority}
          </span>
          {c.tags.slice(0, 2).map((t) => (
            <span key={t} className="re-chip" style={{ fontSize: 10 }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <hr
        style={{
          border: 0,
          borderTop: "1px solid var(--border-soft)",
          margin: 0,
        }}
      />

      <div
        style={{
          padding: "10px 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
        }}
      >
        <MicroStat
          label="Sentiment"
          value={c.stats.sentiment.toFixed(2)}
          tone="neg"
        />
        <MicroStat label="Mentions" value={c.stats.mentions.toLocaleString()} />
        <MicroStat
          label="Alerts 7d"
          value={c.stats.alerts7d}
          tone={c.stats.alerts7d > 5 ? "warn" : null}
        />
      </div>

      <hr
        style={{
          border: 0,
          borderTop: "1px solid var(--border-soft)",
          margin: 0,
        }}
      />

      <div
        style={{
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {socialKeys.slice(0, 5).map((k) => {
            const watched =
              c.monitor.watch.includes(k) || k === "linkedin" || k === "twitter";
            return <PlatformChip key={k} id={k} dim={!watched} />;
          })}
          {socialKeys.length > 5 && (
            <span
              className="font-mono-feat"
              style={{ fontSize: 10, color: "var(--fg-faint)" }}
            >
              +{socialKeys.length - 5}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="font-mono-feat"
            style={{ fontSize: 10, color: "var(--fg-faint)" }}
          >
            last activity {c.stats.lastActivity}
          </span>
          <button
            className="re-btn re-btn-ghost re-btn-sm re-btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onScan();
            }}
            title="Run scan"
          >
            <Icon name="scan" size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitorDrawer({
  competitor,
  onSave,
  onDelete,
  onClose,
}: {
  competitor: Competitor;
  onSave: (c: Competitor) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [c, setC] = useState<Competitor>(competitor);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Competitor>(k: K, v: Competitor[K]) =>
    setC((p) => ({ ...p, [k]: v }));
  const setSocial = (k: string, v: string) =>
    setC((p) => ({ ...p, socials: { ...p.socials, [k]: v } }));
  const setMonitor = <K extends keyof Competitor["monitor"]>(
    k: K,
    v: Competitor["monitor"][K],
  ) => setC((p) => ({ ...p, monitor: { ...p.monitor, [k]: v } }));
  const toggleWatch = (id: string) => {
    const list = c.monitor.watch as string[];
    setMonitor(
      "watch",
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 540,
          maxWidth: "90vw",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-soft)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: c.color,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {c.name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="re-eyebrow" style={{ fontSize: 10 }}>
              COMPETITOR
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</div>
          </div>
          <button
            className="re-btn re-btn-ghost re-btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div
          style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}
        >
          <Section label="BASICS">
            <Row label="Name">
              <input
                className="re-input"
                value={c.name}
                onChange={(e) => set("name", e.target.value)}
                style={{ width: "100%" }}
              />
            </Row>
            <Row label="Website">
              <input
                className="re-input"
                value={c.website}
                onChange={(e) => set("website", e.target.value)}
                style={{ width: "100%" }}
                placeholder="example.com"
              />
            </Row>
            <Row label="Category">
              <input
                className="re-input"
                value={c.category}
                onChange={(e) => set("category", e.target.value)}
                style={{ width: "100%" }}
              />
            </Row>
            <Row label="Priority">
              <div style={{ display: "flex", gap: 6 }}>
                {(["primary", "secondary", "tertiary"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`re-chip ${
                      c.priority === p
                        ? p === "primary"
                          ? "re-chip-accent"
                          : "re-chip-solid"
                        : ""
                    }`}
                    style={{ cursor: "pointer", padding: "4px 12px" }}
                    onClick={() => set("priority", p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Tags">
              <div
                style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
              >
                {c.tags.map((t) => (
                  <span
                    key={t}
                    className="re-chip"
                    style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {t}
                    <span
                      onClick={() =>
                        set(
                          "tags",
                          (c.tags as string[]).filter((x) => x !== t),
                        )
                      }
                      style={{ cursor: "pointer", display: "inline-flex" }}
                    >
                      <Icon name="x" size={10} />
                    </span>
                  </span>
                ))}
                <button
                  type="button"
                  className="re-btn re-btn-ghost re-btn-sm"
                  style={{ height: 22, padding: "0 8px", fontSize: 11 }}
                >
                  + Add tag
                </button>
              </div>
            </Row>
          </Section>

          <Section
            label="SOCIAL PRESENCE"
            sub="Links we'll resolve & monitor"
          >
            {(
              [
                ["linkedin", "LinkedIn", "linkedin.com/company/…"],
                ["twitter", "X / Twitter", "@handle"],
                ["github", "GitHub", "github.com/org"],
                ["youtube", "YouTube", "youtube.com/@channel"],
                ["producthunt", "Product Hunt", "producthunt.com/products/…"],
                ["blog", "Blog / RSS", "example.com/blog"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <Row key={key} label={label}>
                <input
                  className="re-input"
                  value={c.socials[key] || ""}
                  onChange={(e) => setSocial(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ width: "100%" }}
                />
              </Row>
            ))}
          </Section>

          <Section
            label="RADAR MONITOR"
            sub="What to watch — and how aggressively"
          >
            <Row label="Enabled">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Toggle
                  value={c.monitor.enabled}
                  onChange={(v) => setMonitor("enabled", v)}
                />
                <span
                  style={{ fontSize: 12, color: "var(--fg-muted)" }}
                >
                  {c.monitor.enabled
                    ? "Radar is live · checking hourly"
                    : "Paused · no alerts will fire"}
                </span>
              </div>
            </Row>
            <Row label="Sensitivity">
              <div style={{ display: "flex", gap: 6 }}>
                {(["low", "med", "high", "paranoid"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`re-chip ${
                      c.monitor.sensitivity === s ? "re-chip-solid" : ""
                    }`}
                    style={{ cursor: "pointer", padding: "4px 12px" }}
                    onClick={() => setMonitor("sensitivity", s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Watch on">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 6,
                }}
              >
                {(
                  [
                    ["linkedin", "LinkedIn posts"],
                    ["twitter", "X / Twitter"],
                    ["youtube", "YouTube uploads"],
                    ["producthunt", "Product Hunt launches"],
                    ["blog", "Blog & changelog"],
                    ["reddit", "Reddit mentions"],
                    ["g2", "G2 reviews"],
                    ["changelog", "Pricing & docs"],
                  ] as const
                ).map(([id, label]) => {
                  const on = (c.monitor.watch as string[]).includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleWatch(id)}
                      className="re-btn"
                      style={{
                        justifyContent: "flex-start",
                        height: 30,
                        background: on ? "var(--accent-soft)" : "var(--surface)",
                        borderColor: on ? "var(--accent)" : "var(--border-strong)",
                        color: on ? "var(--accent)" : "var(--fg-muted)",
                        fontSize: 12,
                        fontWeight: 400,
                        padding: "0 10px",
                      }}
                    >
                      {on ? (
                        <Icon name="check" size={12} />
                      ) : (
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            border: "1.2px solid currentColor",
                            borderRadius: 3,
                          }}
                        />
                      )}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </Row>
          </Section>

          <Section label="NOTES">
            <textarea
              value={c.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Internal notes — what makes them a threat, what to watch for…"
              style={{
                width: "100%",
                minHeight: 80,
                padding: 10,
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                background: "var(--surface)",
                fontFamily: "var(--font-sans, ui-sans-serif, system-ui)",
                fontSize: 13,
                color: "var(--fg)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </Section>
        </div>

        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border-soft)",
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <button
            type="button"
            className="re-btn"
            style={{ color: "var(--neg)", borderColor: "transparent" }}
            onClick={onDelete}
          >
            Delete competitor
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="re-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="re-btn re-btn-primary"
              onClick={() => onSave(c)}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddCompetitorModal({
  onSave,
  onClose,
}: {
  onSave: (c: Competitor) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("Project management");
  const [priority, setPriority] = useState("secondary");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [enableMonitor, setEnableMonitor] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = name.trim().length > 0;
  const submit = () => {
    if (!canSave) return;
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `c-${Date.now()}`;
    const color = pickColor(name);
    const socials: Record<string, string> = {};
    if (linkedin) socials.linkedin = linkedin;
    if (twitter) socials.twitter = twitter;
    onSave({
      id,
      name,
      website,
      category,
      priority,
      color,
      added: new Date().toISOString().slice(0, 10),
      tags: [],
      socials,
      monitor: {
        enabled: enableMonitor,
        sensitivity: "med",
        watch: ["linkedin", "twitter", "blog", "reddit"],
      },
      stats: { sentiment: 0, mentions: 0, alerts7d: 0, lastActivity: "—" },
      notes: "",
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(2px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up"
        style={{
          width: 480,
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div className="re-eyebrow" style={{ fontSize: 10 }}>
              NEW
            </div>
            <h3
              style={{
                margin: "2px 0 0",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Add a competitor
            </h3>
          </div>
          <button
            className="re-btn re-btn-ghost re-btn-icon"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="Name *">
            <input
              className="re-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Linear, Notion, Figma…"
              autoFocus
              style={{ width: "100%" }}
            />
          </Row>
          <Row label="Website">
            <input
              className="re-input"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="example.com"
              style={{ width: "100%" }}
            />
          </Row>
          <Row label="Category">
            <input
              className="re-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: "100%" }}
            />
          </Row>
          <Row label="Priority">
            <div style={{ display: "flex", gap: 6 }}>
              {(["primary", "secondary", "tertiary"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`re-chip ${priority === p ? "re-chip-solid" : ""}`}
                  style={{ cursor: "pointer", padding: "4px 12px" }}
                  onClick={() => setPriority(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </Row>
          <Row label="LinkedIn">
            <input
              className="re-input"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              placeholder="linkedin.com/company/…"
              style={{ width: "100%" }}
            />
          </Row>
          <Row label="X / Twitter">
            <input
              className="re-input"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="@handle"
              style={{ width: "100%" }}
            />
          </Row>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "var(--surface-2)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                Enable radar monitor
              </div>
              <div
                style={{ fontSize: 11, color: "var(--fg-muted)" }}
              >
                Start watching for launches, leaks, and viral threads
              </div>
            </div>
            <Toggle value={enableMonitor} onChange={setEnableMonitor} />
          </div>
        </div>
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--border-soft)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button type="button" className="re-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="re-btn re-btn-accent"
            disabled={!canSave}
            onClick={submit}
            style={{ opacity: canSave ? 1 : 0.5 }}
          >
            Add competitor
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompetitorsPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Competitor[]>(
    () => MOCK_DATA.competitors as unknown as Competitor[],
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      list.filter((c) => {
        if (filter === "active" && !c.monitor.enabled) return false;
        if (filter === "paused" && c.monitor.enabled) return false;
        if (filter === "primary" && c.priority !== "primary") return false;
        if (
          search &&
          !(c.name.toLowerCase() + c.website).includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [list, filter, search],
  );

  const saveCompetitor = (updated: Competitor) => {
    setList((prev) => {
      const exists = prev.find((c) => c.id === updated.id);
      if (exists) return prev.map((c) => (c.id === updated.id ? updated : c));
      return [updated, ...prev];
    });
    setEditingId(null);
    setShowAdd(false);
  };

  const deleteCompetitor = (id: string) => {
    setList((prev) => prev.filter((c) => c.id !== id));
    setEditingId(null);
  };

  const editing = list.find((c) => c.id === editingId) ?? null;

  const onNav = (target: string) => {
    if (target === "report") navigate("/reports/linear");
    else navigate(`/${target}`);
  };

  const filters: ReadonlyArray<[FilterKey, string]> = [
    ["all", `All (${list.length})`],
    [
      "active",
      `Active (${list.filter((c) => c.monitor.enabled).length})`,
    ],
    [
      "paused",
      `Paused (${list.filter((c) => !c.monitor.enabled).length})`,
    ],
    ["primary", "Primary"],
  ];

  return (
    <div
      style={{
        padding: "20px 28px 60px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 24,
        }}
      >
        <div>
          <div className="re-eyebrow">COMPETITORS</div>
          <h1 className="re-h1" style={{ marginTop: 8 }}>
            Tracked competitors
          </h1>
          <p
            style={{
              marginTop: 6,
              maxWidth: 560,
              color: "var(--fg-muted)",
              fontSize: 13,
            }}
          >
            Add anyone you compete with — direct, adjacent, wildcards.
            Toggle the radar and we'll watch every platform they touch.
          </p>
        </div>
        <button
          type="button"
          className="re-btn re-btn-accent"
          onClick={() => setShowAdd(true)}
        >
          <Icon name="plus" size={14} /> Add competitor
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            height: 32,
            flex: 1,
            maxWidth: 320,
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            background: "var(--surface)",
          }}
        >
          <Icon name="search" size={14} style={{ color: "var(--fg-faint)" }} />
          <input
            placeholder="Search competitors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 0,
              background: "transparent",
              outline: "none",
              fontSize: 13,
              height: "100%",
              color: "var(--fg)",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {filters.map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={`re-chip ${filter === k ? "re-chip-solid" : ""}`}
              style={{ cursor: "pointer", padding: "4px 12px" }}
              onClick={() => setFilter(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <div
          style={{ marginLeft: "auto", display: "flex", gap: 8 }}
        >
          <span
            className="font-mono-feat"
            style={{ fontSize: 11, color: "var(--fg-faint)" }}
          >
            {filtered.length} of {list.length}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
        }}
      >
        {filtered.map((c) => (
          <CompetitorCard
            key={c.id}
            c={c}
            onOpen={() => setEditingId(c.id)}
            onToggle={() =>
              saveCompetitor({
                ...c,
                monitor: { ...c.monitor, enabled: !c.monitor.enabled },
              })
            }
            onScan={() =>
              c.id === "linear" ? onNav("report") : onNav("scan")
            }
          />
        ))}
        {filtered.length === 0 && (
          <div
            className="re-card"
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--fg-muted)",
              gridColumn: "1/-1",
            }}
          >
            No competitors match.{" "}
            <button
              type="button"
              className="re-btn re-btn-ghost re-btn-sm"
              onClick={() => {
                setFilter("all");
                setSearch("");
              }}
            >
              clear filters
            </button>
          </div>
        )}
      </div>

      {editing && (
        <CompetitorDrawer
          competitor={editing}
          onSave={saveCompetitor}
          onDelete={() => deleteCompetitor(editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}

      {showAdd && (
        <AddCompetitorModal
          onSave={saveCompetitor}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
