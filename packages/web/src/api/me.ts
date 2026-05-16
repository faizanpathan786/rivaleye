import axios, { endpoints } from "@/lib/axios";
import { unwrap } from "./_envelope";
import type { ApiSuccess } from "./_envelope";

export type Me = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  email_verified: boolean;
  created_at: string;
};

export type UpdateMePayload = {
  name?: string;
  image?: string;
};

export async function getMe(): Promise<Me> {
  const res = await axios.get<ApiSuccess<Me>>(endpoints.me);
  return unwrap(res);
}

export async function updateMe(payload: UpdateMePayload): Promise<Me> {
  const res = await axios.patch<ApiSuccess<Me>>(endpoints.me, payload);
  return unwrap(res);
}
