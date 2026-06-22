import { useState } from "react";
import { CreditPackCard } from "@/components/billing/credit-pack-card";
import {
  useBalanceQuery,
  useCreditPacksQuery,
  useTransactionsQuery,
  useCreateOrderMutation,
  useVerifyPaymentMutation,
} from "@/hooks/queries/use-billing";
import type { CreditPack } from "@/api/billing";

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("razorpay-checkout-js")) { resolve(); return; }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.head.appendChild(script);
  });
}

function TransactionHistory() {
  const { data, isLoading } = useTransactionsQuery();

  if (isLoading) {
    return <div className="re-card" style={{ color: "var(--fg-muted)", fontSize: 13, padding: 16, textAlign: "center" }}>Loading…</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="re-card" style={{ color: "var(--fg-faint)", fontSize: 13, padding: "24px 16px", textAlign: "center" }}>
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="re-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ overflowY: "auto", minHeight: 0 }}>
        {data.map((tx, i) => {
          const isPurchase = tx.type === "purchase";
          return (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-4"
              style={{ padding: "11px 16px", borderTop: i === 0 ? 0 : "1px solid var(--border-soft)" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tx.description}
                </div>
                <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
                  {new Date(tx.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
              <span
                className={`font-mono-feat tnum re-chip ${isPurchase ? "re-chip-pos" : ""}`}
                style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, color: isPurchase ? undefined : "var(--fg-muted)" }}
              >
                {isPurchase ? "+" : "−"}{tx.amount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BillingPage() {
  const { data: balance, isLoading: balanceLoading } = useBalanceQuery();
  const { data: transactions, isLoading: txLoading } = useTransactionsQuery();
  const packsQuery = useCreditPacksQuery();
  const createOrder = useCreateOrderMutation();
  const verifyPayment = useVerifyPaymentMutation();
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const scansUsed = transactions?.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0) ?? 0;
  const creditsRemaining = balance?.balance ?? 0;
  const totalEver = scansUsed + creditsRemaining;
  const usagePct = totalEver > 0 ? Math.min((scansUsed / totalEver) * 100, 100) : 0;

  const handleBuy = async (pack: CreditPack) => {
    setError(null);
    setSuccessMsg(null);
    setBuyingPackId(pack.id);
    try {
      await loadRazorpayScript();
      const order = await createOrder.mutateAsync(pack.id);
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.razorpay_order_id,
        name: "RivalEye",
        description: `${pack.name} — ${pack.credits} credits`,
        prefill: { email: "" },
        theme: { color: "#0061B1" },
        handler: async (response) => {
          try {
            const result = await verifyPayment.mutateAsync(response);
            setSuccessMsg(`Payment successful! New balance: ${result.balance} credits.`);
          } catch {
            setError("Payment verification failed. Please contact support if credits were deducted.");
          }
        },
        modal: { ondismiss: () => setBuyingPackId(null) },
      });
      rzp.open();
      setBuyingPackId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start payment");
      setBuyingPackId(null);
    }
  };

  return (
    <div className="px-4 pt-4 pb-5 md:px-8 md:pt-5" style={{ maxWidth: 1280, margin: "0 auto", height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="re-eyebrow">Credits</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>Credits &amp; billing</h1>
      <p style={{ marginTop: 6, color: "var(--fg-muted)", fontSize: 13.5 }}>
        Each competitor scan costs 1 credit. Your first scan is free.
      </p>

      {/* Balance hero */}
      <div
        style={{
          marginTop: 18,
          flexShrink: 0,
          position: "relative",
          overflow: "hidden",
          borderRadius: 16,
          border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, transparent), transparent 58%), var(--surface)",
          boxShadow: "var(--shadow-sm)",
          padding: "24px clamp(20px, 4vw, 28px)",
        }}
      >
        <div className="flex flex-wrap items-end justify-between" style={{ gap: 28 }}>
          <div style={{ minWidth: 0 }}>
            <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--accent)" }}>Balance</div>
            <div className="flex items-baseline" style={{ gap: 8, marginTop: 8 }}>
              <span className="tnum" style={{ fontSize: 46, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--fg)" }}>
                {balanceLoading ? "—" : balance?.free_scan_used === false ? "Free" : creditsRemaining}
              </span>
              <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>
                {balance?.free_scan_used === false ? "scan available" : "credits remaining"}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--fg-faint)", marginTop: 8 }}>
              1 credit = 1 full competitor scan · credits never expire
            </div>
          </div>

          {!balanceLoading && !txLoading && totalEver > 0 && (
            <div style={{ flex: "1 1 240px", maxWidth: 340 }}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 7 }}>
                <span className="re-eyebrow" style={{ fontSize: 11 }}>Usage</span>
                <span className="font-mono-feat tnum" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                  {scansUsed} / {totalEver}
                </span>
              </div>
              <div style={{ height: 9, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", boxShadow: "inset 0 0 0 1px var(--border-soft)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${usagePct}%`,
                    borderRadius: 99,
                    background: usagePct > 80
                      ? "linear-gradient(90deg, var(--warn), var(--neg))"
                      : "linear-gradient(90deg, color-mix(in srgb, var(--accent) 70%, #fff), var(--accent))",
                    transition: "width 500ms cubic-bezier(.2,.7,.2,1)",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 8 }}>
                {scansUsed} scan{scansUsed !== 1 ? "s" : ""} run · {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""} left
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buy Credits */}
      <div style={{ marginTop: 20, flexShrink: 0 }}>
        <div className="re-eyebrow" style={{ fontSize: 11 }}>Buy credits</div>
        <h2 className="re-h2" style={{ fontSize: 18, marginTop: 6, marginBottom: 4 }}>Top up — buy more, pay less per scan</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 13, marginBottom: 16 }}>1 credit = 1 full competitor scan. Credits never expire.</p>
        {error && (
          <div style={{ fontSize: 12, color: "var(--neg)", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "10px 14px", marginBottom: 16 }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ fontSize: 12, color: "var(--pos)", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "10px 14px", marginBottom: 16 }}>
            {successMsg}
          </div>
        )}
        {packsQuery.isLoading && (
          <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>Loading packs…</div>
        )}
        {packsQuery.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 14 }}>
            {(() => {
              const baselinePerCredit = packsQuery.data.length
                ? Math.max(...packsQuery.data.map((p) => p.price_paise / 100 / p.credits))
                : undefined;
              return packsQuery.data.map((pack) => (
                <CreditPackCard
                  key={pack.id}
                  pack={pack}
                  onBuy={handleBuy}
                  loading={buyingPackId === pack.id}
                  baselinePerCredit={baselinePerCredit}
                />
              ));
            })()}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div style={{ marginTop: 20, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="re-eyebrow" style={{ fontSize: 11, marginBottom: 10, flexShrink: 0 }}>Transaction history</div>
        <TransactionHistory />
      </div>
    </div>
  );
}
