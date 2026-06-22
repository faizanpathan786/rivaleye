import { motion } from "framer-motion";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { formatRelative } from "@/lib/format";
import type { ReportRow } from "@/api/reports";

function statusMeta(status: string): { label: string; color: string } {
  if (status === "completed") return { label: "Done", color: "var(--pos)" };
  if (status === "running" || status === "queued") return { label: "Scanning", color: "var(--accent)" };
  if (status === "failed") return { label: "Failed", color: "var(--neg)" };
  return { label: status, color: "var(--fg-faint)" };
}

function hookLine(r: ReportRow): string {
  const brief = (r.executive_brief ?? r.voice_summary ?? "").trim();
  if (brief) return brief;
  const name = r.primary_competitor_name ?? r.competitors[0] ?? "their users";
  return `See what ${name}'s users are saying — and where the gaps are.`;
}

export function ReportRail({ reports, onOpen }: { reports: ReportRow[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ overflowX: "auto", paddingBottom: 6, margin: "0 -4px", padding: "0 4px 6px" }}>
      <div className="flex" style={{ gap: 10, width: "max-content" }}>
        {reports.map((r, i) => {
          const name = r.primary_competitor_name ?? "Untitled";
          const st = statusMeta(r.status);
          return (
            <motion.button
              key={r.id}
              type="button"
              onClick={() => onOpen(r.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: Math.min(i * 0.03, 0.18) }}
              className="re-card group text-left"
              style={{ width: 250, flexShrink: 0, cursor: "pointer", display: "flex", flexDirection: "column", transition: "border-color 140ms, box-shadow 140ms" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-strong)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-soft)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                  <CompetitorAvatar name={name} domain={r.primary_competitor_domain} size={28} borderRadius={7} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="re-dot" style={{ background: st.color, width: 5, height: 5 }} />
                      <span className="font-mono-feat" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                        {st.label} · {formatRelative(r.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <p
                  style={{
                    fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.45, margin: 0, flex: 1,
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}
                >
                  {hookLine(r)}
                </p>
              </div>

              <div className="flex items-center gap-1.5" style={{ padding: "10px 14px", borderTop: "1px solid var(--border-soft)" }}>
                <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.03em" }}>
                  View report
                </span>
                <span className="transition-transform group-hover:translate-x-0.5" style={{ color: "var(--accent)", fontSize: 13 }}>→</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
