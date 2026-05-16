import { describe, it, expect } from "vitest";
import { TransientError, PermanentError, RateLimitError } from "../errors";

describe("worker errors", () => {
  it("TransientError is an Error", () => {
    const e = new TransientError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("TransientError");
    expect(e.message).toBe("nope");
  });

  it("PermanentError is an Error", () => {
    const e = new PermanentError("bad input");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("PermanentError");
  });

  it("RateLimitError extends TransientError and carries retryAfterMs", () => {
    const e = new RateLimitError("slow down", 12_000);
    expect(e).toBeInstanceOf(TransientError);
    expect(e.retryAfterMs).toBe(12_000);
  });
});
