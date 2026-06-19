import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { StatusBadge } from "@/components/report/status-badge";
import { Icon } from "@/components/icons";
import { formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";

const TH: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--fg-faint)",
  fontWeight: 400,
  padding: "12px 12px",
  textAlign: "left",
  borderBottom: "1px solid var(--border-soft)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "15px 12px",
  verticalAlign: "middle",
  borderBottom: "1px solid var(--border-soft)",
};

export function HistoryTable({ rows }: { rows: ReportRow[] }) {
  const navigate = useNavigate();

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...TH, paddingLeft: 16 }}>Competitor</th>
            <th style={TH}>Category</th>
            <th style={TH}>Status</th>
            <th style={TH}>Pain</th>
            <th style={TH}>Mentions</th>
            <th style={TH}>Stage</th>
            <th style={TH}>Last run</th>
            <th style={{ ...TH, paddingRight: 16 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const name = r.primary_competitor_name ?? "Untitled";
            const sentiment = r.sentiment_overall;
            const sentimentColor =
              sentiment == null
                ? "var(--fg-faint)"
                : sentiment < -0.3
                ? "var(--neg)"
                : sentiment < -0.15
                ? "var(--warn)"
                : "var(--fg-muted)";
            const isLast = i === rows.length - 1;
            const td = isLast ? { ...TD, borderBottom: "none" } : TD;

            return (
              <tr
                key={r.id}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/reports/${r.id}`)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <td style={{ ...td, paddingLeft: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <CompetitorAvatar name={name} domain={r.primary_competitor_domain} size={28} borderRadius={6} />
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{name}</span>
                  </div>
                </td>
                <td style={td}>
                  <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{r.category ?? "—"}</span>
                </td>
                <td style={td}>
                  <StatusBadge status={(r.status as "queued" | "running" | "completed" | "failed") ?? "queued"} />
                </td>
                <td style={td}>
                  <span className="font-mono-feat tnum" style={{ fontSize: 14, fontWeight: 500, color: sentimentColor }}>
                    {sentiment != null ? sentiment.toFixed(2) : "—"}
                  </span>
                </td>
                <td style={td}>
                  <span className="font-mono-feat tnum" style={{ fontSize: 14 }}>
                    {(r.total_sources ?? 0).toLocaleString()}
                  </span>
                </td>
                <td style={td}>
                  <span className="font-mono-feat" style={{ fontSize: 12, color: "var(--fg-faint)" }}>{r.stage ?? "—"}</span>
                </td>
                <td style={td}>
                  <span className="font-mono-feat" style={{ fontSize: 12, color: "var(--fg-faint)" }}>{formatRelative(r.created_at)}</span>
                </td>
                <td style={{ ...td, paddingRight: 16 }}>
                  <button
                    className="re-btn re-btn-ghost re-btn-sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/reports/${r.id}`); }}
                  >
                    Open <Icon name="chev-right" size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function HistoryTableSkeleton() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...TH, paddingLeft: 16 }}>Competitor</th>
            <th style={TH}>Category</th>
            <th style={TH}>Status</th>
            <th style={TH}>Pain</th>
            <th style={TH}>Mentions</th>
            <th style={TH}>Stage</th>
            <th style={TH}>Last run</th>
            <th style={{ ...TH, paddingRight: 16 }} />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => {
            const isLast = i === 4;
            const td = isLast ? { ...TD, borderBottom: "none" } : TD;
            return (
              <tr key={i}>
                <td style={{ ...td, paddingLeft: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Skeleton style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0 }} />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </td>
                <td style={td}><Skeleton className="h-4 w-20" /></td>
                <td style={td}><Skeleton className="h-5 w-20" style={{ borderRadius: 12 }} /></td>
                <td style={td}><Skeleton className="h-4 w-12" /></td>
                <td style={td}><Skeleton className="h-4 w-14" /></td>
                <td style={td}><Skeleton className="h-4 w-16" /></td>
                <td style={td}><Skeleton className="h-4 w-16" /></td>
                <td style={{ ...td, paddingRight: 16 }}><Skeleton className="h-7 w-14" style={{ borderRadius: 6 }} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
