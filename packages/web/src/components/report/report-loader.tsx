import { useReducedMotion } from "framer-motion";

export function ReportLoader({ label }: { label: string }) {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col items-center justify-center gap-5 px-4 py-20 md:px-7">
      {/* radar scope — same visual language as the Radar page */}
      <div
        style={{
          position: "relative",
          width: 130,
          height: 130,
          borderRadius: "50%",
          border: "1px solid var(--border-strong)",
          background:
            "radial-gradient(circle at 50% 50%, var(--accent-soft) 0%, transparent 70%)",
          overflow: "hidden",
        }}
      >
        {/* rings */}
        {[104, 64].map((d) => (
          <span
            key={d}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: d,
              height: d,
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              border: "1px solid var(--border-soft)",
            }}
          />
        ))}
        {/* crosshair */}
        <span
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: 1,
            background: "var(--border-soft)",
            transform: "translateX(-50%)",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: 1,
            background: "var(--border-soft)",
            transform: "translateY(-50%)",
          }}
        />
        {/* sweep — rotates while cycling through the brand colors */}
        <div
          className={reduce ? "" : "radar-scan"}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "conic-gradient(from 0deg, #0061b1, transparent 95deg)",
          }}
        />
        {/* blip */}
        <span
          className="pulse-dot"
          style={{
            position: "absolute",
            top: "32%",
            left: "66%",
            width: 6,
            height: 6,
            borderRadius: 99,
            background: "var(--neg)",
          }}
        />
        {/* logo hub */}
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 48,
            height: 48,
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "var(--shadow-md), 0 0 0 1px var(--border-soft)",
          }}
        >
          <img
            src="/logo.svg"
            alt="RivalEye"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </span>
      </div>
      <div className="re-eyebrow" style={{ fontSize: 12 }}>
        {label}
      </div>
    </div>
  );
}
