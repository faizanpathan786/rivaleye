import { useState } from "react";
import { CompetitorAvatar } from "@/components/competitor-avatar";
import {
  useReportsQuery,
  useReportComplaintsQuery,
  useReportOpportunitiesQuery,
} from "@/hooks/queries/use-reports";
import type { Complaint, Opportunity, ReportRow } from "@/api/reports";

export function PainOppsPage() {
  const { data: reports = [], isLoading: reportsLoading } = useReportsQuery();
  const completed = reports.filter((r) => r.status === "completed" || r.stage === "done");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const effectiveId = selectedId ?? completed[0]?.id ?? null;
  const selectedReport = completed.find((r) => r.id === effectiveId) ?? null;

  const { data: complaints = [], isLoading: complaintsLoading } =
    useReportComplaintsQuery(effectiveId ?? undefined);
  const { data: opportunities = [], isLoading: oppsLoading } =
    useReportOpportunitiesQuery(effectiveId ?? undefined);

  const isLoading = complaintsLoading || oppsLoading;

  return (
    <div className="px-4 py-8 md:px-7" style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="re-eyebrow" style={{ fontSize: 10, color: "var(--neg)" }}>⚡ PAIN & OPPORTUNITIES</div>
        <h1 className="re-h1" style={{ fontSize: "clamp(20px,4vw,28px)", marginTop: 6, letterSpacing: "-0.02em" }}>
          Competitor Pain Analysis
        </h1>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginTop: 4 }}>
          Select a competitor to see what their users complain about and where you can win.
        </p>
      </div>

      {/* Competitor selector */}
      {reportsLoading ? (
        <div className="re-card px-5 py-8 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
          Loading competitors…
        </div>
      ) : completed.length === 0 ? (
        <div className="re-card px-5 py-10 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
          No completed reports yet. Run a scan first.
        </div>
      ) : (
        <>
          <CompetitorSelector
            reports={completed}
            selectedId={effectiveId}
            onSelect={setSelectedId}
          />

          {selectedReport && (
            <PainContent
              report={selectedReport}
              complaints={complaints}
              opportunities={opportunities}
              isLoading={isLoading}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Competitor selector ────────────────────────────────────────────────────

function CompetitorSelector({
  reports,
  selectedId,
  onSelect,
}: {
  reports: ReportRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-2.5"
      style={{ marginBottom: 32 }}
    >
      {reports.map((r) => {
        const name = r.primary_competitor_name ?? r.competitors[0] ?? r.category;
        const domain = r.primary_competitor_domain ?? "";
        const isSelected = r.id === selectedId;
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className="flex items-center gap-2.5 cursor-pointer border-0"
            style={{
              padding: "8px 14px 8px 10px",
              borderRadius: 99,
              background: isSelected
                ? "color-mix(in srgb, var(--neg) 12%, var(--surface))"
                : "var(--surface)",
              border: `1.5px solid ${isSelected ? "var(--neg)" : "var(--border-soft)"}`,
              transition: "border-color 150ms, background 150ms",
              fontSize: 13,
              color: isSelected ? "var(--fg)" : "var(--fg-muted)",
              fontWeight: isSelected ? 500 : 400,
            }}
          >
            <CompetitorAvatar name={name} domain={domain} size={22} borderRadius={99} />
            <span>{name}</span>
            {isSelected && (
              <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--neg)", marginLeft: 2 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main content ────────────────────────────────────────────────────────────

function PainContent({
  report,
  complaints,
  opportunities,
  isLoading,
}: {
  report: ReportRow;
  complaints: Complaint[];
  opportunities: Opportunity[];
  isLoading: boolean;
}) {
  const name = report.primary_competitor_name ?? report.competitors[0] ?? report.category;

  if (isLoading) {
    return (
      <div className="re-card px-5 py-12 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
        Loading pain data for {name}…
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div
        className="flex items-center gap-6 flex-wrap"
        style={{
          padding: "12px 16px",
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          borderRadius: "var(--r-md)",
          marginBottom: 24,
        }}
      >
        <CompetitorAvatar
          name={name}
          domain={report.primary_competitor_domain ?? ""}
          size={32}
          borderRadius={8}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{name}</div>
          <div className="font-mono-feat" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
            {complaints.length} COMPLAINTS · {opportunities.length} OPPORTUNITIES
          </div>
        </div>
      </div>

      {/* Complaints */}
      <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        COMPLAINTS{" "}
        <span className="font-mono-feat text-fg-faint">({complaints.length})</span>
      </div>
      {complaints.length === 0 ? (
        <div className="re-card px-5 py-10 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
          No complaints found for this competitor.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {complaints.map((cp) => (
            <div
              key={cp.id}
              className="re-card"
              style={{ padding: "12px 14px", borderLeft: "3px solid var(--neg)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="font-mono-feat tnum mt-0.5 shrink-0"
                  style={{ fontSize: 11, color: "var(--neg)", minWidth: 22 }}
                >
                  {cp.mentions}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", lineHeight: 1.4 }}>
                    {cp.title}
                  </div>
                  {cp.summary && (
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                      {cp.summary}
                    </p>
                  )}
                  {cp.tag && (
                    <div className="mt-2">
                      <span className="re-chip" style={{ fontSize: 10 }}>{cp.tag}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Opportunities */}
      {opportunities.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>
            OPPORTUNITIES{" "}
            <span className="font-mono-feat text-fg-faint">({opportunities.length})</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map((opp, i) => (
              <OppCard key={opp.id ?? i} opp={opp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OppCard({ opp }: { opp: Opportunity }) {
  return (
    <div
      className="re-card"
      style={{ padding: "13px 15px", borderTop: "2px solid var(--pos)" }}
    >
      <div className="re-eyebrow" style={{ fontSize: 9, color: "var(--pos)", marginBottom: 6 }}>
        OPPORTUNITY
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", lineHeight: 1.4 }}>
        {opp.title}
      </div>
      {opp.thesis && (
        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--fg-muted)", lineHeight: 1.55 }}>
          {opp.thesis}
        </p>
      )}
      {(opp.effort || opp.payoff) && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {opp.effort && <span className="re-chip" style={{ fontSize: 10 }}>Effort: {opp.effort}</span>}
          {opp.payoff && <span className="re-chip re-chip-pos" style={{ fontSize: 10 }}>Payoff: {opp.payoff}</span>}
        </div>
      )}
    </div>
  );
}
