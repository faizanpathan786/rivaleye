import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompetitor,
  deleteCompetitor,
  getCompetitor,
  listCompetitorEvents,
  listCompetitors,
  updateCompetitor,
} from "@/api/competitors";
import type {
  Competitor,
  CreateCompetitorPayload,
  UpdateCompetitorPayload,
} from "@/api/competitors";
import type { RadarEvent } from "@/api/radar";

export const competitorsKeys = {
  all: ["competitors"] as const,
  lists: () => [...competitorsKeys.all, "list"] as const,
  list: () => [...competitorsKeys.lists()] as const,
  details: () => [...competitorsKeys.all, "detail"] as const,
  detail: (id: string | undefined) =>
    [...competitorsKeys.details(), id ?? ""] as const,
  events: (id: string | undefined) =>
    [...competitorsKeys.all, "events", id ?? ""] as const,
};

export function useCompetitorsQuery() {
  return useQuery<Competitor[]>({
    queryKey: competitorsKeys.list(),
    queryFn: listCompetitors,
  });
}

export function useCompetitorQuery(id: string | undefined) {
  return useQuery<Competitor>({
    queryKey: competitorsKeys.detail(id),
    queryFn: () => getCompetitor(id as string),
    enabled: !!id,
  });
}

export function useCompetitorEventsQuery(id: string | undefined) {
  return useQuery<RadarEvent[]>({
    queryKey: competitorsKeys.events(id),
    queryFn: () => listCompetitorEvents(id as string),
    enabled: !!id,
  });
}

export function useCreateCompetitorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompetitorPayload) => createCompetitor(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: competitorsKeys.lists() });
    },
  });
}

export function useUpdateCompetitorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateCompetitorPayload;
    }) => updateCompetitor(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: competitorsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: competitorsKeys.lists() });
    },
  });
}

export function useDeleteCompetitorMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompetitor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: competitorsKeys.lists() });
    },
  });
}
