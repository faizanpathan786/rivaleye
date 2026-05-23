import axios, { endpoints } from "@/lib/axios";
import { unwrap } from "./_envelope";
import type { ApiSuccess } from "./_envelope";

export type Sections = {
  overview: unknown | null;
  founder: unknown | null;
  product: unknown | null;
  marketing: unknown | null;
  growth: unknown | null;
  evidence: unknown | null;
};

export async function getReportSections(reportId: string): Promise<Sections> {
  const res = await axios.get<ApiSuccess<Sections>>(
    endpoints.reports.sections(reportId),
  );
  return unwrap(res);
}
