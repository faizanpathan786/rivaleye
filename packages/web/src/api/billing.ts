import axios from "@/lib/axios";
import { unwrap, unwrapList } from "./_envelope";
import type { ApiSuccess, ApiList } from "./_envelope";

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  price_paise: number;
  active: boolean;
  created_at: string;
};

export type Balance = {
  balance: number;
  free_scan_used: boolean;
};

export type CreditTransaction = {
  id: string;
  user_id: string;
  type: "purchase" | "debit";
  amount: number;
  pack_id: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  description: string;
  created_at: string;
};

export type OrderResponse = {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
};

export async function getBalance(): Promise<Balance> {
  const res = await axios.get<ApiSuccess<Balance>>("/v1/billing/balance");
  return unwrap(res);
}

export async function getCreditPacks(): Promise<CreditPack[]> {
  const res = await axios.get<ApiList<CreditPack>>("/v1/billing/packs");
  return unwrapList(res).items;
}

export async function createOrder(pack_id: string): Promise<OrderResponse> {
  const res = await axios.post<ApiSuccess<OrderResponse>>("/v1/billing/orders", { pack_id });
  return unwrap(res);
}

export async function verifyPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ balance: number }> {
  const res = await axios.post<ApiSuccess<{ balance: number }>>("/v1/billing/verify", payload);
  return unwrap(res);
}

export async function getTransactions(): Promise<CreditTransaction[]> {
  const res = await axios.get<ApiList<CreditTransaction>>("/v1/billing/transactions");
  return unwrapList(res).items;
}
