import { useQuery } from "@tanstack/react-query";
import { getReportSections } from "@/api/report-sections";
import type { Sections } from "@/api/report-sections";

export function useReportSectionsQuery(id: string | undefined) {
  return useQuery<Sections>({
    queryKey: ["reports", "sections", id],
    queryFn: () => getReportSections(id as string),
    enabled: !!id,
  });
}
