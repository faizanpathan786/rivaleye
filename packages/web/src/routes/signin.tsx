import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@/components/icons";
import { authClient } from "@/lib/auth-client";
import { CONFIG } from "@/global-config";

type ProviderId = "google" | "github" | "sso";

const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "sso", label: "Continue with SSO" },
];

function ProviderIcon({ name }: { name: ProviderId }) {
  const s = { width: 14, height: 14 };
  if (name === "google") {
    return (
      <svg viewBox="0 0 16 16" style={s}>
        <path
          fill="#4285F4"
          d="M15.5 8.18c0-.55-.05-1.08-.14-1.59H8v3h4.2a3.6 3.6 0 0 1-1.55 2.36v1.96h2.5c1.47-1.36 2.32-3.37 2.32-5.73z"
        />
        <path
          fill="#34A853"
          d="M8 16c2.1 0 3.86-.7 5.15-1.9l-2.5-1.95c-.7.47-1.58.75-2.65.75-2.04 0-3.77-1.38-4.4-3.23H1.05v2.03A8 8 0 0 0 8 16z"
        />
        <path
          fill="#FBBC05"
          d="M3.6 9.67A4.8 4.8 0 0 1 3.35 8c0-.58.1-1.14.25-1.67V4.3H1.05A8 8 0 0 0 0 8c0 1.29.3 2.5.84 3.7l2.76-2.03z"
        />
        <path
          fill="#EA4335"
          d="M8 3.1c1.15 0 2.18.4 3 1.17l2.22-2.22C11.85.77 10.1 0 8 0A8 8 0 0 0 1.05 4.3l2.76 2.03C4.23 4.48 5.96 3.1 8 3.1z"
        />
      </svg>
    );
  }
  if (name === "github") {
    return (
      <svg viewBox="0 0 16 16" style={s} fill="currentColor">
        <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.39v-1.4c-2.22.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.88 2.34.67.07-.52.28-.88.5-1.08-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.55.74.55 1.49v2.21c0 .22.14.47.55.39A8 8 0 0 0 8 0Z" />
      </svg>
    );
  }
  return <Icon name="user" size={14} />;
}

const SAMPLE_ROWS: [string, number, number][] = [
  ["Per-seat pricing punishes growing teams", 187, 91],
  ["No native time tracking", 152, 83],
  ["Mobile app feels like a viewer", 134, 74],
];

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? CONFIG.auth.redirectPath;
  const [email, setEmail] = useState("test@rivaleye.local");
  const [password, setPassword] = useState("testpass1234");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("Demo Founder");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hoverProvider, setHoverProvider] = useState<ProviderId | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    if (mode === "signup" && !name) {
      setError("Name required to sign up.");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? "Authentication failed.");
        setBusy(false);
        return;
      }
      navigate(returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed.");
      setBusy(false);
    }
  };

  const handleProvider = async (id: ProviderId) => {
    if (id !== "google") {
      setError(`${id.toUpperCase()} sign-in not yet configured.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${returnTo}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 460px",
        height: "100%",
        background: "var(--bg)",
      }}
    >
      {/* Left — pitch + visual */}
      <div
        style={{
          position: "relative",
          background: "var(--surface)",
          borderRight: "1px solid var(--border-soft)",
          padding: "40px 56px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.svg" alt="RivalEye logo" style={{ width: 120, height: 120, objectFit: "contain" }} />
          <div
            className="font-mono-feat"
            style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            RivalEye
          </div>
        </div>

        <div style={{ marginTop: 96, maxWidth: 520 }}>
          <div className="re-eyebrow">COMPETITIVE INTEL · v0.8</div>
          <h1 className="re-h1" style={{ marginTop: 12, fontSize: 44, lineHeight: 1.05 }}>
            Find what your
            <br />
            competitor's users
            <br />
            <span style={{ color: "var(--accent)" }}>actually hate</span>.
          </h1>
          <p
            className="text-fg-muted"
            style={{ marginTop: 16, fontSize: 15, lineHeight: 1.6, maxWidth: 480 }}
          >
            RivalEye scans Reddit, G2, LinkedIn, Product Hunt, and more. It
            clusters the complaints, surfaces high-intent leads, and hands you
            positioning angles your marketing team will actually use.
          </p>
        </div>

        {/* Visual sample */}
        <div style={{ marginTop: 56, position: "relative" }}>
          <div
            className="re-card"
            style={{
              maxWidth: 520,
              boxShadow: "var(--shadow-md)",
              transform: "rotate(-1deg)",
            }}
          >
            <div className="re-card-hd" style={{ padding: "10px 14px" }}>
              <h3 style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="re-dot re-dot-live"></span>
                Linear — Intel Report
              </h3>
              <span
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 10 }}
              >
                1247 mentions · 7 platforms
              </span>
            </div>
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {SAMPLE_ROWS.map(([t, m, s], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    className="font-mono-feat text-fg-faint tnum"
                    style={{ fontSize: 10, width: 16 }}
                  >
                    0{i + 1}
                  </span>
                  <div style={{ flex: 1, fontSize: 12, color: "var(--fg)" }}>{t}</div>
                  <span
                    className="font-mono-feat tnum text-fg-faint"
                    style={{ fontSize: 10 }}
                  >
                    {m}
                  </span>
                  <div className="re-meter neg" style={{ width: 56 }}>
                    <i style={{ width: `${s}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="re-card"
            style={{
              position: "absolute",
              right: 40,
              top: 80,
              width: 240,
              boxShadow: "var(--shadow-lg)",
              transform: "rotate(2deg)",
            }}
          >
            <div style={{ padding: 12 }}>
              <div className="re-eyebrow" style={{ fontSize: 9 }}>
                VERBATIM · r/SaaS
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.5 }}>
                "Once we hit 22 people I started begging finance for a flat tier.
                Linear's pricing scales <i>linearly</i> with us — that's the problem."
              </p>
              <div
                className="font-mono-feat text-fg-faint"
                style={{ fontSize: 10, marginTop: 8 }}
              >
                u/founder_42 · 3d · 412↑
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 56,
            right: 56,
            display: "flex",
            justifyContent: "space-between",
            color: "var(--fg-faint)",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          <span>SOC 2 Type II · GDPR compliant</span>
          <span>Built in Brooklyn</span>
        </div>
      </div>

      {/* Right — sign in */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div style={{ width: "100%", maxWidth: 340 }}>
          <h2 className="re-h2">{mode === "signin" ? "Sign in" : "Create account"}</h2>
          <p className="text-fg-muted" style={{ marginTop: 6, fontSize: 13 }}>
            {mode === "signin"
              ? "Welcome back. We saved your last scans."
              : "Spin up your competitive intel workspace."}
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 24,
            }}
          >
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="re-btn"
                disabled={busy}
                style={{
                  height: 38,
                  justifyContent: "center",
                  background:
                    hoverProvider === p.id
                      ? "var(--hover)"
                      : "var(--surface)",
                }}
                onMouseEnter={() => setHoverProvider(p.id)}
                onMouseLeave={() => setHoverProvider(null)}
                onClick={() => handleProvider(p.id)}
              >
                <ProviderIcon name={p.id} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
              color: "var(--fg-faint)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            <hr
              style={{
                flex: 1,
                border: 0,
                borderTop: "1px solid var(--border-soft)",
                margin: 0,
              }}
            />
            OR
            <hr
              style={{
                flex: 1,
                border: 0,
                borderTop: "1px solid var(--border-soft)",
                margin: 0,
              }}
            />
          </div>

          {mode === "signup" && (
            <>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "var(--fg-muted)",
                  marginBottom: 6,
                  fontFamily: "var(--font-mono)",
                }}
              >
                NAME
              </label>
              <input
                type="text"
                className="re-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", height: 38, marginBottom: 10 }}
                placeholder="Jane Founder"
                autoComplete="name"
              />
            </>
          )}

          <label
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--fg-muted)",
              marginBottom: 6,
              fontFamily: "var(--font-mono)",
            }}
          >
            EMAIL
          </label>
          <input
            type="email"
            className="re-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", height: 38 }}
            placeholder="you@company.com"
            autoComplete="email"
          />

          <label
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--fg-muted)",
              margin: "10px 0 6px",
              fontFamily: "var(--font-mono)",
            }}
          >
            PASSWORD
          </label>
          <input
            type="password"
            className="re-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            style={{ width: "100%", height: 38 }}
            placeholder="••••••••"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />

          {error && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                fontSize: 12,
                color: "var(--accent-danger, #c0392b)",
                background: "var(--surface)",
                border: "1px solid var(--border-soft)",
                borderRadius: 6,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            className="re-btn re-btn-primary"
            onClick={handleSubmit}
            disabled={busy}
            style={{
              width: "100%",
              height: 38,
              marginTop: 10,
              justifyContent: "center",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Working…" : mode === "signin" ? "Continue" : "Create account"}{" "}
            <Icon name="arrow-right" size={14} />
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "var(--fg-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {mode === "signin"
              ? "No account? Create one →"
              : "Already have an account? Sign in →"}
          </button>

          <p
            style={{
              marginTop: 20,
              fontSize: 11,
              color: "var(--fg-faint)",
              lineHeight: 1.6,
            }}
          >
            By continuing you agree to our Terms and acknowledge our Privacy
            Policy. We analyze publicly-available Reddit data only.
          </p>
        </div>
      </div>
    </div>
  );
}
