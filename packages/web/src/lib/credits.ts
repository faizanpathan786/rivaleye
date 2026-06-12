import type { Balance } from "@/api/billing";

// Mirrors the server's consumeCreditForScan: the free scan is burned first,
// after that each scan debits one credit.
export function applyScanStart(balance: Balance): Balance {
  if (!balance.free_scan_used) {
    return { ...balance, free_scan_used: true };
  }
  return { ...balance, balance: Math.max(0, balance.balance - 1) };
}
