export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

export class RateLimitError extends TransientError {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = "RateLimitError";
  }
}
