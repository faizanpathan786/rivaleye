import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPlannedActions, addPlannedAction, removePlannedAction, type AddPlannedActionPayload } from "@/api/planned-actions";
import { toast } from "sonner";

export const plannedActionsKeys = {
  all: ["planned-actions"] as const,
  list: () => [...plannedActionsKeys.all, "list"] as const,
};

export function usePlannedActionsQuery() {
  return useQuery({
    queryKey: plannedActionsKeys.list(),
    queryFn: listPlannedActions,
    staleTime: 60000,
  });
}

export function useAddPlannedActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addPlannedAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plannedActionsKeys.list() });
      toast.success("Added to plan");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add to plan");
    },
  });
}

export function useRemovePlannedActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removePlannedAction,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plannedActionsKeys.list() });
      toast.success("Removed from plan");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to remove from plan");
    },
  });
}
