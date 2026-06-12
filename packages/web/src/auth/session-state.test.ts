import { describe, expect, it } from "vitest";
import { deriveAuthView } from "./session-state";

const jane = { id: "u1", name: "Jane" };

describe("deriveAuthView", () => {
  it("uses the resolved user and persists it", () => {
    expect(
      deriveAuthView({ isPending: false, user: jane, errorStatus: null }, null),
    ).toEqual({ user: jane, loading: false, hintAction: "write" });
  });

  it("trusts the hint while the session is still resolving", () => {
    expect(
      deriveAuthView({ isPending: true, user: null, errorStatus: null }, jane),
    ).toEqual({ user: jane, loading: false, hintAction: "keep" });
  });

  it("shows the loading splash only when resolving with no hint", () => {
    expect(
      deriveAuthView({ isPending: true, user: null, errorStatus: null }, null),
    ).toEqual({ user: null, loading: true, hintAction: "keep" });
  });

  it("clears the hint when the server definitively reports signed out", () => {
    expect(
      deriveAuthView({ isPending: false, user: null, errorStatus: null }, jane),
    ).toEqual({ user: null, loading: false, hintAction: "clear" });
  });

  it("clears the hint on a 401", () => {
    expect(
      deriveAuthView({ isPending: false, user: null, errorStatus: 401 }, jane),
    ).toEqual({ user: null, loading: false, hintAction: "clear" });
  });

  it("keeps the hint and stays signed in on a transient fetch failure", () => {
    expect(
      deriveAuthView({ isPending: false, user: null, errorStatus: 0 }, jane),
    ).toEqual({ user: jane, loading: false, hintAction: "keep" });
  });

  it("keeps the hint on server errors (5xx)", () => {
    expect(
      deriveAuthView({ isPending: false, user: null, errorStatus: 503 }, jane),
    ).toEqual({ user: jane, loading: false, hintAction: "keep" });
  });

  it("treats a transient failure with no hint as signed out without clearing", () => {
    expect(
      deriveAuthView({ isPending: false, user: null, errorStatus: 0 }, null),
    ).toEqual({ user: null, loading: false, hintAction: "keep" });
  });
});
