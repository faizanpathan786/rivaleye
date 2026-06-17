import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addOutreach, listOutreach, removeOutreach } from "@/api/outreach";
import type { AddOutreachPayload, OutreachItem } from "@/api/outreach";

export const outreachKeys = {
  all: ["outreach"] as const,
  list: () => [...outreachKeys.all, "list"] as const,
};

export function useOutreachQuery() {
  return useQuery<OutreachItem[]>({
    queryKey: outreachKeys.list(),
    queryFn: listOutreach,
  });
}

export function useAddOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddOutreachPayload) => addOutreach(payload),
    onSuccess: () => {
      toast.success("Added to Outreach");
      qc.invalidateQueries({ queryKey: outreachKeys.list() });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to add to Outreach");
    },
  });
}

export function useRemoveOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeOutreach(id),
    onSuccess: () => {
      toast.success("Removed from Outreach");
      qc.invalidateQueries({ queryKey: outreachKeys.list() });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to remove from Outreach");
    },
  });
}
