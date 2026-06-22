type Composition = {
  positive: number | null;
  neutral: number | null;
  negative: number | null;
};

function verdict(v: number | null): { label: string; color: string } {
  if (v == null) return { label: "no signal", color: "var(--fg-faint)" };
  if (v <= -0.3) return { label: "▼ hostile", color: "var(--neg)" };
  if (v < -0.05) return { label: "▼ leaning negative", color: "var(--neg)" };
  if (v >= 0.3) return { label: "▲ loved", color: "var(--pos)" };
  if (v > 0.05) return { label: "▲ leaning positive", color: "var(--pos)" };
  return { label: "— mixed", color: "var(--warn)" };
}

export function SentimentMeter({
  value,
  composition,
}: {
  value: number | null;
  composition: Composition;
}) {
  const v = value ?? 0;
  const pos = composition.positive ?? 0;
  const neu = composition.neutral ?? 0;
  const neg = composition.negative ?? 0;
  const total = pos + neu + neg;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const needleLeft = `${((Math.max(-1, Math.min(1, v)) + 1) / 2) * 100}%`;
  const vd = verdict(value);

  return (
    <div>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 18 }}>
        <span className="font-mono-feat" style={{ fontSize: 10, letterSpacing: "0.02em", color: "var(--fg-faint)" }}>
          Net sentiment
        </span>
        <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: vd.color }}>
          {vd.label}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 99,
          background:
            "linear-gradient(90deg, color-mix(in srgb, var(--neg) 55%, transparent), color-mix(in srgb, var(--fg-faint) 38%, transparent) 50%, color-mix(in srgb, var(--pos) 55%, transparent))",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -7,
            left: needleLeft,
            width: 2,
            height: 22,
            background: "var(--fg)",
            borderRadius: 2,
            transform: "translateX(-50%)",
          }}
        >
          <span
            className="font-mono-feat tnum"
            style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}
          >
            {value != null ? value.toFixed(2).replace("-", "−") : "—"}
          </span>
          <span
            style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", width: 9, height: 9, borderRadius: 99, background: "var(--fg)", border: "2px solid var(--bg)" }}
          />
        </div>
      </div>

      <div className="flex justify-between font-mono-feat" style={{ marginTop: 11, fontSize: 10, color: "var(--fg-faint)" }}>
        <span>−1.0 hostile</span>
        <span>0</span>
        <span>+1.0 loved</span>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap font-mono-feat" style={{ marginTop: 18, gap: 18, fontSize: 11, color: "var(--fg-muted)" }}>
          <Legend swatch="var(--pos)" pct={pct(pos)} label="positive" />
          <Legend swatch="var(--fg-faint)" pct={pct(neu)} label="neutral" />
          <Legend swatch="var(--neg)" pct={pct(neg)} label="negative" />
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, pct, label }: { swatch: string; pct: number; label: string }) {
  return (
    <span>
      <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: 2, marginRight: 6, verticalAlign: "middle", background: swatch }} />
      <b style={{ color: "var(--fg)", fontWeight: 600 }}>{pct}%</b> {label}
    </span>
  );
}
