import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { CreditPackCard } from "@/components/billing/credit-pack-card";
import { useCreditPacksQuery, useCreateOrderMutation, useVerifyPaymentMutation } from "@/hooks/queries/use-billing";
import type { CreditPack } from "@/api/billing";

interface PaywallModalProps {
  onClose: () => void;
  onPurchaseSuccess: () => void;
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("razorpay-checkout-js")) { resolve(); return; }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay script"));
    document.head.appendChild(script);
  });
}

export function PaywallModal({ onClose, onPurchaseSuccess }: PaywallModalProps) {
  const packsQuery = useCreditPacksQuery();
  const createOrder = useCreateOrderMutation();
  const verifyPayment = useVerifyPaymentMutation();
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async (pack: CreditPack) => {
    setError(null);
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
            await verifyPayment.mutateAsync({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onPurchaseSuccess();
          } catch {
            setError("Payment verification failed. Please contact support.");
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

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          borderRadius: 14,
          width: "100%",
          maxWidth: 600,
          padding: "24px 24px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>Buy Credits</div>
            <div style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>
              You've used your free scan. Buy credits to continue — 1 credit per scan.
            </div>
          </div>
          <button className="re-btn re-btn-ghost re-btn-icon re-btn-sm" onClick={onClose} style={{ marginLeft: 12, flexShrink: 0 }}>
            <Icon name="x" size={14} />
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "8px 12px", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {packsQuery.isLoading && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--fg-muted)", fontSize: 13 }}>Loading packs…</div>
        )}

        {packsQuery.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 4 }}>
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

        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 16, textAlign: "center" }}>
          Secure payment via Razorpay · Credits never expire
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
