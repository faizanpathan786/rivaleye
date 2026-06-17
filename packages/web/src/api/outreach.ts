import axios, { endpoints } from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiList, ApiSuccess } from "./_envelope";

export type OutreachItem = {
  id: string;
  owner_id: string;
  report_id: string;
  title: string;
  pricing_issue: string | null;
  plan_limitation: string | null;
  team_size_hint: string | null;
  budget_sensitivity: string | null;
  alternative_interest: string | null;
  suggested_pricing_angle: string | null;
  source_url: string | null;
  created_at: string;
};

export type AddOutreachPayload = {
  report_id: string;
  title: string;
  pricing_issue?: string | null;
  plan_limitation?: string | null;
  team_size_hint?: string | null;
  budget_sensitivity?: string | null;
  alternative_interest?: string | null;
  suggested_pricing_angle?: string | null;
  source_url?: string | null;
};

export async function listOutreach(): Promise<OutreachItem[]> {
  const res = await axios.get<ApiList<OutreachItem>>(endpoints.outreach.list);
  return unwrapList(res).items;
}

export async function addOutreach(
  payload: AddOutreachPayload,
): Promise<OutreachItem> {
  const res = await axios.post<ApiSuccess<OutreachItem>>(
    endpoints.outreach.add,
    payload,
  );
  return unwrap(res);
}

export async function removeOutreach(id: string): Promise<void> {
  await axios.delete(endpoints.outreach.remove(id));
}
