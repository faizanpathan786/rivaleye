import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMe, updateMe } from "@/api/me";
import type { Me, UpdateMePayload } from "@/api/me";

export const meKeys = {
  all: ["me"] as const,
  detail: () => [...meKeys.all, "detail"] as const,
};

export function useMeQuery() {
  return useQuery<Me>({
    queryKey: meKeys.detail(),
    queryFn: getMe,
  });
}

export function useUpdateMeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMePayload) => updateMe(payload),
    onSuccess: (data) => {
      qc.setQueryData(meKeys.detail(), data);
    },
  });
}
