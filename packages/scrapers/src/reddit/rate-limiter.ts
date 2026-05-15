interface QueueEntry {
  resolve: () => void;
}

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;
  private queue: QueueEntry[] = [];
  private refillTimer: ReturnType<typeof setInterval> | null = null;

  constructor(tokensPerMinute = 55) {
    this.maxTokens = tokensPerMinute;
    this.tokens = tokensPerMinute;
    this.refillIntervalMs = 60_000 / tokensPerMinute;
  }

  private startRefill() {
    if (this.refillTimer) return;
    this.refillTimer = setInterval(() => {
      if (this.tokens < this.maxTokens) {
        this.tokens++;
        this.drain();
      }
    }, this.refillIntervalMs);
  }

  private drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens--;
      this.queue.shift()!.resolve();
    }
  }

  async acquire(): Promise<void> {
    this.startRefill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
    });
  }

  destroy() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }
}
