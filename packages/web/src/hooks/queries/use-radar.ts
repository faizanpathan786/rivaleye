import { useQuery } from "@tanstack/react-query";
import { getRadarEvent, listRadarEvents } from "@/api/radar";
import type { ListRadarEventsParams, RadarEvent } from "@/api/radar";

export const radarKeys = {
  all: ["radar"] as const,
  lists: () => [...radarKeys.all, "list"] as const,
  list: (params?: ListRadarEventsParams) =>
    [...radarKeys.lists(), params ?? {}] as const,
  details: () => [...radarKeys.all, "detail"] as const,
  detail: (id: string | undefined) =>
    [...radarKeys.details(), id ?? ""] as const,
};

export function useRadarEventsQuery(params?: ListRadarEventsParams) {
  return useQuery<RadarEvent[]>({
    queryKey: radarKeys.list(params),
    queryFn: () => listRadarEvents(params),
  });
}

export function useRadarEventQuery(id: string | undefined) {
  return useQuery<RadarEvent>({
    queryKey: radarKeys.detail(id),
    queryFn: () => getRadarEvent(id as string),
    enabled: !!id,
  });
}
