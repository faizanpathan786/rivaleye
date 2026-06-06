import { useQuery } from "@tanstack/react-query";
import { getReportSections } from "@/api/report-sections";
import type { Sections } from "@/api/report-sections";

export function useReportSectionsQuery(id: string | undefined) {
  return useQuery<Sections>({
    queryKey: ["reports", "sections", id],
    queryFn: () => getReportSections(id as string),
    enabled: !!id,
    retry: 3,
    retryDelay: 1000,
    staleTime: 30000,
    // Keep polling every 5s when role sections haven't arrived yet (LLM may
    // still be running). Stop once at least one role section is non-null.
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 5000;
      const hasAnySections = d.founder ?? d.product ?? d.marketing ?? d.growth ?? d.summary;
      return hasAnySections ? false : 5000;
    },
    refetchIntervalInBackground: false,
  });
}
