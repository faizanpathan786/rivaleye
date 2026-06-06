import { Icon } from "@/components/icons";
import type { CreditPack } from "@/api/billing";

interface CreditPackCardProps {
  pack: CreditPack;
  onBuy: (pack: CreditPack) => void;
  loading: boolean;
}

export function CreditPackCard({ pack, onBuy, loading }: CreditPackCardProps) {
  const priceRupees = Math.round(pack.price_paise / 100);
  const perCredit = (priceRupees / pack.credits).toFixed(0);
  const isPopular = pack.name === "Growth";

  return (
    <div
      style={{
        border: `1px solid ${isPopular ? "var(--accent)" : "var(--border-soft)"}`,
        borderRadius: 10,
        padding: "20px 20px 16px",
        background: isPopular ? "var(--accent-soft)" : "var(--surface)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {isPopular && (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.06em",
            padding: "2px 10px",
            borderRadius: 99,
            whiteSpace: "nowrap",
          }}
        >
          MOST POPULAR
        </span>
      )}
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{pack.name}</div>
      <div>
        <span style={{ fontSize: 28, fontWeight: 700, color: "var(--fg)" }}>
          ₹{priceRupees.toLocaleString("en-IN")}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
        {pack.credits} credits · ₹{perCredit}/scan
      </div>
      <button
        className="re-btn"
        style={{
          marginTop: 4,
          width: "100%",
          justifyContent: "center",
          background: isPopular ? "var(--accent)" : undefined,
          color: isPopular ? "#fff" : undefined,
          opacity: loading ? 0.6 : 1,
        }}
        disabled={loading}
        onClick={() => onBuy(pack)}
      >
        {loading ? <Icon name="spinner" size={14} /> : null}
        Buy {pack.credits} credits
      </button>
    </div>
  );
}
