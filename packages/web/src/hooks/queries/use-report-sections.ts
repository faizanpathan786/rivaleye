import { useQuery } from "@tanstack/react-query";
import { getReportSections } from "@/api/report-sections";
import type { Sections } from "@/api/report-sections";

export function useReportSectionsQuery(id: string | undefined) {
  return useQuery<Sections>({
    queryKey: ["reports", "sections", id],
    queryFn: () => getReportSections(id as string),
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 min - reasonable cache for completed reports
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache
    refetchOnWindowFocus: false,
  });
}
