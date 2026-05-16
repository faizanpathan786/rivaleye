import { useParams } from "react-router-dom";
import { useReportQuery } from "@/hooks/queries/use-reports";
import { ReportHeader } from "@/components/report/report-header";
import { AnswerHero } from "@/components/report/answer-hero";
import { ReportSkeleton } from "@/components/report/report-skeleton";
import { ReportErrorBoundary } from "@/components/report/report-error-boundary";
import { PainClustersSection } from "@/components/report/pain-clusters-section";
import { FeatureGapsSection } from "@/components/report/feature-gaps-section";
import { PricingPainSection } from "@/components/report/pricing-pain-section";
import { SwitchingSignalsSection } from "@/components/report/switching-signals-section";
import { VoiceOfCustomerSection } from "@/components/report/voice-of-customer-section";
import { PositioningAnglesSection } from "@/components/report/positioning-angles-section";
import { SourceEvidenceSection } from "@/components/report/source-evidence-section";
import { RecommendedActionsSection } from "@/components/report/recommended-actions-section";
import { ProductOpportunitiesSection } from "@/components/report/product-opportunities-section";
import { CompetitorWeaknessesSection } from "@/components/report/competitor-weaknesses-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const reportId = id ?? "";
  const query = useReportQuery(reportId);

  if (query.isLoading || !query.data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ReportSkeleton />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Alert variant="destructive">
          <AlertTitle>Could not load report</AlertTitle>
          <AlertDescription>
            {(query.error as Error)?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const report = query.data;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <ReportErrorBoundary>
        <ReportHeader report={report} />
        <AnswerHero report={report} />
        <PainClustersSection reportId={reportId} />
        <CompetitorWeaknessesSection reportId={reportId} />
        <FeatureGapsSection reportId={reportId} />
        <PricingPainSection reportId={reportId} />
        <SwitchingSignalsSection reportId={reportId} />
        <VoiceOfCustomerSection reportId={reportId} />
        <PositioningAnglesSection reportId={reportId} />
        <ProductOpportunitiesSection reportId={reportId} />
        <RecommendedActionsSection reportId={reportId} />
        <SourceEvidenceSection reportId={reportId} />
      </ReportErrorBoundary>
    </div>
  );
}
