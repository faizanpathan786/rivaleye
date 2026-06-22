import { motion } from "framer-motion";
import type { DashboardOpportunity } from "@/api/dashboard";

const PAYOFF_LABEL: Record<DashboardOpportunity["payoff"], string> = {
  high: "high payoff",
  med: "med payoff",
  low: "low payoff",
};

// signal token: colored square (rotated for "gap"), mono uppercase label
function signalStyle(tag: string | null): { color: string; rotate: boolean; label: string } {
  const t = (tag ?? "").toLowerCase();
  if (t.includes("switch")) return { color: "var(--accent)", rotate: false, label: "switch" };
  if (t.includes("gap") || t.includes("missing") || t.includes("feature"))
    return { color: "#6366f1", rotate: true, label: "gap" };
  if (t.includes("love") || t.includes("praise")) return { color: "var(--pos)", rotate: false, label: "love" };
  return { color: "var(--neg)", rotate: false, label: t || "pain" };
}

export function OpportunityCard({
  opportunity: o,
  index,
  onOpen,
}: {
  opportunity: DashboardOpportunity;
  index: number;
  onOpen: () => void;
}) {
  const hasQuote = Boolean(o.evidence_quote && o.evidence_quote.trim());
  const sig = signalStyle(o.signal_tag);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.05, 0.25), ease: [0.2, 0.7, 0.2, 1] }}
      className="re-card group block w-full text-left"
      style={{ cursor: "pointer", padding: "17px 18px", transition: "border-color 140ms, box-shadow 140ms" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-soft)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      {/* meta row */}
      <div className="flex items-center gap-3" style={{ marginBottom: 11 }}>
        <span
          className="font-mono-feat"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", textTransform: "capitalize", color: sig.color, display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 2, background: sig.color, transform: sig.rotate ? "rotate(45deg)" : "none" }} />
          {sig.label}
        </span>
        <span className="font-mono-feat" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.03em" }}>
          {PAYOFF_LABEL[o.payoff]} · {o.effort} effort
        </span>
        {o.competitor_name && (
          <span className="font-mono-feat ml-auto truncate" style={{ fontSize: 10, color: "var(--fg-faint)", maxWidth: 130 }}>
            {o.competitor_name}
          </span>
        )}
      </div>

      <div className="break-words" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.28 }}>
        {o.title}
      </div>

      {o.thesis && (
        <p className="break-words" style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 6 }}>
          {o.thesis}
        </p>
      )}

      {hasQuote && (
        <div style={{ marginTop: 13, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
          <div className="font-mono-feat" style={{ fontSize: 10, letterSpacing: "0.02em", color: "var(--fg-faint)", marginBottom: 5 }}>
            Evidence
          </div>
          <p
            className="break-words"
            style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            “{o.evidence_quote}”
          </p>
          {o.evidence_author && (
            <div className="font-mono-feat" style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 7 }}>
              {o.evidence_author}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
        <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.03em" }}>
          View evidence
        </span>
        <span className="transition-transform group-hover:translate-x-0.5" style={{ color: "var(--accent)", fontSize: 13 }}>→</span>
      </div>
    </motion.button>
  );
}
