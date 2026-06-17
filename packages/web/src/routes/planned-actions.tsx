import { usePlannedActionsQuery, useRemovePlannedActionMutation } from "@/hooks/queries/use-planned-actions";
import { useReportsQuery } from "@/hooks/queries/use-reports";
import type { PlannedAction } from "@/api/planned-actions";
import { formatRelative } from "@/lib/format";

export function PlannedActionsPage() {
  const { data: plannedActions = [], isLoading } = usePlannedActionsQuery();
  const { data: reports = [] } = useReportsQuery();
  const { mutate: removeAction, isPending } = useRemovePlannedActionMutation();

  const getReportName = (reportId: string) => {
    const report = reports.find((r) => r.id === reportId);
    return report?.primary_competitor_name ?? report?.competitors?.[0] ?? "Unknown Report";
  };

  if (isLoading) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>LOADING</div>
        <div style={{ fontSize: 16 }}>Loading your planned actions…</div>
      </div>
    );
  }

  if (plannedActions.length === 0) {
    return (
      <div className="px-4 py-12 md:px-7" style={{ textAlign: "center", color: "var(--fg-muted)" }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 12 }}>MY PLAN</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>No planned actions yet</div>
        <div style={{ fontSize: 13 }}>
          Add recommended actions from scan reports to build your action plan.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 md:px-7">
      <div style={{ marginBottom: 32 }}>
        <div className="re-eyebrow" style={{ fontSize: 10, marginBottom: 16 }}>MY PLAN</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Planned Actions</h1>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", marginBottom: 24 }}>
          {plannedActions.length} {plannedActions.length === 1 ? "action" : "actions"} planned
        </p>

        <div style={{ display: "grid", gap: 16 }}>
          {plannedActions.map((action) => (
            <div
              key={action.id}
              className="re-card"
              style={{
                padding: 20,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 20,
                alignItems: "start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--fg-muted)",
                    marginBottom: 8,
                  }}
                >
                  From: {getReportName(action.report_id)}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {action.title}
                </h3>
                {action.description && (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--fg-muted)",
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {action.description}
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                  {action.role && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 4,
                        color: "var(--fg-muted)",
                      }}
                    >
                      Role: {action.role}
                    </span>
                  )}
                  {action.effort && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 4,
                        color: "var(--fg-muted)",
                      }}
                    >
                      Effort: {action.effort}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      color: "var(--fg-faint)",
                    }}
                  >
                    Added {formatRelative(action.created_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => removeAction(action.id)}
                disabled={isPending}
                className="re-btn re-btn-sm"
                style={{
                  whiteSpace: "nowrap",
                  background: "var(--surface-2)",
                  color: "var(--fg-muted)",
                  border: "1px solid var(--border-soft)",
                  padding: "8px 16px",
                }}
              >
                {isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
