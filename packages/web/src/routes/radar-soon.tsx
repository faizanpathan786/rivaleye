import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bell, GitBranch, Radar } from "lucide-react";

const FEATURES = [
  { Icon: Bell, title: "Real-time move alerts", blurb: "Get pinged the moment a competitor's users start churning or revolting." },
  { Icon: GitBranch, title: "Severity triage", blurb: "Signals ranked urgent → low, so you only act on what moves the needle." },
  { Icon: Radar, title: "Switch-risk radar", blurb: "Spot users publicly shopping for alternatives before they leave." },
];

export function RadarComingSoonPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <div className="px-4 py-8 md:px-8 w-full" style={{ minHeight: "100%", display: "grid", placeItems: "center" }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
        className="text-center mx-auto"
        style={{ maxWidth: 540 }}
      >
        {/* radar scope */}
        <div
          className="mx-auto"
          style={{
            position: "relative",
            width: 248,
            height: 248,
            borderRadius: "50%",
            border: "1px solid var(--border-strong)",
            background: "radial-gradient(circle at 50% 50%, var(--accent-soft) 0%, transparent 70%)",
            overflow: "hidden",
          }}
        >
          {/* rings */}
          {[180, 110].map((d) => (
            <span key={d} style={{ position: "absolute", top: "50%", left: "50%", width: d, height: d, transform: "translate(-50%,-50%)", borderRadius: "50%", border: "1px solid var(--border-soft)" }} />
          ))}
          {/* crosshair */}
          <span style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "var(--border-soft)", transform: "translateX(-50%)" }} />
          <span style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "var(--border-soft)", transform: "translateY(-50%)" }} />
          {/* sweep — rotates while hue-rotating through the logo's color family */}
          <div
            className={reduce ? "" : "radar-scan"}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "conic-gradient(from 0deg, #0061b1, transparent 95deg)",
            }}
          />
          {/* blips */}
          <span className="pulse-dot" style={{ position: "absolute", top: "30%", left: "64%", width: 7, height: 7, borderRadius: 99, background: "var(--neg)" }} />
          <span className="pulse-dot" style={{ position: "absolute", top: "66%", left: "38%", width: 5, height: 5, borderRadius: 99, background: "var(--warn)" }} />
          {/* logo at center — clipped to a circle so the raster's white background
              reads as a deliberate lens hub rather than a white square */}
          <span
            style={{
              position: "absolute", top: "50%", left: "50%", width: 84, height: 84,
              transform: "translate(-50%,-50%)", borderRadius: "50%", overflow: "hidden",
              boxShadow: "var(--shadow-md), 0 0 0 1px var(--border-soft)",
            }}
          >
            <img src="/logo.svg" alt="RivalEye" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </span>
        </div>

        <div className="re-eyebrow" style={{ marginTop: 32 }}>Radar · in development</div>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.1, marginTop: 12 }}>
          Always-on competitor radar
        </h1>
        <p className="text-fg-muted mx-auto" style={{ marginTop: 12, fontSize: 15, lineHeight: 1.55, maxWidth: 440 }}>
          RivalEye watches your competitors around the clock and pings you the moment their users churn,
          demand something new, or start shopping for alternatives. We're putting the finishing touches on it.
        </p>

        {/* feature row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginTop: 32, textAlign: "left" }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.07, ease: [0.2, 0.7, 0.2, 1] }}
              className="re-card"
              style={{ padding: 14 }}
            >
              <div className="grid place-items-center" style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent)" }}>
                <f.Icon size={16} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{f.title}</div>
              <p style={{ fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.45, marginTop: 4 }}>{f.blurb}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-2 justify-center flex-wrap" style={{ marginTop: 32 }}>
          <button className="re-btn re-btn-accent" onClick={() => navigate("/scan")}>
            Run a scan instead <ArrowRight size={15} />
          </button>
          <button className="re-btn" onClick={() => navigate("/")}>
            Back to overview
          </button>
        </div>
      </motion.div>
    </div>
  );
}
