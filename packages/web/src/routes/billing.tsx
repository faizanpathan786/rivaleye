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
    return <div style={{ color: "var(--fg-muted)", fontSize: 13, padding: "16px 0" }}>Loading…</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ color: "var(--fg-muted)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
        No transactions yet.
      </div>
    );
  }

  return (
    <div className="re-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ overflowY: "auto", maxHeight: 400 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--surface-2)", zIndex: 1 }}>
            <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--fg-muted)", fontWeight: 500 }}>Date</th>
              <th style={{ textAlign: "left", padding: "10px 16px", color: "var(--fg-muted)", fontWeight: 500 }}>Description</th>
              <th style={{ textAlign: "right", padding: "10px 16px", color: "var(--fg-muted)", fontWeight: 500 }}>Credits</th>
            </tr>
          </thead>
          <tbody>
            {data.map((tx) => (
              <tr key={tx.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <td style={{ padding: "10px 16px", color: "var(--fg-muted)" }}>
                  {new Date(tx.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td style={{ padding: "10px 16px", color: "var(--fg)" }}>{tx.description}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: tx.type === "purchase" ? "var(--pos)" : "var(--fg-muted)", fontWeight: 600 }}>
                  {tx.type === "purchase" ? "+" : "-"}{tx.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="px-4 pt-4 pb-12 md:px-7 md:pt-5" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="re-eyebrow">CREDITS</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>Credits &amp; billing</h1>
      <p style={{ marginTop: 6, color: "var(--fg-muted)", fontSize: 13 }}>
        Each competitor scan costs 1 credit. Your first scan is free.
      </p>

      {/* Balance + Usage */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
        <div className="re-card" style={{ padding: "16px 20px" }}>
          <div className="re-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>BALANCE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
            {balanceLoading ? (
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--fg-faint)" }}>—</span>
            ) : (
              <span style={{ fontSize: 28, fontWeight: 700, color: "var(--fg)", whiteSpace: "nowrap" }}>
                {balance?.free_scan_used === false ? "Free" : creditsRemaining}
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
              {balance?.free_scan_used === false ? "free scan" : "credits"}
            </span>
          </div>
        </div>

        <div className="re-card" style={{ padding: "16px 20px" }}>
          <div className="re-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>USAGE</div>
          {txLoading || balanceLoading ? (
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${usagePct}%`, borderRadius: 99, background: usagePct > 80 ? "var(--neg)" : "var(--accent)", transition: "width 400ms ease" }} />
                </div>
                <span className="font-mono-feat tnum" style={{ fontSize: 12, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                  {scansUsed} / {totalEver}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                {scansUsed} scan{scansUsed !== 1 ? "s" : ""} run · {creditsRemaining} credit{creditsRemaining !== 1 ? "s" : ""} remaining
              </div>
            </>
          )}
        </div>
      </div>

      {/* Buy Credits */}
      <div style={{ marginTop: 24 }}>
        <div className="re-eyebrow" style={{ marginBottom: 12 }}>BUY CREDITS</div>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: 12 }}>
            {packsQuery.data.map((pack) => (
              <CreditPackCard
                key={pack.id}
                pack={pack}
                onBuy={handleBuy}
                loading={buyingPackId === pack.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div style={{ marginTop: 32 }}>
        <div className="re-eyebrow" style={{ marginBottom: 12 }}>TRANSACTION HISTORY</div>
        <TransactionHistory />
      </div>
    </div>
  );
}
