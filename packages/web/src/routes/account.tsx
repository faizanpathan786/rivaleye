import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SectionKey =
  | "profile"
  | "workspace"
  | "billing"
  | "api"
  | "notifications"
  | "danger";

const SECTIONS: ReadonlyArray<readonly [SectionKey, string]> = [
  ["profile", "Profile"],
  ["workspace", "Workspace"],
  ["billing", "Billing"],
  ["api", "API & webhooks"],
  ["notifications", "Notifications"],
  ["danger", "Danger zone"],
];

export function AccountPage() {
  const [section, setSection] = useState<SectionKey>("profile");

  return (
    <div style={{ padding: "20px 28px 60px", maxWidth: 1080, margin: "0 auto" }}>
      <div className="re-eyebrow">ACCOUNT</div>
      <h1 className="re-h1" style={{ marginTop: 8 }}>
        Settings
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 32,
          marginTop: 20,
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map(([k, l]) => {
            const active = section === k;
            return (
              <button
                key={k}
                onClick={() => setSection(k)}
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
        </nav>

        <div style={{ minWidth: 0 }}>
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
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 24,
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid var(--border-soft)",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && (
          <div className="text-fg-muted" style={{ fontSize: 11, marginTop: 2 }}>
            {hint}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ProfileSection() {
  return (
    <FormCard title="Profile" sub="who you are in this workspace">
      <Field label="Avatar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 99,
              background: "linear-gradient(135deg,#ff5c1a,#ffb05a)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
              fontWeight: 600,
            }}
          >
            K
          </div>
          <button className="re-btn re-btn-sm">Upload</button>
          <button className="re-btn re-btn-ghost re-btn-sm">Remove</button>
        </div>
      </Field>
      <Field label="Name">
        <input
          className="re-input"
          defaultValue="Kira Mendez"
          style={{ width: 280 }}
        />
      </Field>
      <Field label="Email">
        <input
          className="re-input"
          defaultValue="kira@stitchworks.io"
          style={{ width: 280 }}
        />
      </Field>
      <Field label="Role" hint="Used to scope what we surface in alerts">
        <Select defaultValue="pm">
          <SelectTrigger className="re-input" style={{ width: 280 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="founder">Founder</SelectItem>
            <SelectItem value="pm">Product / PM</SelectItem>
            <SelectItem value="growth">Growth / Marketing</SelectItem>
            <SelectItem value="design">Design</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button className="re-btn">Cancel</button>
        <button className="re-btn re-btn-primary">Save changes</button>
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
          className="re-input"
          defaultValue="Stitchworks"
          style={{ width: 280 }}
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
          <SelectTrigger className="re-input" style={{ width: 280 }}>
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

type Tier = {
  n: string;
  p: string;
  f: string;
  current?: boolean;
};

function BillingSection() {
  const tiers: Tier[] = [
    { n: "Solo", p: "$19", f: "10 scans · 2 competitors" },
    {
      n: "Studio",
      p: "$49",
      f: "50 scans · 10 competitors",
      current: true,
    },
    { n: "Team", p: "$149", f: "Unlimited · API access" },
  ];
  return (
    <>
      <FormCard title="Plan" sub="Studio · $49/mo">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 10,
          }}
        >
          {tiers.map((t) => (
            <div
              key={t.n}
              style={{
                padding: 16,
                border: `1px solid ${t.current ? "var(--accent)" : "var(--border-soft)"}`,
                borderRadius: "var(--r-lg)",
                background: t.current ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 14 }}>{t.n}</span>
                {t.current && (
                  <span
                    className="re-chip re-chip-accent"
                    style={{ fontSize: 10 }}
                  >
                    CURRENT
                  </span>
                )}
              </div>
              <div
                className="font-mono-feat tnum"
                style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}
              >
                {t.p}
                <span className="text-fg-faint" style={{ fontSize: 12 }}>
                  {" "}
                  /mo
                </span>
              </div>
              <p
                className="text-fg-muted"
                style={{ fontSize: 12, marginTop: 8 }}
              >
                {t.f}
              </p>
            </div>
          ))}
        </div>
      </FormCard>
      <FormCard title="Usage" sub="this month">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span className="font-mono-feat" style={{ fontSize: 12 }}>
            SCANS
          </span>
          <span className="font-mono-feat tnum" style={{ fontSize: 12 }}>
            39 / 50
          </span>
        </div>
        <div className="re-meter">
          <i style={{ width: "78%" }} />
        </div>
      </FormCard>
      <FormCard title="Payment method">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 12,
            border: "1px solid var(--border-soft)",
            borderRadius: "var(--r-md)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 22,
              borderRadius: 3,
              background: "var(--fg)",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>
              Visa ending 4242
            </div>
            <div className="text-fg-muted" style={{ fontSize: 11 }}>
              Expires 09/2028
            </div>
          </div>
          <button className="re-btn re-btn-ghost re-btn-sm">Update</button>
        </div>
      </FormCard>
    </>
  );
}

function ApiSection() {
  return (
    <FormCard title="API key" sub="programmatic access">
      <div
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
        <span style={{ flex: 1 }}>
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
        style={{
          padding: 16,
          border: "1px solid var(--neg)",
          background: "rgba(220,38,38,0.04)",
          borderRadius: "var(--r-md)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Delete workspace</div>
          <div className="text-fg-muted" style={{ fontSize: 12 }}>
            This will erase all scans, reports, and alerts. Permanent.
          </div>
        </div>
        <button
          className="re-btn"
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
