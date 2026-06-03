import { useState } from "react";
import { useParams } from "react-router-dom";
import { useReportSectionsQuery } from "@/hooks/queries/use-report-sections";
import type { Sections } from "@/api/report-sections";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// ─────────────────────────────────────────────────────────────────────────
// SectionRenderer

function SectionRenderer({ data }: { data: unknown | null }) {
  if (data === null) {
    return (
      <p className="m-0 text-fg-faint" style={{ fontSize: 13 }}>
        Section not generated for this report.
      </p>
    );
  }

  return (
    <div className="overflow-auto rounded-md" style={{ maxHeight: 600, background: "var(--surface-2)" }}>
      <pre
        className="m-0 p-4"
        style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Tab types and config

type SectionKey = keyof Sections;

const SECTION_TABS: Array<[SectionKey, string]> = [
  ["overview", "Overview"],
  ["founder", "Founder"],
  ["product", "Product"],
  ["marketing", "Marketing"],
  ["growth", "Growth"],
  ["evidence", "Evidence"],
];

// ─────────────────────────────────────────────────────────────────────────
// ReportSectionsPage

export function ReportSectionsPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const query = useReportSectionsQuery(reportId);
  const [activeTab, setActiveTab] = useState<SectionKey>("overview");

  if (query.isLoading || (!query.data && !query.isError)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="mb-2 h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Alert variant="destructive">
          <AlertTitle>Could not load sections</AlertTitle>
          <AlertDescription>
            {(query.error as Error)?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sections = query.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6">
        <div className="re-eyebrow mb-1">SECTIONS · LIVE DATA</div>
        <h1 className="re-h1">Report Sections</h1>
        <p className="mt-1 break-words text-fg-muted" style={{ fontSize: 13 }}>
          Raw pipeline output for report <span className="font-mono-feat break-all">{reportId}</span>. Phase 5 MVP — data-flow proof.
        </p>
      </div>

      {/* Tab bar — mirrors report.tsx custom tab style */}
      <div
        className="flex flex-nowrap gap-1 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--bg)" }}
      >
        {SECTION_TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="relative shrink-0 cursor-pointer whitespace-nowrap border-0 bg-transparent py-3 pr-4 text-[13px]"
            style={{
              color: activeTab === key ? "var(--fg)" : "var(--fg-muted)",
              fontWeight: activeTab === key ? 500 : 400,
              borderBottom: activeTab === key ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Section body */}
      <div className="mt-6">
        {SECTION_TABS.map(([key]) => (
          activeTab === key && (
            <div key={key}>
              <SectionRenderer data={sections?.[key] ?? null} />
            </div>
          )
        ))}
      </div>
    </div>
  );
}
