import axios, { type AxiosInstance, type AxiosError } from "axios";
import { RedditAuth } from "./auth.js";
import { RateLimiter } from "./rate-limiter.js";

const REDDIT_OAUTH_BASE = "https://oauth.reddit.com";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

export class RedditHttpClient {
  private readonly http: AxiosInstance;
  private readonly auth: RedditAuth;
  private readonly rateLimiter: RateLimiter;
  private readonly userAgent: string;

  constructor(auth: RedditAuth, userAgent: string, rateLimiter: RateLimiter) {
    this.auth = auth;
    this.userAgent = userAgent;
    this.rateLimiter = rateLimiter;

    this.http = axios.create({
      baseURL: REDDIT_OAUTH_BASE,
      timeout: 15_000,
      headers: { "User-Agent": userAgent },
    });
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await this.rateLimiter.acquire();
        const token = await this.auth.getAccessToken();

        const response = await this.http.get<T>(path, {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });

        return response.data;
      } catch (err) {
        const error = err as AxiosError;
        lastError = error;

        // Do not retry on client errors (4xx) except 429 (rate limited)
        if (error.response) {
          const status = error.response.status;

          if (status === 429) {
            // Respect Retry-After header if present
            const retryAfter = Number(error.response.headers["retry-after"] ?? 60);
            await sleep(retryAfter * 1000);
            continue;
          }

          if (status >= 400 && status < 500) {
            throw new RedditApiError(
              `Reddit API error ${status}: ${path}`,
              status,
              error,
            );
          }
        }

        // Exponential backoff for network errors / 5xx
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        }
      }
    }

    throw lastError ?? new Error(`Reddit request failed: ${path}`);
  }
}

export class RedditApiError extends Error {
  readonly statusCode: number;
  override readonly cause: Error;

  constructor(message: string, statusCode: number, cause: Error) {
    super(message);
    this.name = "RedditApiError";
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
