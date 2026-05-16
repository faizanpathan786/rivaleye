import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function useReport(id: string) {
  const query = useQuery({
    queryKey: ["report", id],
    queryFn: () => api.reports.get(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (query.failureCount === 3) {
      toast.error("Having trouble connecting… still trying");
    }
  }, [query.failureCount]);

  return query;
}

export function useReports() {
  return useQuery({
    queryKey: ["reports"],
    queryFn: () => api.reports.list(),
  });
}
