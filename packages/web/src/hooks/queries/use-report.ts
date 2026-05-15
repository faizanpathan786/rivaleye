import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useReport(id: string) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: () => api.reports.get(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000;
    },
  });
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => api.reports.list(),
  });
}
