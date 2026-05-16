import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/api/dashboard";
import type { DashboardData } from "@/api/dashboard";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  detail: () => [...dashboardKeys.all, "detail"] as const,
};

export function useDashboardQuery() {
  return useQuery<DashboardData>({
    queryKey: dashboardKeys.detail(),
    queryFn: getDashboard,
  });
}
