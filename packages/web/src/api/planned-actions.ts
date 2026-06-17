import axios, { endpoints } from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiList, ApiSuccess } from "./_envelope";

export type PlannedAction = {
  id: string;
  owner_id: string;
  report_id: string;
  title: string;
  description: string | null;
  role: string | null;
  effort: string | null;
  created_at: string;
};

export type AddPlannedActionPayload = {
  report_id: string;
  title: string;
  description?: string;
  role?: string;
  effort?: string;
};

export async function listPlannedActions(): Promise<PlannedAction[]> {
  const res = await axios.get<ApiList<PlannedAction>>(endpoints.plannedActions.list);
  return unwrapList(res).items;
}

export async function addPlannedAction(
  payload: AddPlannedActionPayload,
): Promise<PlannedAction> {
  const res = await axios.post<ApiSuccess<PlannedAction>>(
    endpoints.plannedActions.add,
    payload,
  );
  return unwrap(res);
}

export async function removePlannedAction(id: string): Promise<void> {
  await axios.delete(endpoints.plannedActions.remove(id));
}
