import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCreateReport() {
  return useMutation({
    mutationFn: (input: Parameters<typeof api.reports.create>[0]) =>
      api.reports.create(input),
  });
}
