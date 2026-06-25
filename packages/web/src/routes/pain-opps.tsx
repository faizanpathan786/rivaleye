import { useState } from "react";
import { Zap } from "lucide-react";
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
    <div className="px-4 py-8 md:px-8" style={{ maxWidth: "100%" }}>
      {/* Page header */}
      <div style={{ marginBottom: 26 }}>
        <div className="re-eyebrow flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--neg)" }}>
          <Zap size={12} /> Pain &amp; opportunities
        </div>
        <h1 className="re-h1" style={{ fontSize: "clamp(21px,4vw,28px)", marginTop: 8, letterSpacing: "-0.02em" }}>
          What competitors&rsquo; users complain about
        </h1>
        <p style={{ fontSize: 13.5, color: "var(--fg-muted)", marginTop: 6, maxWidth: 580, lineHeight: 1.5 }}>
          Pick a competitor to see what frustrates their users — and the openings where you can win them over.
        </p>
      </div>

      {/* Competitor selector */}
      {reportsLoading && completed.length === 0 ? (
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
              isLoading={isLoading && !complaints.length && !opportunities.length}
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
    <div className="flex flex-wrap gap-2.5" style={{ marginBottom: 30 }}>
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
              fontWeight: isSelected ? 600 : 400,
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
      {/* Summary bar */}
      <div className="re-card flex items-center gap-4 flex-wrap" style={{ padding: "13px 16px", marginBottom: 28 }}>
        <CompetitorAvatar name={name} domain={report.primary_competitor_domain ?? ""} size={36} borderRadius={9} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{name}</div>
          {report.primary_competitor_domain && (
            <div className="font-mono-feat" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
              {report.primary_competitor_domain}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <span className="re-chip re-chip-neg" style={{ fontSize: 11 }}>{complaints.length} complaints</span>
          <span className="re-chip re-chip-pos" style={{ fontSize: 11 }}>{opportunities.length} opportunities</span>
        </div>
      </div>

      {/* Complaints — what's wrong */}
      <div style={{ marginBottom: 14 }}>
        <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--neg)" }}>Pain</div>
        <h2 className="re-h2" style={{ fontSize: 18, marginTop: 6 }}>What users complain about</h2>
      </div>

      {complaints.length === 0 ? (
        <div className="re-card px-5 py-10 text-center" style={{ color: "var(--fg-faint)", fontSize: 13 }}>
          No complaints found for this competitor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
          {complaints.map((cp) => (
            <ComplaintCard key={cp.id} complaint={cp} />
          ))}
        </div>
      )}

      {/* Opportunities — how to win */}
      {opportunities.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div className="re-eyebrow" style={{ fontSize: 11, color: "var(--pos)" }}>Opportunities</div>
          <h2 className="re-h2" style={{ fontSize: 18, marginTop: 6, marginBottom: 16 }}>Where you can win</h2>
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

function ComplaintCard({ complaint: cp }: { complaint: Complaint }) {
  return (
    <div className="re-card" style={{ padding: "14px 16px" }}>
      <div className="flex items-center gap-2.5" style={{ marginBottom: 9 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--neg)", flexShrink: 0 }} />
        {cp.tag && <span className="re-chip" style={{ fontSize: 11, textTransform: "capitalize" }}>{cp.tag}</span>}
      </div>
      <div className="break-words" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", lineHeight: 1.35 }}>
        {cp.title}
      </div>
      {cp.summary && (
        <p className="break-words" style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.5 }}>
          {cp.summary}
        </p>
      )}
      {cp.sample && (
        <p className="break-words" style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--fg)", lineHeight: 1.5, fontStyle: "italic" }}>
          “{cp.sample}”{cp.sample_author && <span className="font-mono-feat not-italic" style={{ color: "var(--fg-faint)", fontSize: 11 }}> — {cp.sample_author}</span>}
        </p>
      )}
    </div>
  );
}

function OppCard({ opp }: { opp: Opportunity }) {
  return (
    <div className="re-card" style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
      <span className="font-mono-feat" style={{ fontSize: 11, fontWeight: 700, color: "var(--pos)", letterSpacing: "0.02em", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--pos)" }} />
        Opportunity
      </span>
      <div className="break-words" style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", lineHeight: 1.35 }}>
        {opp.title}
      </div>
      {opp.thesis && (
        <p className="break-words" style={{ margin: 0, fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.55 }}>
          {opp.thesis}
        </p>
      )}
      {(opp.effort || opp.payoff) && (
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: "auto", paddingTop: 4 }}>
          {opp.payoff && <span className="re-chip re-chip-pos" style={{ fontSize: 11, textTransform: "capitalize" }}>{opp.payoff} payoff</span>}
          {opp.effort && <span className="re-chip" style={{ fontSize: 11, textTransform: "capitalize" }}>{opp.effort} effort</span>}
        </div>
      )}
    </div>
  );
}
