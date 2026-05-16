import { useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import { MOCK_DATA } from "@/lib/mock/data";
import { ThreadModal } from "@/components/report/thread-modal";

const MONO = '"Geist Mono", ui-monospace, monospace';

type Data = typeof MOCK_DATA;
type Competitor = Data["competitor"];
type Complaint = Data["complaints"][number];
type Quote = {
  who: string;
  sub: string;
  when: string;
  score: number;
  sentiment: number;
  text: string;
};

type Tone = "neg" | "pos" | "warn" | undefined;

type ModalState =
  | { kind: "thread"; complaint: Complaint }
  | { kind: "quote"; quote: Quote }
  | null;

const lk: CSSProperties = {
  color: "var(--fg)",
  borderBottom: "1px dashed var(--fg-faint)",
  textDecoration: "none",
  cursor: "pointer",
};

const monoNum = (color: string): CSSProperties => ({
  color,
  fontFamily: MONO,
  fontSize: 12,
});

export function ReportPage() {
  const navigate = useNavigate();
  const data = MOCK_DATA;
  const c = data.competitor;
  const [tab, setTab] = useState<string>("overview");
  const [expanded, setExpanded] = useState<string | null>(data.complaints[0].id);
  const [timeRange, setTimeRange] = useState<string>("90d");
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const onNav = (key: string) => {
    const map: Record<string, string> = {
      compare: "/compare",
      scan: "/scan",
      history: "/history",
      radar: "/radar",
      competitors: "/competitors",
      account: "/account",
    };
    if (map[key]) navigate(map[key]);
  };

  const onOpenThread = (complaint: Complaint) =>
    setModal({ kind: "thread", complaint });
  const onOpenQuote = (quote: Quote) => setModal({ kind: "quote", quote });

  const tabs: Array<[string, string]> = [
    ["overview", "Overview"],
    ["complaints", `Complaints (${data.complaints.length})`],
    ["voice", "Voice of customer"],
    ["pricing", "Pricing"],
    ["switching", "Switching"],
    ["quotes", `Verbatim (${data.quotes.length})`],
    ["leads", `Leads (${data.highIntentLeads.length})`],
    ["positioning", "Positioning"],
    ["opportunities", `Opportunities (${data.opportunities.length})`],
    ["actions", "Recommended actions"],
  ];

  return (
    <div>
      <ReportHeader competitor={c} onNav={onNav} />

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 4,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border-soft)",
          padding: "8px 28px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span
            className="font-mono-feat text-fg-faint"
            style={{ fontSize: 11, marginRight: 4 }}
          >
            RANGE
          </span>
          {["30d", "90d", "1y", "all"].map((r) => (
            <button
              key={r}
              className={`re-chip ${timeRange === r ? "re-chip-solid" : ""}`}
              style={{ cursor: "pointer", padding: "3px 10px" }}
              onClick={() => setTimeRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: "var(--border-soft)" }} />
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            className="font-mono-feat text-fg-faint"
            style={{ fontSize: 11, marginRight: 4 }}
          >
            PLATFORM
          </span>
          <button
            className={`re-chip ${subFilter === null ? "re-chip-solid" : ""}`}
            style={{ cursor: "pointer", padding: "3px 10px" }}
            onClick={() => setSubFilter(null)}
          >
            all {c.platforms.length}
          </button>
          {c.platforms.slice(0, 5).map((p) => (
            <button
              key={p.id}
              className={`re-chip ${subFilter === p.id ? "re-chip-solid" : ""}`}
              style={{ cursor: "pointer", padding: "3px 10px" }}
              onClick={() => setSubFilter(p.id === subFilter ? null : p.id)}
            >
              {p.name}
            </button>
          ))}
          <span
            className="re-chip"
            style={{ fontSize: 10, cursor: "pointer" }}
          >
            +{c.platforms.length - 5}
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="filter" size={14} />
          </button>
          <button className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="download" size={14} /> Export
          </button>
          <button className="re-btn re-btn-ghost re-btn-sm">
            <Icon name="share" size={14} /> Share
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "0 28px",
          borderBottom: "1px solid var(--border-soft)",
          display: "flex",
          gap: 4,
          background: "var(--bg)",
          flexWrap: "wrap",
        }}
      >
        {tabs.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              border: 0,
              background: "transparent",
              padding: "12px 4px",
              marginRight: 16,
              fontSize: 13,
              color: tab === k ? "var(--fg)" : "var(--fg-muted)",
              fontWeight: tab === k ? 500 : 400,
              cursor: "pointer",
              position: "relative",
              borderBottom:
                tab === k ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: "18px 28px 60px", maxWidth: 1440, margin: "0 auto" }}>
        {tab === "overview" && (
          <OverviewTab
            data={data}
            expanded={expanded}
            setExpanded={setExpanded}
            onOpenThread={onOpenThread}
            onOpenQuote={onOpenQuote}
          />
        )}
        {tab === "complaints" && (
          <TopComplaintsCard
            data={data}
            expanded={expanded}
            setExpanded={setExpanded}
            onOpenThread={onOpenThread}
          />
        )}
        {tab === "voice" && <VoiceTab data={data} />}
        {tab === "pricing" && <PricingTab data={data} />}
        {tab === "switching" && <SwitchingTab data={data} />}
        {tab === "quotes" && (
          <VerbatimFeed data={data} onOpenQuote={onOpenQuote} />
        )}
        {tab === "leads" && <LeadsTab data={data} onOpenQuote={onOpenQuote} />}
        {tab === "positioning" && <PositioningTab data={data} />}
        {tab === "opportunities" && <OpportunitiesTab data={data} />}
        {tab === "actions" && <ActionsTab data={data} />}
      </div>

      {modal?.kind === "thread" && (
        <ThreadModal
          complaint={modal.complaint}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "quote" && (
        <ThreadModal quote={modal.quote} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function ReportHeader({
  competitor: c,
  onNav,
}: {
  competitor: Competitor;
  onNav: (k: string) => void;
}) {
  return (
    <div
      style={{
        padding: "18px 28px 12px",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#5e6ad2",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 26,
              fontWeight: 600,
              fontFamily: MONO,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            L
          </div>
          <div>
            <div className="re-eyebrow">
              INTELLIGENCE REPORT · {c.category.toUpperCase()}
            </div>
            <h1
              className="re-h1"
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {c.name}
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 14, fontWeight: 400 }}
              >
                {c.domain}
              </span>
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 8,
              }}
            >
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                SCANNED {c.scannedAt}
              </span>
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                ·
              </span>
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                {c.sources.toLocaleString()} mentions across {c.platforms.length}{" "}
                platforms
              </span>
              <span className="re-chip re-chip-pos" style={{ fontSize: 10 }}>
                FRESH
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="re-btn" onClick={() => onNav("compare")}>
            <Icon name="compare" size={14} /> Compare
          </button>
          <button className="re-btn">
            <Icon name="spark" size={14} /> Re-run scan
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
        }}
      >
        <BigStat
          label="Sentiment index"
          value={c.sentiment.overall.toFixed(2)}
          sub={c.sentiment.trend}
          painted
          tone="neg"
        />
        <BigStat
          label="Mentions"
          value={c.sources.toLocaleString()}
          sub="+18% vs prev"
        />
        <BigStat
          label="Platforms"
          value={c.platforms.length.toString()}
          sub="all sources active"
        />
        <BigStat label="Switching net" value="+325" sub="inbound · 90d" tone="pos" />
        <BigStat
          label="Top theme"
          value="Pricing"
          sub="187 mentions · +34%"
          tone="warn"
        />
      </div>
    </div>
  );
}

function toneColor(tone: Tone): string {
  if (tone === "neg") return "var(--neg)";
  if (tone === "pos") return "var(--pos)";
  if (tone === "warn") return "var(--warn)";
  return "var(--fg)";
}

function BigStat({
  label,
  value,
  sub,
  tone,
  painted,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: Tone;
  painted?: boolean;
}) {
  const color = toneColor(tone);
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        background: "var(--surface)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <div className="re-eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          marginTop: 4,
        }}
      >
        <span
          className="font-mono-feat"
          style={{
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: painted ? color : "var(--fg)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
      <div style={{ fontSize: 11, color, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function OverviewTab({
  data,
  expanded,
  setExpanded,
  onOpenThread,
  onOpenQuote,
}: {
  data: Data;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  onOpenThread: (c: Complaint) => void;
  onOpenQuote: (q: Quote) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.5fr 1fr",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SummaryCard data={data} />
        <TopComplaintsCard
          data={data}
          expanded={expanded}
          setExpanded={setExpanded}
          limit={5}
          onOpenThread={onOpenThread}
        />
        <SentimentCard data={data} />
        <SwitchingSummary data={data} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <SourceBreakdown data={data} />
        <VerbatimFeed data={data} onOpenQuote={onOpenQuote} limit={5} />
        <FeatureGapsCompact data={data} />
      </div>
    </div>
  );
}

function SummaryCard({ data }: { data: Data }) {
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>
          <Icon name="alert" size={14} /> Executive summary
        </h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          auto · {data.competitor.scannedAt}
        </span>
      </div>
      <div className="re-card-body">
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.65,
            color: "var(--fg-muted)",
          }}
        >
          <b style={{ color: "var(--fg)" }}>
            Linear's pain is now structural, not stylistic.
          </b>{" "}
          Across 1,247 mentions in the last 90 days, three themes account for 60%
          of all negative sentiment: per-seat{" "}
          <a style={lk}>pricing past 15 seats</a> (187 mentions,{" "}
          <span style={monoNum("var(--neg)")}>+34%</span>), the absence of{" "}
          <a style={lk}>native time tracking</a> (152 mentions, +18%), and a{" "}
          <a style={lk}>mobile app</a> that users describe as "read-only" (134
          mentions, +9%). Net switching remains strongly inbound (+325 from Jira,
          Asana, ClickUp), but outbound mentions cite the same pricing argument
          and a growing demand for executive roadmap views.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <span className="re-chip re-chip-accent">
            price-sensitivity 15-80 seats
          </span>
          <span className="re-chip">agency / consultancy wedge</span>
          <span className="re-chip">exec roadmap gap</span>
          <span className="re-chip">mobile triage gap</span>
        </div>
      </div>
    </div>
  );
}

function tagClass(tag: string): string {
  const m: Record<string, string> = {
    Pricing: "re-tag-pricing",
    "Feature gap": "re-tag-gap",
    Mobile: "re-tag-mobile",
    Reporting: "re-tag-report",
    Admin: "re-tag-admin",
    Performance: "re-tag-perf",
    Workflow: "re-tag-flow",
  };
  return m[tag] ?? "";
}

function TopComplaintsCard({
  data,
  expanded,
  setExpanded,
  limit,
  onOpenThread,
}: {
  data: Data;
  expanded: string | null;
  setExpanded: (v: string | null) => void;
  limit?: number;
  onOpenThread: (c: Complaint) => void;
}) {
  const list = limit ? data.complaints.slice(0, limit) : data.complaints;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Top complaints</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          ranked by severity × frequency
        </span>
      </div>
      <div>
        {list.map((cp, i) => {
          const isExp = expanded === cp.id;
          return (
            <div
              key={cp.id}
              style={{
                borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
              }}
            >
              <button
                onClick={() => setExpanded(isExp ? null : cp.id)}
                style={{
                  width: "100%",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  padding: "14px 16px",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto auto 60px 14px",
                  gap: 12,
                  alignItems: "center",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{
                    fontSize: 11,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500 }}>
                      {cp.title}
                    </span>
                    <span className={`re-tag ${tagClass(cp.tag)}`}>{cp.tag}</span>
                  </div>
                </div>
                <span
                  className="font-mono-feat"
                  style={{
                    fontSize: 12,
                    color: "var(--fg-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cp.mentions}
                </span>
                <span
                  className="font-mono-feat"
                  style={{
                    fontSize: 12,
                    color: cp.delta.startsWith("+")
                      ? "var(--neg)"
                      : "var(--pos)",
                    width: 36,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cp.delta}
                </span>
                <div className="re-meter neg">
                  <i style={{ width: `${cp.severity * 100}%` }} />
                </div>
                <Icon
                  name={isExp ? "chev-down" : "chev-right"}
                  size={14}
                  className="text-fg-faint"
                />
              </button>
              {isExp && (
                <div
                  className="fade-up"
                  style={{
                    padding: "0 16px 16px 52px",
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <p
                      className="text-fg-muted"
                      style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}
                    >
                      {cp.summary}
                    </p>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="re-btn re-btn-sm"
                        onClick={() => onOpenThread(cp)}
                      >
                        <Icon name="list" size={12} /> View {cp.threads} threads
                      </button>
                      <button className="re-btn re-btn-ghost re-btn-sm">
                        <Icon name="external" size={12} /> Open in Reddit
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: 12,
                      background: "var(--surface-2)",
                      borderRadius: 8,
                      borderLeft: "2px solid var(--accent)",
                    }}
                  >
                    <div
                      className="re-eyebrow"
                      style={{ fontSize: 10, marginBottom: 6 }}
                    >
                      SAMPLE VERBATIM
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontStyle: "italic",
                        lineHeight: 1.55,
                      }}
                    >
                      "{cp.sample}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {limit && (
        <div
          style={{
            borderTop: "1px solid var(--border-soft)",
            padding: "10px 16px",
            textAlign: "center",
          }}
        >
          <button className="re-btn re-btn-ghost re-btn-sm">
            View all {data.complaints.length}{" "}
            <Icon name="arrow-right" size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function SentimentCard({ data }: { data: Data }) {
  const series = data.sentimentSeries;
  const w = 600,
    h = 160,
    pad = 24;
  const minY = -0.45,
    maxY = 0;
  const x = (i: number) =>
    pad + (i / (series.length - 1)) * (w - pad * 2);
  const y = (v: number) =>
    pad + ((maxY - v) / (maxY - minY)) * (h - pad * 2);

  const linePath = series
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(series.length - 1)} ${h - pad} L ${x(
    0
  )} ${h - pad} Z`;

  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Sentiment over time</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--fg-muted)",
            }}
          >
            <span className="re-dot re-dot-neg" /> Pain index
          </span>
          <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            weekly · 90d
          </span>
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--neg)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--neg)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, -0.15, -0.3, -0.45].map((g) => (
            <g key={g}>
              <line
                x1={pad}
                x2={w - pad}
                y1={y(g)}
                y2={y(g)}
                stroke="var(--border-soft)"
                strokeDasharray={g === 0 ? "none" : "2 3"}
              />
              <text
                x={4}
                y={y(g) + 3}
                fontSize="9"
                fill="var(--fg-faint)"
                fontFamily={MONO}
              >
                {g.toFixed(2)}
              </text>
            </g>
          ))}
          <path d={areaPath} fill="url(#sg)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--neg)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          {series.map((v, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={i === series.length - 1 ? 3.5 : 1.6}
              fill={i === series.length - 1 ? "var(--neg)" : "var(--surface)"}
              stroke="var(--neg)"
              strokeWidth="1.4"
            />
          ))}
          <line
            x1={x(7)}
            x2={x(7)}
            y1={pad}
            y2={h - pad}
            stroke="var(--accent)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <text
            x={x(7) + 4}
            y={pad + 10}
            fontSize="9"
            fill="var(--accent)"
            fontFamily={MONO}
          >
            v2.0 pricing change
          </text>
        </svg>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            padding: "0 12px",
            fontFamily: MONO,
            fontSize: 10,
            color: "var(--fg-faint)",
          }}
        >
          <span>13w ago</span>
          <span>10w</span>
          <span>7w</span>
          <span>4w</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

function SwitchingSummary({ data }: { data: Data }) {
  const sw = data.switching;
  const maxIn = Math.max(...sw.inbound.map((s) => s.count));
  const maxOut = Math.max(...sw.outbound.map((s) => s.count));
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Switching signals</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          {sw.netSignal}
        </span>
      </div>
      <div
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
            <Icon
              name="arrow-right"
              size={10}
              style={{
                display: "inline",
                verticalAlign: "middle",
                color: "var(--pos)",
              }}
            />{" "}
            INBOUND TO LINEAR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sw.inbound.map((s) => (
              <div
                key={s.from}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 36px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13 }}>{s.from}</span>
                <div className="re-meter pos">
                  <i style={{ width: `${(s.count / maxIn) * 100}%` }} />
                </div>
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{
                    fontSize: 11,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
            <Icon
              name="arrow-right"
              size={10}
              style={{
                display: "inline",
                verticalAlign: "middle",
                color: "var(--neg)",
              }}
            />{" "}
            OUTBOUND FROM LINEAR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sw.outbound.map((s) => (
              <div
                key={s.to}
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 36px",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 13 }}>{s.to}</span>
                <div className="re-meter neg">
                  <i style={{ width: `${(s.count / maxOut) * 100}%` }} />
                </div>
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{
                    fontSize: 11,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformDot({ id }: { id: string }) {
  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        background: "var(--surface-2)",
        border: "1px solid var(--border-soft)",
        display: "inline-grid",
        placeItems: "center",
        fontSize: 8,
        fontFamily: MONO,
        color: "var(--fg-muted)",
        flexShrink: 0,
      }}
    >
      {id.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SourceBreakdown({ data }: { data: Data }) {
  const platforms = data.competitor.platforms;
  const total = platforms.reduce((a, b) => a + b.posts, 0);
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Platform breakdown</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          {total} items
        </span>
      </div>
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {platforms.map((p) => {
          const pct = (p.posts / total) * 100;
          return (
            <div key={p.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    minWidth: 0,
                  }}
                >
                  <PlatformDot id={p.id} />
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span
                    className="font-mono-feat text-fg-faint"
                    style={{
                      fontSize: 10,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.contexts.slice(0, 2).join(" · ")}
                  </span>
                </span>
                <span
                  className="font-mono-feat"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-muted)",
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {p.posts}{" "}
                  <span className="text-fg-faint">·</span>{" "}
                  <span
                    style={{
                      color:
                        p.sentiment < -0.35
                          ? "var(--neg)"
                          : "var(--fg-muted)",
                    }}
                  >
                    {p.sentiment.toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="re-meter">
                <i style={{ width: `${pct}%`, background: "var(--fg)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerbatimFeed({
  data,
  onOpenQuote,
  limit,
}: {
  data: Data;
  onOpenQuote: (q: Quote) => void;
  limit?: number;
}) {
  const list = limit ? data.quotes.slice(0, limit) : data.quotes;
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>
          <Icon name="quote" size={14} /> Verbatim feed
        </h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          live
        </span>
      </div>
      <div>
        {list.map((q, i) => (
          <div
            key={i}
            onClick={() => onOpenQuote(q as Quote)}
            style={{
              padding: "12px 16px",
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                className="font-mono-feat"
                style={{ fontSize: 11, color: "var(--fg)" }}
              >
                {q.who}
              </span>
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                {q.sub}
              </span>
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                ·
              </span>
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                {q.when}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{
                    fontSize: 11,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {q.score}↑
                </span>
                <span
                  className="re-dot"
                  style={{
                    background:
                      q.sentiment > 0
                        ? "var(--pos)"
                        : q.sentiment < -0.5
                        ? "var(--neg)"
                        : "var(--warn)",
                  }}
                />
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.55,
                color: "var(--fg)",
              }}
            >
              "{q.text}"
            </p>
          </div>
        ))}
      </div>
      {limit && (
        <div
          style={{
            borderTop: "1px solid var(--border-soft)",
            padding: "10px 16px",
            textAlign: "center",
          }}
        >
          <button className="re-btn re-btn-ghost re-btn-sm">
            View all {data.quotes.length}
          </button>
        </div>
      )}
    </div>
  );
}

function FeatureGapsCompact({ data }: { data: Data }) {
  const max = Math.max(...data.featureGaps.map((g) => g.votes));
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Feature gaps</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          requests · 90d
        </span>
      </div>
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {data.featureGaps.slice(0, 6).map((g) => (
          <div
            key={g.feature}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 70px 36px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12 }}>{g.feature}</span>
            <div className="re-meter">
              <i
                style={{
                  width: `${(g.votes / max) * 100}%`,
                  background: "var(--fg)",
                }}
              />
            </div>
            <span
              className="font-mono-feat text-fg-faint"
              style={{
                fontSize: 11,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {g.votes}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VoiceTab({ data }: { data: Data }) {
  const v = data.voiceOfCustomer;
  const maxPos = Math.max(...v.positive.map((w) => w.count));
  const maxNeg = Math.max(...v.negative.map((w) => w.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="re-card">
        <div className="re-card-hd">
          <h3>How users describe {data.competitor.name}</h3>
          <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            summarized vocabulary · 90d
          </span>
        </div>
        <div style={{ padding: 14 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--fg-muted)",
            }}
          >
            {v.summary}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div className="re-card">
          <div className="re-card-hd">
            <h3>
              <span className="re-dot re-dot-pos" /> Positive vocabulary
            </h3>
            <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
              what gets praised
            </span>
          </div>
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {v.positive.map((w) => (
              <div
                key={w.word}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 40px",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <span className="font-mono-feat" style={{ fontSize: 13 }}>
                  {w.word}
                </span>
                <div className="re-meter pos">
                  <i style={{ width: `${(w.count / maxPos) * 100}%` }} />
                </div>
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{
                    fontSize: 11,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {w.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="re-card">
          <div className="re-card-hd">
            <h3>
              <span className="re-dot re-dot-neg" /> Negative vocabulary
            </h3>
            <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
              what gets complained about
            </span>
          </div>
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {v.negative.map((w) => (
              <div
                key={w.word}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 40px",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <span
                  className="font-mono-feat"
                  style={{ fontSize: 13, color: "var(--neg)" }}
                >
                  {w.word}
                </span>
                <div className="re-meter neg">
                  <i style={{ width: `${(w.count / maxNeg) * 100}%` }} />
                </div>
                <span
                  className="font-mono-feat text-fg-faint"
                  style={{
                    fontSize: 11,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {w.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="re-card">
        <div className="re-card-hd">
          <h3>Repeated phrases</h3>
          <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            verbatim, ranked by reuse
          </span>
        </div>
        <div style={{ padding: "4px 0" }}>
          {v.phrases.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "14px 20px",
                borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <span
                className="font-mono-feat text-fg-faint"
                style={{
                  fontSize: 11,
                  width: 22,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 14, fontStyle: "italic" }}>"{p}"</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadsTab({
  data,
  onOpenQuote,
}: {
  data: Data;
  onOpenQuote: (q: Quote) => void;
}) {
  const signalColors: Record<string, string> = {
    "explicit-switch": "var(--accent)",
    "feature-gap": "#6366f1",
    "price-pain": "var(--warn)",
    compliance: "#8b5cf6",
  };
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>High-intent leads</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          users actively signaling switch · ready for outreach
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "120px 160px 1fr 70px 110px",
          padding: "10px 20px",
          borderBottom: "1px solid var(--border-soft)",
          fontFamily: MONO,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--fg-faint)",
          gap: 14,
        }}
      >
        <span>Signal</span>
        <span>User · Platform</span>
        <span>Quote</span>
        <span>Score</span>
        <span></span>
      </div>
      {data.highIntentLeads.map((l, i) => (
        <div
          key={i}
          onClick={() =>
            onOpenQuote({
              who: l.who,
              sub: l.sub,
              when: l.when,
              score: l.score,
              text: l.quote,
              sentiment: -0.6,
            })
          }
          style={{
            display: "grid",
            gridTemplateColumns: "120px 160px 1fr 70px 110px",
            padding: "16px 20px",
            borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
            alignItems: "center",
            gap: 14,
            cursor: "pointer",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <span
            className="re-chip"
            style={{
              background: signalColors[l.signal] ?? "var(--fg)",
              color: "#fff",
              borderColor: "transparent",
              fontSize: 10,
              justifySelf: "start",
            }}
          >
            {l.signal}
          </span>
          <div>
            <div
              className="font-mono-feat"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              {l.who}
            </div>
            <div
              className="font-mono-feat text-fg-faint"
              style={{ fontSize: 10 }}
            >
              {l.sub} · {l.when}
            </div>
          </div>
          <div
            style={{
              fontSize: 13,
              fontStyle: "italic",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            "{l.quote}"
          </div>
          <span
            className="font-mono-feat"
            style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
          >
            {l.score}↑
          </span>
          <button
            className="re-btn re-btn-sm"
            onClick={(e) => e.stopPropagation()}
            style={{ justifySelf: "end" }}
          >
            <Icon name="arrow-right" size={12} /> Outreach
          </button>
        </div>
      ))}
    </div>
  );
}

function PositioningTab({ data }: { data: Data }) {
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Positioning angles</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          what to say · derived from competitor weakness
        </span>
      </div>
      <div>
        {data.positioning.map((p, i) => (
          <div
            key={i}
            style={{
              padding: "24px 28px",
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            <span
              className="font-mono-feat"
              style={{
                fontSize: 24,
                fontWeight: 500,
                color: "var(--accent)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginTop: 6,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 500,
                  lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                }}
              >
                "{p.angle}"
              </h3>
              <p
                className="text-fg-muted"
                style={{
                  margin: "10px 0 0",
                  fontSize: 13,
                  lineHeight: 1.6,
                  maxWidth: 720,
                }}
              >
                {p.thesis}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 14,
                  flexWrap: "wrap",
                }}
              >
                <span className="re-chip" style={{ fontSize: 10 }}>
                  FOR · {p.audience}
                </span>
                <span className="re-chip re-chip-neg" style={{ fontSize: 10 }}>
                  AGAINST · {p.against}
                </span>
              </div>
            </div>
            <button className="re-btn re-btn-sm">Copy</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionsTab({ data }: { data: Data }) {
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Recommended next actions</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          do these this week
        </span>
      </div>
      <div>
        {data.actions.map((a, i) => (
          <div
            key={i}
            style={{
              padding: "20px 24px",
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
              display: "grid",
              gridTemplateColumns: "32px 1fr 100px 110px 120px",
              gap: 16,
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                border: "1px solid var(--border-strong)",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                color: "var(--fg-muted)",
              }}
            >
              {i + 1}
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{a.step}</div>
              <div
                className="text-fg-muted"
                style={{
                  fontSize: 12,
                  marginTop: 4,
                  lineHeight: 1.5,
                  maxWidth: 580,
                }}
              >
                {a.detail}
              </div>
            </div>
            <span
              className="re-chip"
              style={{ fontSize: 10, justifySelf: "start" }}
            >
              {a.role}
            </span>
            <span
              className={`re-chip ${
                a.effort === "high"
                  ? "re-chip-warn"
                  : a.effort === "med"
                  ? ""
                  : "re-chip-pos"
              }`}
              style={{ fontSize: 10, justifySelf: "start" }}
            >
              effort · {a.effort}
            </span>
            <button className="re-btn re-btn-sm" style={{ justifySelf: "end" }}>
              + Add to plan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingTab({ data }: { data: Data }) {
  const p = data.pricing;
  const wordCloud: Array<[string, number]> = [
    ["expensive", 22],
    ["per-seat", 28],
    ["contractor", 18],
    ["finance", 14],
    ["budget", 16],
    ["SSO tax", 20],
    ["procurement", 12],
    ["startup", 12],
    ["scale", 18],
    ["enterprise", 14],
    ["Plus tier", 16],
    ["Jira cheaper", 22],
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.3fr 1fr",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="re-card">
          <div className="re-card-hd">
            <h3>Pricing pain by tier</h3>
            <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
              pain score 0–1
            </span>
          </div>
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {p.breakdown.map((b) => {
              const color =
                b.pain > 0.7
                  ? "var(--neg)"
                  : b.pain > 0.4
                  ? "var(--warn)"
                  : "var(--pos)";
              return (
                <div key={b.tier}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: 14 }}>
                        {b.tier}
                      </span>
                      <span
                        className="text-fg-muted"
                        style={{ fontSize: 12 }}
                      >
                        {b.note}
                      </span>
                    </div>
                    <span
                      className="font-mono-feat"
                      style={{
                        fontSize: 13,
                        color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {b.pain.toFixed(2)}
                    </span>
                  </div>
                  <div className="re-meter" style={{ height: 6 }}>
                    <i
                      style={{
                        width: `${b.pain * 100}%`,
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="re-card">
          <div className="re-card-hd">
            <h3>Cost-related quotes</h3>
            <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
              {p.quotes.length}
            </span>
          </div>
          <div>
            {p.quotes.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    fontStyle: "italic",
                  }}
                >
                  "{q.text}"
                </p>
                <div
                  className="font-mono-feat text-fg-faint"
                  style={{ fontSize: 11, marginTop: 8 }}
                >
                  {q.who} · {q.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="re-card" style={{ padding: 14 }}>
          <div className="re-eyebrow">BLENDED ASK</div>
          <div
            className="font-mono-feat"
            style={{
              fontSize: 30,
              fontWeight: 500,
              marginTop: 6,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p.blended}
          </div>
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 11 }}
              >
                OVERALL PAIN
              </span>
              <span
                className="font-mono-feat"
                style={{
                  fontSize: 12,
                  color: "var(--neg)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {p.painScore.toFixed(2)}
              </span>
            </div>
            <div className="re-meter neg" style={{ height: 6 }}>
              <i style={{ width: `${p.painScore * 100}%` }} />
            </div>
          </div>
          <hr
            style={{
              border: 0,
              borderTop: "1px solid var(--border-soft)",
              margin: "16px 0",
            }}
          />
          <div
            style={{
              fontSize: 12,
              color: "var(--fg-muted)",
              lineHeight: 1.6,
            }}
          >
            <b style={{ color: "var(--fg)" }}>Inflection at 15 seats.</b>
            <br />
            Mention volume on pricing roughly doubles between 10 and 20 paid
            seats. Most frustration centers on contractors and PMs paying full
            price for partial usage.
          </div>
        </div>

        <div className="re-card">
          <div className="re-card-hd">
            <h3>Word cloud · pricing</h3>
          </div>
          <div
            style={{
              padding: 18,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "baseline",
            }}
          >
            {wordCloud.map(([w, s]) => (
              <span
                key={w}
                className="font-mono-feat"
                style={{
                  fontSize: s,
                  color:
                    s > 20
                      ? "var(--accent)"
                      : s > 16
                      ? "var(--fg)"
                      : "var(--fg-muted)",
                }}
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SwitchingTab({ data }: { data: Data }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SwitchingSummary data={data} />
      <div className="re-card">
        <div className="re-card-hd">
          <h3>Common reasons to leave</h3>
          <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
            outbound
          </span>
        </div>
        <div
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(2,1fr)",
            gap: 10,
          }}
        >
          {data.switching.reasonsOut.map((r, i) => (
            <div
              key={i}
              style={{
                padding: 14,
                background: "var(--surface-2)",
                border: "1px solid var(--border-soft)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                className="font-mono-feat text-fg-faint"
                style={{
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 13 }}>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OpportunitiesTab({ data }: { data: Data }) {
  return (
    <div className="re-card">
      <div className="re-card-hd">
        <h3>Competitive opportunities</h3>
        <span className="hd-sub font-mono-feat text-fg-faint" style={{ fontSize: 11 }}>
          what to build · what to say
        </span>
      </div>
      <div>
        {data.opportunities.map((o, i) => (
          <div
            key={i}
            style={{
              padding: "20px 24px",
              borderTop: i === 0 ? 0 : "1px solid var(--border-soft)",
              display: "grid",
              gridTemplateColumns: "40px 1fr 220px",
              gap: 20,
              alignItems: "center",
            }}
          >
            <span
              className="font-mono-feat"
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: "var(--fg-faint)",
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="re-h3" style={{ fontSize: 17 }}>
                {o.title}
              </h3>
              <p
                className="text-fg-muted"
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {o.thesis}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "flex-end",
              }}
            >
              <Stat label="effort" value={o.effort} />
              <Stat label="payoff" value={o.payoff} hot={o.payoff === "high"} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hot,
}: {
  label: string;
  value: ReactNode;
  hot?: boolean;
}) {
  return (
    <div style={{ textAlign: "right" }}>
      <div className="re-eyebrow" style={{ fontSize: 10 }}>
        {label}
      </div>
      <div
        className="font-mono-feat"
        style={{
          fontSize: 14,
          fontWeight: 500,
          marginTop: 2,
          color: hot ? "var(--accent)" : "var(--fg)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
