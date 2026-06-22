import { Check, Loader2 } from "lucide-react";
import type { CreditPack } from "@/api/billing";

interface CreditPackCardProps {
  pack: CreditPack;
  onBuy: (pack: CreditPack) => void;
  loading: boolean;
  /** Highest per-credit price across all packs, used to compute savings. */
  baselinePerCredit?: number;
}

export function CreditPackCard({ pack, onBuy, loading, baselinePerCredit }: CreditPackCardProps) {
  const priceRupees = Math.round(pack.price_paise / 100);
  const perCredit = priceRupees / pack.credits;
  const isPopular = pack.name === "Growth";
  const savings =
    baselinePerCredit && baselinePerCredit > perCredit
      ? Math.round((1 - perCredit / baselinePerCredit) * 100)
      : 0;

  return (
    <div
      className="re-card"
      style={{
        position: "relative",
        overflow: "visible",
        padding: "22px 20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        border: isPopular ? "1.5px solid var(--accent)" : "1px solid var(--border-soft)",
        background: isPopular
          ? "linear-gradient(160deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 55%), var(--surface)"
          : "var(--surface)",
        transition: "transform 140ms, box-shadow 140ms, border-color 140ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      {isPopular && (
        <span
          style={{
            position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
            background: "var(--accent)", color: "var(--accent-fg)",
            fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
            padding: "3px 11px", borderRadius: 99, whiteSpace: "nowrap",
            boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
        >
          Most popular
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{pack.name}</span>
        {savings > 0 && (
          <span className="re-chip re-chip-pos" style={{ fontSize: 11 }}>Save {savings}%</span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="tnum" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--fg)" }}>
          ₹{priceRupees.toLocaleString("en-IN")}
        </span>
        <span className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>one-time</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Feature text={`${pack.credits} competitor ${pack.credits === 1 ? "scan" : "scans"}`} strong />
        <Feature text={`₹${perCredit.toFixed(0)} per scan`} />
        <Feature text="Full report · all 4 role lenses" />
      </div>

      <button
        className={`re-btn ${isPopular ? "re-btn-accent" : ""}`}
        style={{ marginTop: "auto", width: "100%", justifyContent: "center", opacity: loading ? 0.6 : 1 }}
        disabled={loading}
        onClick={() => onBuy(pack)}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? "Starting…" : `Get ${pack.credits} credits`}
      </button>
    </div>
  );
}

function Feature({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <span className="flex items-center gap-2" style={{ fontSize: 12.5, color: strong ? "var(--fg)" : "var(--fg-muted)", fontWeight: strong ? 500 : 400 }}>
      <Check size={14} style={{ color: "var(--pos)", flexShrink: 0 }} />
      {text}
    </span>
  );
}
