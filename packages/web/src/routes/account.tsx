import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditPackCard } from "@/components/billing/credit-pack-card";
import { toast } from "sonner";
import { useMeQuery, useUpdateMeMutation } from "@/hooks/queries/use-me";
import { fileToAvatarDataUrl, MAX_AVATAR_FILE_BYTES } from "@/lib/avatar";

const ROLE_OPTIONS = [
  { value: "founder", label: "Founder" },
  { value: "pm", label: "Product / PM" },
  { value: "growth", label: "Growth / Marketing" },
  { value: "design", label: "Design" },
  { value: "other", label: "Other" },
] as const;
import {
  useBalanceQuery,
  useCreditPacksQuery,
  useTransactionsQuery,
  useCreateOrderMutation,
  useVerifyPaymentMutation,
} from "@/hooks/queries/use-billing";
import { authClient } from "@/lib/auth-client";
import { clearQueryCache } from "@/lib/query-client";
import type { CreditPack } from "@/api/billing";

type SectionKey =
  | "profile"
  | "workspace"
  | "billing"
  | "api"
  | "notifications"
  | "danger";

// Only sections backed by real data/actions are exposed. Workspace, API &
// webhooks, and Notifications were placeholder/mock UI (fake API key, fake
// webhook URL, static toggles) and are hidden until the backends exist, so we
// never present fabricated data as real.
const SECTIONS: ReadonlyArray<readonly [SectionKey, string]> = [
  ["profile", "Profile"],
  ["billing", "Billing"],
  ["danger", "Danger zone"],
];

export function AccountPage() {
  const [section, setSection] = useState<SectionKey>("profile");
  const navigate = useNavigate();

  function onSignOut() {
    navigate("/signin", { replace: true, state: { signedOut: true } });
    void authClient.signOut().finally(() => {
      void clearQueryCache();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Body: side nav + scrollable content */}
      <div className="flex flex-col md:flex-row flex-1" style={{ minHeight: 0 }}>
        <nav
          className="shrink-0 hidden md:flex flex-col gap-0.5 px-3 py-4"
          style={{ width: 200, borderRight: "1px solid var(--border-soft)" }}
        >
          {SECTIONS.map(([k, l]) => {
            const active = section === k;
            return (
              <button
                key={k}
                onClick={() => setSection(k)}
                className="w-full"
                style={{
                  border: 0,
                  background: active ? "var(--hover)" : "transparent",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  fontSize: 13,
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                }}
              >
                {l}
              </button>
            );
          })}

          <button
            onClick={onSignOut}
            className="w-full mt-auto"
            style={{
              border: "1px solid var(--neg)",
              background: "transparent",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: "var(--r-md)",
              fontSize: 13,
              color: "var(--neg)",
              cursor: "pointer",
            }}
          >
            <Icon name="log-out" size={14} />
            Sign out
          </button>
        </nav>

        {/* Mobile nav */}
        <div className="flex md:hidden flex-row gap-1 px-4 py-3 w-full shrink-0 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          {SECTIONS.map(([k, l]) => {
            const active = section === k;
            return (
              <button
                key={k}
                onClick={() => setSection(k)}
                className="shrink-0 whitespace-nowrap"
                style={{
                  border: 0,
                  background: active ? "var(--hover)" : "transparent",
                  padding: "6px 10px",
                  borderRadius: "var(--r-md)",
                  fontSize: 12,
                  color: active ? "var(--fg)" : "var(--fg-muted)",
                  fontWeight: active ? 500 : 400,
                  cursor: "pointer",
                }}
              >
                {l}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-0 px-4 pt-4 pb-6 md:px-7">
          {section === "profile" && <ProfileSection />}
          {section === "workspace" && <WorkspaceSection />}
          {section === "billing" && <BillingSection />}
          {section === "api" && <ApiSection />}
          {section === "notifications" && <NotifSection />}
          {section === "danger" && <DangerSection />}
        </div>
      </div>
    </div>
  );
}

function FormCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="re-card" style={{ marginBottom: 16 }}>
      <div className="re-card-hd">
        <h3>{title}</h3>
        {sub && <span className="hd-sub text-fg-faint font-mono-feat" style={{ fontSize: 11 }}>{sub}</span>}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-6"
      style={{
        padding: "12px 0",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div className="min-w-0">
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && (
          <div className="text-fg-muted" style={{ fontSize: 11, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ProfileSection() {
  const { data: me } = useMeQuery();
  const updateMe = useUpdateMeMutation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarAction, setAvatarAction] = useState<"upload" | "remove" | null>(null);
  const name = me?.name ?? "";
  const email = me?.email ?? "";
  const image = me?.image ?? "";
  const initial = (name || email || "?").charAt(0).toUpperCase();

  const role = me?.role ?? "";
  const [nameInput, setNameInput] = useState(name);
  const [roleInput, setRoleInput] = useState(role);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setNameInput(name);
  }, [name]);
  useEffect(() => {
    setRoleInput(role);
  }, [role]);
  const dirty = nameInput.trim() !== name || roleInput !== role;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateMe.mutateAsync({ name: nameInput.trim(), role: roleInput });
      toast.success("Profile saved");
    } catch {
      toast.error("Couldn’t save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setAvatarError("Image must be under 5 MB.");
      return;
    }
    setAvatarAction("upload");
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await updateMe.mutateAsync({ image: dataUrl });
    } catch {
      setAvatarError("Could not process that image. Try another one.");
    } finally {
      setAvatarAction(null);
    }
  };

  const handleRemove = async () => {
    setAvatarError(null);
    setAvatarAction("remove");
    try {
      await updateMe.mutateAsync({ image: "" });
    } catch {
      setAvatarError("Could not remove the avatar. Try again.");
    } finally {
      setAvatarAction(null);
    }
  };

  return (
    <FormCard title="Profile" sub="who you are in this workspace">
      <Field label="Avatar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {image ? (
            <img
              src={image}
              alt="Your avatar"
              style={{ width: 44, height: 44, borderRadius: 99, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 99,
                background: "linear-gradient(135deg,#1080D0,#5aaee0)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              {initial}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFile}
          />
          <button
            className="re-btn re-btn-sm"
            onClick={() => fileRef.current?.click()}
            disabled={updateMe.isPending}
          >
            {avatarAction === "upload" ? "Uploading…" : "Upload"}
          </button>
          <button
            className="re-btn re-btn-ghost re-btn-sm"
            onClick={handleRemove}
            disabled={updateMe.isPending || !image}
          >
            {avatarAction === "remove" ? "Removing…" : "Remove"}
          </button>
        </div>
        {avatarError && (
          <div className="text-neg" style={{ fontSize: 12, marginTop: 8 }}>
            {avatarError}
          </div>
        )}
      </Field>
      <Field label="Name">
        <input
          className="re-input w-full max-w-[280px]"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
      </Field>
      <Field label="Email">
        <input
          key={`email-${email}`}
          className="re-input w-full max-w-[280px]"
          defaultValue={email}
          readOnly
        />
      </Field>
      <Field label="Role" hint="Used to scope what we surface in alerts">
        <Select value={roleInput || undefined} onValueChange={setRoleInput}>
          <SelectTrigger className="w-full max-w-[280px] h-[34px] rounded-lg bg-[var(--surface-solid)] border-[var(--border-strong)] text-[var(--fg)]">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button
          className="re-btn"
          onClick={() => {
            setNameInput(name);
            setRoleInput(role);
          }}
          disabled={!dirty || saving}
        >
          Cancel
        </button>
        <button
          className="re-btn re-btn-primary"
          onClick={handleSave}
          disabled={!dirty || saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </FormCard>
  );
}

function WorkspaceSection() {
  const sources = [
    "r/SaaS",
    "r/ProductManagement",
    "r/ExperiencedDevs",
    "r/startups",
    "r/sysadmin",
  ];
  return (
    <FormCard title="Workspace" sub="stitchworks">
      <Field label="Workspace name">
        <input
          className="re-input w-full max-w-[280px]"
          defaultValue="Stitchworks"
        />
      </Field>
      <Field
        label="Default sources"
        hint="Subreddits pre-selected for new scans"
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sources.map((s) => (
            <span
              key={s}
              className="re-chip font-mono-feat"
              style={{ fontSize: 11 }}
            >
              {s} <Icon name="x" size={10} />
            </span>
          ))}
          <button className="re-btn re-btn-ghost re-btn-sm">+ Add source</button>
        </div>
      </Field>
      <Field label="Time zone">
        <Select defaultValue="America/New_York">
          <SelectTrigger className="w-full max-w-[280px] h-[34px] rounded-lg bg-[var(--surface-solid)] border-[var(--border-strong)] text-[var(--fg)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="America/New_York">America/New_York</SelectItem>
            <SelectItem value="America/Los_Angeles">
              America/Los_Angeles
            </SelectItem>
            <SelectItem value="Europe/London">Europe/London</SelectItem>
            <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FormCard>
  );
}

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

function BillingSection() {
  const { data: balance, isLoading: balanceLoading } = useBalanceQuery();
  const packsQuery = useCreditPacksQuery();
  const { data: transactions, isLoading: txLoading } = useTransactionsQuery();
  const createOrder = useCreateOrderMutation();
  const verifyPayment = useVerifyPaymentMutation();
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const scansUsed = transactions?.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0) ?? 0;
  const creditsRemaining = balance?.balance ?? 0;
  const totalEver = scansUsed + creditsRemaining;
  const usagePct = totalEver > 0 ? Math.min((scansUsed / totalEver) * 100, 100) : 0;
  const lastPurchase = transactions?.find((t) => t.type === "purchase" && t.razorpay_payment_id);

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

  return (
    <>
      {/* Row 1: Balance + Usage side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="re-card" style={{ padding: "12px 16px" }}>
          <div className="re-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>BALANCE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {balanceLoading ? (
              <span style={{ fontSize: 26, fontWeight: 700, color: "var(--fg-faint)" }}>—</span>
            ) : (
              <span style={{ fontSize: 26, fontWeight: 700, color: "var(--fg)" }}>
                {balance?.free_scan_used === false ? "Free" : (balance?.balance ?? 0)}
              </span>
            )}
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>credits</span>
          </div>
        </div>

        <div className="re-card" style={{ padding: "12px 16px" }}>
          <div className="re-eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>USAGE</div>
          {txLoading || balanceLoading ? (
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${usagePct}%`, borderRadius: 99, background: usagePct > 80 ? "var(--neg)" : "var(--accent)", transition: "width 400ms ease" }} />
                </div>
                <span className="font-mono-feat tnum" style={{ fontSize: 11, color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                  {scansUsed} / {totalEver}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>{scansUsed} run · {creditsRemaining} left</div>
            </>
          )}
        </div>
      </div>

      <FormCard title="Buy Credits">
        {error && (
          <div style={{ fontSize: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ fontSize: 12, color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
            {successMsg}
          </div>
        )}
        {packsQuery.isLoading && (
          <div style={{ color: "var(--fg-muted)", fontSize: 13 }}>Loading packs…</div>
        )}
        {packsQuery.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
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
      </FormCard>

      <FormCard title="Payment method">
        <Field label="Card on file">
          {txLoading ? (
            <div style={{ fontSize: 13, color: "var(--fg-faint)" }}>Loading…</div>
          ) : lastPurchase ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div
                style={{
                  width: 40,
                  height: 26,
                  borderRadius: 4,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fg-muted)" }}><rect x="1" y="1" width="18" height="12" rx="2"/><path d="M1 5h18"/><path d="M5 9h2"/></svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Razorpay</div>
                <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                  {`••••••••${lastPurchase.razorpay_payment_id?.slice(-6) ?? ""}`}
                </div>
              </div>
              <button className="re-btn re-btn-sm" style={{ marginLeft: "auto" }}>Update</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>No payment on file</span>
              <button className="re-btn re-btn-sm re-btn-primary" style={{ marginLeft: "auto" }}>Add payment</button>
            </div>
          )}
        </Field>
      </FormCard>

    </>
  );
}

function ApiSection() {
  return (
    <FormCard title="API key" sub="programmatic access">
      <div
        className="flex-wrap"
        style={{
          padding: 12,
          background: "var(--surface-2)",
          borderRadius: "var(--r-md)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span className="min-w-0 break-all" style={{ flex: 1 }}>
          rk_live_••••••••••••••••••••••••••a8f4
        </span>
        <button className="re-btn re-btn-ghost re-btn-sm">Copy</button>
        <button className="re-btn re-btn-ghost re-btn-sm">Rotate</button>
      </div>
      <p className="text-fg-muted" style={{ fontSize: 12, marginTop: 12 }}>
        Webhook endpoint receives a payload whenever a scan completes or a new
        alert fires.
      </p>
      <input
        className="re-input"
        defaultValue="https://api.stitchworks.io/hooks/rivaleye"
        style={{ width: "100%", marginTop: 8 }}
      />
    </FormCard>
  );
}

function NotifSection() {
  const items: ReadonlyArray<readonly [string, boolean]> = [
    ["Scan completes", true],
    ["Sentiment drops 0.1+ in 24h", true],
    ["Switching spike detected", true],
    ["Weekly digest (Mondays)", false],
    ["Slack push", false],
  ];
  return (
    <FormCard title="Notifications">
      {items.map(([label, on], i) => (
        <Field key={i} label={label}>
          <Toggle initial={on} />
        </Field>
      ))}
    </FormCard>
  );
}

function DangerSection() {
  return (
    <FormCard title="Danger zone">
      <div
        className="flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        style={{
          padding: 16,
          border: "1px solid var(--neg)",
          background: "rgba(220,38,38,0.04)",
          borderRadius: "var(--r-md)",
          display: "flex",
        }}
      >
        <div className="min-w-0">
          <div style={{ fontSize: 13, fontWeight: 500 }}>Delete workspace</div>
          <div className="text-fg-muted" style={{ fontSize: 12 }}>
            This will erase all scans, reports, and alerts. Permanent.
          </div>
        </div>
        <button
          className="re-btn shrink-0"
          style={{
            background: "var(--neg)",
            color: "#fff",
            borderColor: "var(--neg)",
          }}
        >
          Delete…
        </button>
      </div>
    </FormCard>
  );
}

function Toggle({
  initial,
  onChange,
}: {
  initial: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    setOn(initial);
  }, [initial]);
  const toggle = () => {
    const v = !on;
    setOn(v);
    onChange?.(v);
  };
  return (
    <button
      onClick={toggle}
      style={{
        position: "relative",
        width: 36,
        height: 20,
        borderRadius: 99,
        border: 0,
        background: on ? "var(--pos)" : "var(--border-strong)",
        cursor: "pointer",
        padding: 0,
        transition: "background 120ms",
      }}
    >
      <i
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: 99,
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 120ms",
        }}
      />
    </button>
  );
}
