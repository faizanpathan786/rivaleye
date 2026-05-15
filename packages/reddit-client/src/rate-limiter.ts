/**
 * Token bucket rate limiter for Reddit API (60 req/min).
 * Each call to `acquire()` waits until a token is available.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxTokens: number = 55, // slightly under 60 for safety
    private readonly refillRateMs: number = 60_000,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Queue the request until a token is available
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.refillRateMs) {
      const cycles = Math.floor(elapsed / this.refillRateMs);
      this.tokens = Math.min(this.maxTokens, this.tokens + cycles * this.maxTokens);
      this.lastRefill = now - (elapsed % this.refillRateMs);

      // Drain queue with newly available tokens
      while (this.queue.length > 0 && this.tokens > 0) {
        this.tokens--;
        const resolve = this.queue.shift();
        resolve?.();
      }
    }
  }

  /** Schedule periodic refill checks for queued requests */
  startDrainLoop(): NodeJS.Timeout {
    return setInterval(() => this.refill(), 1_000);
  }
}
