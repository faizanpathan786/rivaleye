import type { GenerateReportJob } from "../queue";

export async function handleGenerateReport(data: GenerateReportJob) {
  // TODO:
  // 1. Load report row + scraped posts for all platforms
  // 2. Cluster complaints via LLM
  // 3. Build PainReportOutput
  // 4. Update reports.status = 'completed', reports.output = result
  return { reportId: data.reportId, status: "completed" as const };
}
