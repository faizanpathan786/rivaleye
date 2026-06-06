import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBalance,
  getCreditPacks,
  getTransactions,
  createOrder,
  verifyPayment,
} from "@/api/billing";

export const billingKeys = {
  balance: ["billing", "balance"] as const,
  packs: ["billing", "packs"] as const,
  transactions: ["billing", "transactions"] as const,
};

export function useBalanceQuery() {
  return useQuery({
    queryKey: billingKeys.balance,
    queryFn: getBalance,
  });
}

export function useCreditPacksQuery() {
  return useQuery({
    queryKey: billingKeys.packs,
    queryFn: getCreditPacks,
  });
}

export function useTransactionsQuery() {
  return useQuery({
    queryKey: billingKeys.transactions,
    queryFn: getTransactions,
  });
}

export function useCreateOrderMutation() {
  return useMutation({ mutationFn: createOrder });
}

export function useVerifyPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: verifyPayment,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billingKeys.balance });
      void qc.invalidateQueries({ queryKey: billingKeys.transactions });
    },
  });
}
