import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { MOCK_DATA } from "@/lib/mock/data";

type NavTarget = "scan" | "report" | "dashboard" | "radar" | "competitors" | "compare" | "history" | "account" | "signin";

function navPath(t: NavTarget): string {
  switch (t) {
    case "scan":        return "/scan";
    case "report":      return "/reports/linear";
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

const GOALS = [
  { id: "validate",    label: "Validate an idea",         hint: "Focus on pain intensity & market demand" },
  { id: "weakness",    label: "Find competitor weakness", hint: "Where to attack · wedge angles" },
  { id: "positioning", label: "Improve positioning",      hint: "Messaging angles · copy ideas" },
  { id: "mvp",         label: "Decide MVP features",      hint: "Feature gaps · repeated requests" },
  { id: "track",       label: "Track over time",          hint: "Sentiment, alerts, switching signals" },
] as const;

const RANGES = [
  { v: "30d", l: "30 days" },
  { v: "90d", l: "90 days" },
  { v: "1y",  l: "1 year" },
  { v: "all", l: "All time" },
] as const;

const DEPTHS = [
  { v: "fast",     l: "Fast",     d: "Sentiment + top complaints" },
  { v: "standard", l: "Standard", d: "+ feature gaps & switching" },
  { v: "deep",     l: "Deep",     d: "+ quote extraction, threading" },
] as const;

export function ScanPage() {
  const navigate = useNavigate();
  const onNav = (t: NavTarget) => navigate(navPath(t));

  const competitors = MOCK_DATA.competitors;

  const [name, setName] = useState("Linear");
  const [pickedId, setPickedId] = useState<string | null>("linear");
  const [category, setCategory] = useState("Project management");
  const [range, setRange] = useState<string>("90d");
  const [platforms, setPlatforms] = useState<Record<PlatformId, boolean>>({
    reddit: true, g2: true, linkedin: true, producthunt: true,
    twitter: true, youtube: false, appstore: false, hn: false,
  });
  const [goal, setGoal] = useState<string>("weakness");
  const [depth, setDepth] = useState<string>("standard");
  const [scanning, setScanning] = useState(false);

  const start = () => setScanning(true);

  if (scanning) {
    return (
      <ScanRunning
        competitor={name}
        onDone={() => onNav("report")}
        onCancel={() => setScanning(false)}
      />
    );
  }

  const selectedPlatformCount = Object.values(platforms).filter(Boolean).length;
  const goalLabel = GOALS.find((g) => g.id === goal)?.label.toLowerCase() ?? "";
  const rangeLabel = RANGES.find((r) => r.v === range)?.l ?? "";

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
        {competitors.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginBottom: 8 }}>
              FROM YOUR TRACKED LIST
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
              {competitors.slice(0, 8).map((c) => {
                const on = pickedId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setPickedId(c.id); setName(c.name); setCategory(c.category); }}
                    className="re-btn"
                    style={{
                      justifyContent: "flex-start", height: 44, padding: "0 10px",
                      background: on ? "var(--accent-soft)" : "var(--surface)",
                      borderColor: on ? "var(--accent)" : "var(--border-strong)",
                      gap: 10,
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 5,
                      background: c.color, color: "#fff",
                      display: "grid", placeItems: "center",
                      fontFamily: "Geist Mono, ui-monospace, monospace",
                      fontSize: 12, fontWeight: 600, flexShrink: 0,
                    }}>{c.name[0]}</div>
                    <div style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </div>
                      <div className="font-mono-feat text-fg-faint" style={{
                        fontSize: 10, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {c.website}
                      </div>
                    </div>
                  </button>
                );
              })}
              <button
                onClick={() => { /* add-competitor flow: TODO */ }}
                className="re-btn"
                style={{
                  justifyContent: "center", height: 44,
                  background: "var(--surface-2)",
                  borderStyle: "dashed", borderColor: "var(--border-strong)",
                  color: "var(--fg-muted)",
                  gap: 6,
                }}
              >
                <Icon name="plus" size={14} /> New competitor
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0" }}>
          <hr style={{ flex: 1, border: 0, height: 1, background: "var(--border-soft)" }} />
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 10, padding: "0 8px" }}>
            OR SEARCH UNTRACKED
          </span>
          <hr style={{ flex: 1, border: 0, height: 1, background: "var(--border-soft)" }} />
        </div>

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
              onChange={(e) => { setName(e.target.value); setPickedId(null); }}
              placeholder="Competitor name or domain"
            />
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>auto-suggesting…</span>
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

      <Step n={2} label="What are you trying to learn?">
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

      <Step n={3} label="Time range">
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

      <Step n={4} label="Platforms to scan">
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

      <Step n={5} label="Analysis depth">
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
            <b>{name}</b> · {goalLabel} · {rangeLabel} · {selectedPlatformCount} platforms · {depth}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="re-btn" onClick={() => onNav("dashboard")}>Cancel</button>
          <button className="re-btn re-btn-accent" onClick={start} style={{ height: 36 }}>
            Run scan <Icon name="arrow-right" size={14} />
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

interface ScanRunningProps {
  competitor: string;
  onDone: () => void;
  onCancel: () => void;
}

interface ScanStep {
  id: string;
  label: string;
  time: number;
  sub?: string;
}

function ScanRunning({ competitor, onDone, onCancel }: ScanRunningProps) {
  const STEPS: ScanStep[] = [
    { id: "auth",    label: "Authenticating platform connectors",  time: 600 },
    { id: "crawl",   label: "Crawling Reddit · G2 · LinkedIn · Product Hunt · X", time: 2400, sub: "412 threads · 287 reviews · 184 posts…" },
    { id: "filter",  label: "Filtering for competitor mentions",   time: 1600 },
    { id: "score",   label: "Scoring sentiment & intent",          time: 1500 },
    { id: "cluster", label: "Clustering complaints",               time: 1800 },
    { id: "extract", label: "Extracting verbatim quotes & leads",  time: 1200 },
    { id: "angles",  label: "Generating positioning angles",       time: 1000 },
    { id: "rank",    label: "Ranking insights",                    time: 900 },
  ];
  const totalTime = STEPS.reduce((a, b) => a + b.time, 0);

  const [stepIdx, setStepIdx] = useState(0);
  const [counts, setCounts] = useState({ threads: 0, comments: 0, quotes: 0, complaints: 0 });
  const [done, setDone] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (done) {
      const t = setTimeout(onDone, 800);
      return () => clearTimeout(t);
    }
    if (stepIdx >= STEPS.length) {
      setDone(true);
      return;
    }
    const current = STEPS[stepIdx];
    if (!current) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setStepIdx(stepIdx + 1), current.time);
    return () => clearTimeout(t);
  }, [stepIdx, done]);

  useEffect(() => {
    const id = setInterval(() => {
      setCounts((c) => ({
        threads:   Math.min(412,  c.threads  + Math.round(Math.random() * 14 + 4)),
        comments:  Math.min(8347, c.comments + Math.round(Math.random() * 110 + 30)),
        quotes:    Math.min(186,  c.quotes   + Math.round(Math.random() * 3)),
        complaints:Math.min(8,    c.complaints + (Math.random() < 0.06 ? 1 : 0)),
      }));
    }, 220);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const samples = [
      "GET reddit.com/r/SaaS/search.json?q=linear&t=year → 200",
      "→ matched 'Linear pricing' in r/SaaS",
      "  sentiment(-0.72) on 412-char excerpt",
      "GET g2.com/products/linear/reviews?stars=1-3 → 200",
      "→ 287 detractor reviews parsed",
      "GET linkedin.com/search/results/content?q=linear+pricing → 200",
      "→ 184 founder/PM posts collected",
      "GET producthunt.com/topics/project-management/alternatives → 200",
      "→ 142 'alternative to Linear' threads found",
      "GET x.com/search?q=leaving+linear&f=live → 200",
      "cluster 'Pricing' → 187 mentions (Δ+34%)",
      "cluster 'Time tracking' → 152 mentions",
      "cluster 'Mobile' → 134 mentions",
      "high-intent lead detected → u/founder_42 (signal 0.91)",
      "deduping 47 cross-posts",
      "generating positioning angles → 4 candidates",
      "ranking insights by severity × frequency",
      "rendering pain index → -0.34 (90d trend +0.08)",
    ];
    const id = setInterval(() => {
      setLogLines((prev) => {
        const pick = samples[Math.floor(Math.random() * samples.length)] ?? "";
        const next = [...prev, pick];
        return next.slice(-40);
      });
    }, 380);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  const progress = done ? 1 : Math.min(1, stepIdx / STEPS.length);

  return (
    <div style={{ padding: "20px 28px 48px", maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="re-eyebrow">{done ? "SCAN COMPLETE" : "SCAN IN PROGRESS"}</div>
          <h1 className="re-h1" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12 }}>
            {competitor}
            {!done && <span className="re-dot re-dot-live" />}
          </h1>
        </div>
        <button className="re-btn" onClick={onCancel} disabled={done}>
          <Icon name="x" size={14} /> Cancel
        </button>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12,
        marginTop: 28,
      }}>
        <LiveCount label="Threads scanned"      v={counts.threads} />
        <LiveCount label="Comments parsed"      v={counts.comments} />
        <LiveCount label="Quotes extracted"     v={counts.quotes} />
        <LiveCount label="Complaints clustered" v={counts.complaints} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Pipeline</h3>
            <span className="font-mono-feat tnum text-fg-faint" style={{ fontSize: 11 }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {STEPS.map((s, i) => {
              const state = i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  opacity: state === "pending" ? 0.4 : 1,
                  transition: "opacity 200ms ease",
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 99,
                    display: "grid", placeItems: "center",
                    background: state === "done" ? "var(--pos)" : state === "active" ? "var(--accent-soft)" : "var(--surface-2)",
                    color: state === "done" ? "#fff" : "var(--accent)",
                    border: state === "active" ? "1px solid var(--accent)" : "0",
                    flexShrink: 0,
                  }}>
                    {state === "done" ? (
                      <Icon name="check" size={11} />
                    ) : state === "active" ? (
                      <span className="re-dot re-dot-live" style={{ width: 5, height: 5, background: "var(--accent)" }} />
                    ) : null}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: state === "active" ? 500 : 400 }}>{s.label}</div>
                    {s.sub && state === "active" && (
                      <div className="font-mono-feat text-fg-faint" style={{ fontSize: 11, marginTop: 2 }}>
                        {s.sub}
                      </div>
                    )}
                  </div>
                  {state === "active" && (
                    <span className="font-mono-feat blink" style={{ fontSize: 11, color: "var(--accent)" }}>running</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="re-card" style={{ background: "var(--bg-sunken)" }}>
          <div className="re-card-hd">
            <h3 style={{ fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 12 }}>
              <span style={{ color: "var(--fg-faint)" }}>$</span> rivaleye scan
            </h3>
            <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>live log</span>
          </div>
          <div
            ref={logRef}
            style={{
              padding: 14,
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 11.5,
              lineHeight: 1.6,
              height: 308,
              overflowY: "auto",
              color: "var(--fg-muted)",
            }}
          >
            {logLines.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "var(--fg-faint)" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{
                  flex: 1,
                  color: l.startsWith("→") ? "var(--accent)" : l.startsWith("cluster") ? "var(--fg)" : "var(--fg-muted)",
                }}>{l}</span>
              </div>
            ))}
            {!done && (
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "var(--fg-faint)" }}>{String(logLines.length + 1).padStart(2, "0")}</span>
                <span className="blink">▍</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="re-meter" style={{ height: 6 }}>
          <i style={{ width: `${progress * 100}%`, background: done ? "var(--pos)" : "var(--accent)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span className="font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            ~{Math.max(0, Math.round((1 - progress) * (totalTime / 1000)))}s remaining
          </span>
          {done && (
            <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--pos)" }}>
              ✓ scan complete — opening report
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveCount({ label, v }: { label: string; v: number }) {
  return (
    <div className="re-card" style={{ padding: 14 }}>
      <div className="re-eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="font-mono-feat tnum" style={{
        fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", marginTop: 4,
      }}>
        {v.toLocaleString()}
      </div>
    </div>
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
