import { describe, expect, it } from "vitest";
import { applyScanStart } from "./credits";

describe("applyScanStart", () => {
  it("consumes the free scan without touching the balance", () => {
    expect(applyScanStart({ balance: 2, free_scan_used: false })).toEqual({
      balance: 2,
      free_scan_used: true,
    });
  });

  it("debits one credit when the free scan is already used", () => {
    expect(applyScanStart({ balance: 5, free_scan_used: true })).toEqual({
      balance: 4,
      free_scan_used: true,
    });
  });

  it("never drops the balance below zero", () => {
    expect(applyScanStart({ balance: 0, free_scan_used: true })).toEqual({
      balance: 0,
      free_scan_used: true,
    });
  });
});
