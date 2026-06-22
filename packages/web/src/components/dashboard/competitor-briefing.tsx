import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileText, Plus, RefreshCw } from "lucide-react";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import { SentimentMeter } from "@/components/dashboard/sentiment-meter";
import { OpportunityCard } from "@/components/dashboard/opportunity-card";
import {
  useReportComplaintsQuery,
  useReportVoiceQuery,
  useReportSwitchingQuery,
} from "@/hooks/queries/use-reports";
import type { ReportRow } from "@/api/reports";
import type { DashboardOpportunity } from "@/api/dashboard";

export function CompetitorBriefing({
  report,
  opportunities,
}: {
  report: ReportRow;
  opportunities: DashboardOpportunity[];
}) {
  const navigate = useNavigate();
  const name = report.primary_competitor_name ?? report.competitors[0] ?? "Competitor";

  const complaints = useReportComplaintsQuery(report.id);
  const voice = useReportVoiceQuery(report.id);
  const switching = useReportSwitchingQuery(report.id);

  const reScan = () => navigate("/scan", { state: { prefillCompetitor: name } });
  const openReport = () => navigate(`/scan-report/${report.id}`);

  const painPoints = useMemo(
    () => (complaints.data ?? []).slice(0, 4),
    [complaints.data],
  );

  const voiceWords = useMemo(() => {
    const v = voice.data;
    if (!v) return [] as { word: string; count: number; tone: "pos" | "neg" }[];
    const merged = [
      ...v.negative.map((w) => ({ ...w, tone: "neg" as const })),
      ...v.positive.map((w) => ({ ...w, tone: "pos" as const })),
    ].sort((a, b) => b.count - a.count);
    return merged.slice(0, 10);
  }, [voice.data]);

  const maxCount = voiceWords[0]?.count ?? 1;

  const switchReasons = switching.data?.reasons_out ?? report.switching_reasons_out ?? [];
  const netSignal = switching.data?.net_signal ?? report.switching_net_signal;

  return (
    <div>
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.2, 0.7, 0.2, 1] }}
        className="grid gap-8 lg:gap-10"
        style={{ gridTemplateColumns: "minmax(0,1fr)", paddingBottom: 26, borderBottom: "1px solid var(--border-soft)" }}
      >
        <div className="grid items-center gap-8 lg:gap-10" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <div className="lg:grid lg:items-center lg:gap-10" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(340px,440px)" }}>
            {/* identity */}
            <div className="flex items-center gap-4" style={{ minWidth: 0 }}>
              <CompetitorAvatar name={name} domain={report.primary_competitor_domain} size={52} borderRadius={13} />
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {name}
                </h1>
                <div className="font-mono-feat flex flex-wrap" style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 9, gap: 9 }}>
                  {report.category && <span>{report.category}</span>}
                  {report.category && <span style={{ color: "var(--border-strong)" }}>/</span>}
                  <span>{(report.total_sources ?? 0).toLocaleString()} mentions</span>
                </div>
                <div className="flex gap-2" style={{ marginTop: 14 }}>
                  <button className="re-btn re-btn-sm" onClick={openReport}>
                    <FileText size={13} /> Full report
                  </button>
                  <button className="re-btn re-btn-ghost re-btn-sm" onClick={reScan}>
                    <RefreshCw size={13} /> Re-scan
                  </button>
                </div>
              </div>
            </div>

            {/* meter */}
            <div className="mt-8 lg:mt-0">
              <SentimentMeter
                value={report.sentiment_overall}
                composition={{
                  positive: report.sentiment_positive,
                  neutral: report.sentiment_neutral,
                  negative: report.sentiment_negative,
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* MAIN GRID */}
      <div className="grid gap-9 lg:gap-10" style={{ gridTemplateColumns: "minmax(0,1fr)", marginTop: 28 }}>
        <div className="lg:grid lg:gap-10" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
          {/* opportunities */}
          <section>
            <SectionHead title="Opportunities to act on" hint="Ranked by payoff" actionLabel="All opps" onAction={() => navigate("/pain-opps")} />
            {opportunities.length === 0 ? (
              <EmptyNote text="Opportunities surface once the scan finishes analysing complaints and switching signals." />
            ) : (
              <div className="flex flex-col" style={{ gap: 12 }}>
                {opportunities.map((o, i) => (
                  <OpportunityCard key={o.id} opportunity={o} index={i} onOpen={openReport} />
                ))}
              </div>
            )}
          </section>

          {/* right rail */}
          <aside className="mt-9 lg:mt-0 flex flex-col" style={{ gap: 30 }}>
            <div>
              <SectionHead title="Switching signal" hint={netSignal ?? "Net flow"} />
              {switchReasons.length === 0 ? (
                <EmptyNote text="No clear switching pattern yet." small />
              ) : (
                <div>
                  {switchReasons.slice(0, 5).map((r, i) => (
                    <div
                      key={`${r}-${i}`}
                      className="flex items-center gap-3"
                      style={{ padding: "10px 0", borderTop: i === 0 ? 0 : "1px solid var(--border-soft)" }}
                    >
                      <span className="font-mono-feat" style={{ fontSize: 10, color: "var(--fg-faint)", width: 16 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="break-words" style={{ fontSize: 12.5, color: "var(--fg)" }}>{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <SectionHead title="Voice of the user" hint="Most repeated" />
              {voiceWords.length === 0 ? (
                <EmptyNote text="Recurring phrases appear here after analysis." small />
              ) : (
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {voiceWords.map((w) => {
                    const big = w.count >= maxCount * 0.66;
                    const color =
                      w.tone === "neg" ? "var(--neg)" : "var(--pos)";
                    const bg =
                      w.tone === "neg"
                        ? "color-mix(in srgb, var(--neg) 9%, transparent)"
                        : "color-mix(in srgb, var(--pos) 11%, transparent)";
                    return (
                      <span
                        key={w.word}
                        className="font-mono-feat"
                        style={{
                          fontSize: big ? 14 : 12,
                          fontWeight: big ? 600 : 400,
                          padding: "5px 11px",
                          borderRadius: 8,
                          color,
                          background: bg,
                        }}
                      >
                        {w.word}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* PAIN POINTS */}
      {painPoints.length > 0 && (
        <section style={{ marginTop: 40, paddingTop: 28, borderTop: "1px solid var(--border-soft)" }}>
          <SectionHead title="Top pain points" hint="By mention volume" actionLabel="Full report" onAction={openReport} />
          <div>
            {painPoints.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={openReport}
                className="grid w-full text-left items-center"
                style={{ gridTemplateColumns: "30px 1fr auto", gap: 16, padding: "15px 4px", borderTop: i === 0 ? 0 : "1px solid var(--border-soft)", cursor: "pointer" }}
              >
                <span className="font-mono-feat" style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-faint)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="break-words" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>{c.title}</div>
                  {c.sample && (
                    <div className="break-words" style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 3, fontStyle: "italic" }}>
                      “{c.sample}”
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="font-mono-feat tnum" style={{ fontSize: 15, fontWeight: 600 }}>{c.mentions.toLocaleString()}</div>
                  {c.delta && (
                    <div className="font-mono-feat" style={{ fontSize: 10, marginTop: 2, color: deltaColor(c.delta) }}>
                      {c.delta}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* GROWTH CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="re-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ marginTop: 36, padding: "18px 20px", background: "var(--surface-2)" }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
            You're tracking one competitor.
          </div>
          <div className="text-fg-muted" style={{ fontSize: 12.5, marginTop: 3 }}>
            Add another to unlock side-by-side comparison and cross-competitor opportunities.
          </div>
        </div>
        <button className="re-btn re-btn-accent shrink-0" onClick={() => navigate("/scan")}>
          <Plus size={14} /> Add competitor
        </button>
      </motion.div>
    </div>
  );
}

function deltaColor(delta: string): string {
  if (/^[+▲↑]|up/i.test(delta.trim())) return "var(--neg)";
  if (/^[-▼↓]|down/i.test(delta.trim())) return "var(--pos)";
  return "var(--fg-faint)";
}

function SectionHead({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 16 }}>
      <div className="flex items-baseline gap-2 min-w-0">
        <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.01em" }}>{title}</h3>
        {hint && (
          <span className="font-mono-feat truncate" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.04em" }}>
            {hint}
          </span>
        )}
      </div>
      {actionLabel && onAction && (
        <button className="re-btn re-btn-ghost re-btn-sm shrink-0" onClick={onAction}>
          {actionLabel} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

function EmptyNote({ text, small }: { text: string; small?: boolean }) {
  return (
    <div
      className="re-card text-fg-muted"
      style={{ padding: small ? 14 : 24, fontSize: small ? 12 : 13, lineHeight: 1.5, textAlign: small ? "left" : "center" }}
    >
      {text}
    </div>
  );
}
