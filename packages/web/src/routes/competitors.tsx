import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import {
  useCompetitorsQuery,
  useCreateCompetitorMutation,
  useUpdateCompetitorMutation,
  useDeleteCompetitorMutation,
} from "@/hooks/queries/use-competitors";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import type {
  Competitor,
  CreateCompetitorPayload,
  UpdateCompetitorPayload,
} from "@/api/competitors";
import { formatRelative } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


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

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  // The axios interceptor rejects with the API's plain error envelope
  // ({ message, error }), which is not an Error instance.
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return fallback;
}

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
  tone?: "neg" | "warn" | "pos" | null;
}) {
  const color =
    tone === "neg"
      ? "var(--neg)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "pos"
          ? "var(--pos)"
          : "var(--fg)";
  return (
    <div>
      <div
        className="font-mono-feat"
        style={{
          fontSize: 10,
          color: "var(--fg-faint)",
          letterSpacing: "0.02em",
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
    <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-1.5 sm:gap-3 sm:items-center">
      <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>{label}</span>
      <div className="min-w-0">{children}</div>
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
  reportId,
  lastScanAt,
  onPrimary,
  onScan,
}: {
  c: Competitor;
  reportId: string | undefined;
  lastScanAt: string | null;
  onPrimary: () => void;
  onScan: () => void;
}) {
  const tags = c.tags ?? [];
  const color = c.color ?? pickColor(c.name);
  const sentiment = c.stat_sentiment;
  const sentimentTone: "pos" | "warn" | "neg" | null =
    sentiment == null ? null : sentiment <= -0.3 ? "neg" : sentiment < -0.05 ? "warn" : sentiment >= 0.15 ? "pos" : null;
  const hasReport = Boolean(reportId);

  return (
    <div
      className="re-card group"
      onClick={onPrimary}
      style={{ cursor: "pointer", display: "flex", flexDirection: "column", transition: "border-color 120ms, box-shadow 120ms" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-soft)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ padding: 14, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <CompetitorAvatar name={c.name} domain={c.website} size={36} borderRadius={8} color={color} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.name}
              </div>
              <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.website ?? ""}
              </div>
            </div>
          </div>
        </div>

        {(c.category || tags.length > 0) && (
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {c.category && (
              <span className="re-chip" style={{ fontSize: 10 }}>{c.category}</span>
            )}
            {tags.slice(0, 2).map((t) => (
              <span key={t} className="re-chip" style={{ fontSize: 10 }}>{t}</span>
            ))}
          </div>
        )}
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: 0 }} />

      <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <MicroStat label="Sentiment" value={sentiment != null ? sentiment.toFixed(2).replace("-", "−") : "—"} tone={sentimentTone} />
        <MicroStat label="Mentions" value={(c.stat_mentions ?? 0).toLocaleString()} />
        <MicroStat label="Last scan" value={lastScanAt ? formatRelative(lastScanAt) : "—"} />
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: 0 }} />

      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="flex items-center gap-1.5 font-mono-feat" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.03em" }}>
          {hasReport ? "View report" : "Run first scan"}
          <span className="transition-transform group-hover:translate-x-0.5" style={{ fontSize: 13 }}>→</span>
        </span>
        <button
          className="re-btn re-btn-ghost re-btn-sm"
          onClick={(e) => { e.stopPropagation(); onScan(); }}
          title="Re-scan"
        >
          <Icon name="scan" size={12} /> Rescan
        </button>
      </div>
    </div>
  );
}

type DrawerForm = {
  name: string;
  website: string;
  category: string;
  color: string;
  priority: Competitor["priority"];
  tags: string[];
  socials: Record<string, string>;
  monitor_enabled: boolean;
  monitor_sensitivity: Competitor["monitor_sensitivity"];
  monitor_watch: string[];
  notes: string;
};

function toForm(c: Competitor): DrawerForm {
  return {
    name: c.name,
    website: c.website ?? "",
    category: c.category ?? "",
    color: c.color ?? pickColor(c.name),
    priority: c.priority,
    tags: c.tags ?? [],
    socials: c.socials ?? {},
    monitor_enabled: c.monitor_enabled,
    monitor_sensitivity: c.monitor_sensitivity,
    monitor_watch: c.monitor_watch ?? [],
    notes: c.notes ?? "",
  };
}

function CompetitorDrawer({
  competitor,
  onSave,
  onDelete,
  onClose,
  saving,
}: {
  competitor: Competitor;
  onSave: (patch: UpdateCompetitorPayload) => void;
  onDelete: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [c, setC] = useState<DrawerForm>(() => toForm(competitor));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof DrawerForm>(k: K, v: DrawerForm[K]) =>
    setC((p) => ({ ...p, [k]: v }));
  const setSocial = (k: string, v: string) =>
    setC((p) => ({ ...p, socials: { ...p.socials, [k]: v } }));
  const toggleWatch = (id: string) => {
    setC((p) => ({
      ...p,
      monitor_watch: p.monitor_watch.includes(id)
        ? p.monitor_watch.filter((x) => x !== id)
        : [...p.monitor_watch, id],
    }));
  };

  const handleSave = () => {
    onSave({
      name: c.name,
      website: c.website || null,
      category: c.category || null,
      color: c.color,
      priority: c.priority,
      tags: c.tags,
      socials: c.socials,
      monitor_enabled: c.monitor_enabled,
      monitor_sensitivity: c.monitor_sensitivity,
      monitor_watch: c.monitor_watch,
      notes: c.notes || null,
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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-up w-[94vw] sm:w-[540px]"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          maxWidth: "100vw",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-soft)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="shrink-0"
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <CompetitorAvatar name={c.name} domain={c.website} size={36} borderRadius={8} color={c.color} />
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
          className="px-4 py-4 md:px-6 md:py-5"
          style={{ flex: 1, overflowY: "auto" }}
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
                          c.tags.filter((x) => x !== t),
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
                  value={c.monitor_enabled}
                  onChange={(v) => set("monitor_enabled", v)}
                />
                <span
                  style={{ fontSize: 12, color: "var(--fg-muted)" }}
                >
                  {c.monitor_enabled
                    ? "Radar is live · checking hourly"
                    : "Paused · no alerts will fire"}
                </span>
              </div>
            </Row>
            <Row label="Sensitivity">
              <div style={{ display: "flex", gap: 6 }}>
                {(["low", "med", "high"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`re-chip ${
                      c.monitor_sensitivity === s ? "re-chip-solid" : ""
                    }`}
                    style={{ cursor: "pointer", padding: "4px 12px" }}
                    onClick={() => set("monitor_sensitivity", s)}
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
                  const on = c.monitor_watch.includes(id);
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
              value={c.notes}
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
          className="px-4 py-3 md:px-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between sm:items-center shrink-0"
          style={{
            borderTop: "1px solid var(--border-soft)",
          }}
        >
          <button
            type="button"
            className="re-btn"
            style={{ color: "var(--neg)", borderColor: "transparent" }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete competitor
          </button>
          <div className="flex gap-2 justify-end">
            <button type="button" className="re-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="re-btn re-btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {competitor.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the competitor and all monitoring data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDelete(false);
                onDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddCompetitorModal({
  onSave,
  onClose,
  saving,
}: {
  onSave: (payload: CreateCompetitorPayload) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState("Project management");
  const [priority, setPriority] =
    useState<Competitor["priority"]>("secondary");
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

  const canSave = name.trim().length > 0 && !saving;
  const submit = () => {
    if (!canSave) return;
    const socials: Record<string, string> = {};
    if (linkedin) socials.linkedin = linkedin;
    if (twitter) socials.twitter = twitter;
    onSave({
      name: name.trim(),
      website: website || null,
      category: category || null,
      priority,
      color: pickColor(name),
      tags: [],
      socials,
      monitor_enabled: enableMonitor,
      monitor_sensitivity: "med",
      monitor_watch: ["linkedin", "twitter", "blog", "reddit"],
      notes: null,
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
        className="fade-up w-full max-w-[480px] max-h-[90vh] flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          borderRadius: 12,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        <div
          className="shrink-0"
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
        <div className="overflow-y-auto" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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
          className="shrink-0"
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
            {saving ? "Adding…" : "Add competitor"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitorsSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
        gap: 12,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} style={{ height: 180 }} />
      ))}
    </div>
  );
}

export function CompetitorsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useCompetitorsQuery();
  const { data: reports } = useReportsQuery();
  const createMutation = useCreateCompetitorMutation();
  const updateMutation = useUpdateCompetitorMutation();
  const deleteMutation = useDeleteCompetitorMutation();

  const list = useMemo(() => data ?? [], [data]);

  // Map each competitor (by name) to its most recent report. Reports come back
  // newest-first, so the first match wins.
  const reportByCompetitor = useMemo(() => {
    const map = new Map<string, { id: string; ranAt: string | null }>();
    for (const r of reports ?? []) {
      const names = [r.primary_competitor_name, ...(r.competitors ?? [])]
        .filter(Boolean)
        .map((n) => n!.toLowerCase());
      for (const n of names) {
        if (!map.has(n)) map.set(n, { id: r.id, ranAt: r.scanned_at ?? r.created_at });
      }
    }
    return map;
  }, [reports]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      list
        .filter((c) => {
          if (
            search &&
            !(c.name.toLowerCase() + (c.website ?? "")).includes(
              search.toLowerCase(),
            )
          )
            return false;
          return true;
        })
        .sort((a, b) => {
          const ta = new Date(a.added_at ?? a.created_at).getTime();
          const tb = new Date(b.added_at ?? b.created_at).getTime();
          return tb - ta; // newest first
        }),
    [list, search],
  );

  const editing = list.find((c) => c.id === editingId) ?? null;

  const handleCreate = (payload: CreateCompetitorPayload) => {
    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Competitor added");
        setShowAdd(false);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, "Failed to add competitor"));
      },
    });
  };

  const handleUpdate = (id: string, patch: UpdateCompetitorPayload) => {
    updateMutation.mutate(
      { id, payload: patch },
      {
        onSuccess: () => {
          toast.success("Competitor updated");
          setEditingId(null);
        },
        onError: (err) => {
          toast.error(getErrorMessage(err, "Failed to update competitor"));
        },
      },
    );
  };

  const handleToggleMonitor = (c: Competitor) => {
    updateMutation.mutate(
      { id: c.id, payload: { monitor_enabled: !c.monitor_enabled } },
      {
        onError: (err) => {
          toast.error(getErrorMessage(err, "Failed to toggle monitor"));
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Competitor deleted");
        setEditingId(null);
      },
      onError: (err) => {
        toast.error(getErrorMessage(err, "Failed to delete competitor"));
      },
    });
  };

  const onNav = (target: string) => {
    if (target === "report") navigate("/reports/linear");
    else navigate(`/${target}`);
  };


  return (
    <div
      className="px-4 pt-4 pb-12 md:px-7 md:pt-5"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end sm:gap-3 mb-6">
        <div className="min-w-0">
          <div className="re-eyebrow">Competitors</div>
          <h1 className="re-h1" style={{ marginTop: 8 }}>
            Tracked competitors
          </h1>
          <p
            className="max-w-full sm:max-w-[560px]"
            style={{
              marginTop: 6,
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
          className="re-btn re-btn-accent w-full sm:w-auto shrink-0"
          onClick={() => setShowAdd(true)}
        >
          <Icon name="plus" size={14} /> Add competitor
        </button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3 mb-4">
        <div
          className="w-full md:flex-1 md:max-w-[320px]"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            height: 32,
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
              minWidth: 0,
              border: 0,
              background: "transparent",
              outline: "none",
              fontSize: 13,
              height: "100%",
              color: "var(--fg)",
            }}
          />
        </div>
        <div className="flex gap-2 md:ml-auto">
          <span
            className="font-mono-feat"
            style={{ fontSize: 11, color: "var(--fg-faint)" }}
          >
            {filtered.length} of {list.length}
          </span>
        </div>
      </div>

      {isLoading ? (
        <CompetitorsSkeleton />
      ) : isError ? (
        <div
          className="re-card"
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--fg-muted)",
          }}
        >
          <div style={{ marginBottom: 12 }}>
            {getErrorMessage(error, "Failed to load competitors")}
          </div>
          <button
            type="button"
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      ) : list.length === 0 ? (
        <div
          className="re-card"
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--fg-muted)",
          }}
        >
          <div style={{ marginBottom: 12, fontSize: 14 }}>
            No competitors yet.
          </div>
          <button
            type="button"
            className="re-btn re-btn-accent re-btn-sm"
            onClick={() => setShowAdd(true)}
          >
            <Icon name="plus" size={12} /> Add your first competitor
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((c) => {
            const match = reportByCompetitor.get(c.name.toLowerCase());
            const reportId = match?.id;
            return (
              <CompetitorCard
                key={c.id}
                c={c}
                reportId={reportId}
                lastScanAt={match?.ranAt ?? null}
                onPrimary={() =>
                  reportId
                    ? navigate(`/scan-report/${reportId}`)
                    : navigate("/scan", { state: { prefillCompetitor: c.name } })
                }
                onScan={() => navigate("/scan", { state: { prefillCompetitor: c.name } })}
              />
            );
          })}
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
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddCompetitorModal
          onSave={handleCreate}
          onClose={() => setShowAdd(false)}
          saving={createMutation.isPending}
        />
      )}
    </div>
  );
}
