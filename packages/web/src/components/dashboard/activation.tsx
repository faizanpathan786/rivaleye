import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Heart, AlertTriangle, Puzzle, Repeat } from "lucide-react";

const SIGNALS = [
  {
    key: "love",
    label: "Love",
    Icon: Heart,
    color: "var(--pos)",
    bg: "rgba(22,163,74,0.10)",
    blurb: "What users praise — the moats you'll have to match.",
  },
  {
    key: "pain",
    label: "Pain",
    Icon: AlertTriangle,
    color: "var(--neg)",
    bg: "rgba(220,38,38,0.10)",
    blurb: "What frustrates them — your wedge to win switchers.",
  },
  {
    key: "gap",
    label: "Gap",
    Icon: Puzzle,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.10)",
    blurb: "What's missing — features users keep asking for.",
  },
  {
    key: "switch",
    label: "Switch",
    Icon: Repeat,
    color: "var(--accent)",
    bg: "var(--accent-soft)",
    blurb: "Who's ready to leave — and exactly why.",
  },
] as const;

export function ActivationHero({ userName }: { userName: string | null }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function start(competitor?: string) {
    const c = (competitor ?? value).trim();
    navigate("/scan", c ? { state: { prefillCompetitor: c } } : undefined);
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 760 }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
        className="text-center"
        style={{ paddingTop: 24 }}
      >
        <div className="re-eyebrow">{userName ? `Welcome, ${userName}` : "Welcome to RivalEye"}</div>
        <h1
          className="mx-auto"
          style={{
            fontSize: "clamp(26px, 5vw, 38px)",
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            marginTop: 12,
            maxWidth: 620,
          }}
        >
          See what your competitors' users{" "}
          <span style={{ color: "var(--accent)" }}>really think.</span>
        </h1>
        <p
          className="mx-auto text-fg-muted"
          style={{ marginTop: 12, fontSize: 15, lineHeight: 1.55, maxWidth: 480 }}
        >
          What they love, what they hate, what they want next — and who's ready to switch.
          Drop in a competitor and get your first perception report.
        </p>

        {/* inline competitor input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
          className="mx-auto flex flex-col sm:flex-row gap-2"
          style={{ marginTop: 24, maxWidth: 480 }}
        >
          <input
            className="re-input"
            style={{ height: 44, fontSize: 14, flex: 1 }}
            placeholder="Competitor name or domain — e.g. Linear"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            className="re-btn re-btn-accent"
            style={{ height: 44, padding: "0 18px", fontSize: 14 }}
          >
            Scan now <ArrowRight size={15} />
          </button>
        </form>
        <button
          type="button"
          onClick={() => start("Linear")}
          className="font-mono-feat"
          style={{ marginTop: 12, fontSize: 12, color: "var(--fg-muted)", background: "none", border: 0, cursor: "pointer" }}
        >
          or try an example: Linear →
        </button>
      </motion.div>

      {/* signal teasers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginTop: 36 }}>
        {SIGNALS.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.06, ease: [0.2, 0.7, 0.2, 1] }}
            className="re-card"
            style={{ padding: 14 }}
          >
            <div
              className="grid place-items-center"
              style={{ width: 30, height: 30, borderRadius: 8, background: s.bg, color: s.color }}
            >
              <s.Icon size={16} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{s.label}</div>
            <p style={{ fontSize: 11.5, color: "var(--fg-muted)", lineHeight: 1.45, marginTop: 4 }}>
              {s.blurb}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
