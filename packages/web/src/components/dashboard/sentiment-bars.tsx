import { useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompetitorSummary } from "@/api/dashboard";

type Row = { name: string; sentiment: number; mentions: number };

function toneColor(v: number): string {
  if (v <= -0.3) return "var(--neg)";
  if (v < -0.05) return "var(--warn)";
  if (v >= 0.15) return "var(--pos)";
  return "var(--fg-faint)";
}

export function SentimentBars({ competitors }: { competitors: CompetitorSummary[] }) {
  const rows = useMemo<Row[]>(
    () =>
      competitors
        .filter((c) => c.stat_sentiment != null)
        .map((c) => ({
          name: c.name,
          sentiment: Number(c.stat_sentiment),
          mentions: c.stat_mentions ?? 0,
        }))
        .sort((a, b) => a.sentiment - b.sentiment)
        .slice(0, 8),
    [competitors],
  );

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center py-8 text-center font-mono-feat" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
        Sentiment appears here once a scan completes.
      </div>
    );
  }

  const height = Math.max(120, rows.length * 30 + 16);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
          barCategoryGap={6}
        >
          <XAxis type="number" domain={[-1, 1]} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
          />
          <ReferenceLine x={0} stroke="var(--border-strong)" strokeWidth={1} />
          <Tooltip
            cursor={{ fill: "var(--hover)" }}
            contentStyle={{
              background: "var(--surface-solid)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--shadow-md)",
            }}
            labelStyle={{ color: "var(--fg)", fontWeight: 600 }}
            formatter={(value, _name, item) => {
              const v = typeof value === "number" ? value : Number(value);
              const mentions = (item?.payload as Row | undefined)?.mentions ?? 0;
              return [`${v.toFixed(2)} · ${mentions.toLocaleString()} mentions`, "sentiment"];
            }}
          />
          <Bar dataKey="sentiment" radius={[3, 3, 3, 3]} barSize={14} isAnimationActive>
            {rows.map((r) => (
              <Cell key={r.name} fill={toneColor(r.sentiment)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
