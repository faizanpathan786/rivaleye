import { useNavigate } from "react-router-dom";
import { MOCK_DATA } from "@/lib/mock/data";

export function HistoryPage() {
  const navigate = useNavigate();
  const { history } = MOCK_DATA;

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="re-eyebrow">HISTORY</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>Scan history</h1>
      <p className="text-fg-muted" style={{ marginTop: 6 }}>
        Every scan you've run. Re-run, archive, or export.
      </p>

      <div className="re-card" style={{ marginTop: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(180px,1.4fr) 1fr .8fr .8fr 1fr 100px",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--fg-faint)",
          }}
        >
          <span>Competitor</span>
          <span>Category</span>
          <span>Scans</span>
          <span>Pain</span>
          <span>Last run</span>
          <span></span>
        </div>
        {history.map((h, i) => (
          <div
            key={h.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(180px,1.4fr) 1fr .8fr .8fr 1fr 100px",
              padding: "12px 16px",
              borderBottom:
                i === history.length - 1 ? 0 : "1px solid var(--border-soft)",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CompetitorAvatar name={h.name} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>{h.name}</span>
            </div>
            <span className="text-fg-muted" style={{ fontSize: 12 }}>
              {h.category}
            </span>
            <span className="font-mono-feat tnum">{h.scans}</span>
            <span
              className="font-mono-feat tnum"
              style={{ color: "var(--neg)" }}
            >
              {h.pain.toFixed(2)}
            </span>
            <span
              className="font-mono-feat text-fg-faint"
              style={{ fontSize: 11 }}
            >
              {h.lastRun}
            </span>
            <button
              className="re-btn re-btn-ghost re-btn-sm"
              onClick={() => {
                if (h.id === "linear") navigate("/reports/linear");
              }}
            >
              Open
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorAvatar({ name }: { name: string }) {
  const colors: Record<string, [string, string]> = {
    Linear: ["#5e6ad2", "#fff"],
    Notion: ["#000", "#fff"],
    Figma: ["#f24e1e", "#fff"],
    Superhuman: ["#503ce6", "#fff"],
    Slack: ["#4a154b", "#fff"],
    Asana: ["#f06a6a", "#fff"],
  };
  const [bg, fg] = colors[name] ?? ["#444", "#fff"];
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        background: bg,
        color: fg,
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
      }}
    >
      {name[0]}
    </div>
  );
}
