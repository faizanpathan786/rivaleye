import { useQuery } from "@tanstack/react-query";
import { getReportSections } from "@/api/report-sections";
import type { Sections } from "@/api/report-sections";

export function useReportSectionsQuery(id: string | undefined) {
  return useQuery<Sections>({
    queryKey: ["reports", "sections", id],
    queryFn: () => getReportSections(id as string),
    enabled: !!id,
    retry: 0,
    staleTime: 10 * 60 * 1000, // 10 min - keep cached data fresh
    gcTime: 60 * 60 * 1000, // 1 hour - keep in cache
    refetchOnWindowFocus: false,
  });
}
