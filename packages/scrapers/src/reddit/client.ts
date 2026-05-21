import axios, { type AxiosInstance } from "axios";
import pino from "pino";
import { type RedditAuthConfig, getAccessToken } from "./auth";
import { RateLimiter } from "./rate-limiter";
import { ScraperError } from "../types";

const log = pino({ name: "reddit-client" });
const limiter = new RateLimiter(55);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function redditGet<T>(
  path: string,
  params: Record<string, string | number>,
  config: RedditAuthConfig,
): Promise<T> {
  const token = await getAccessToken(config);
  await limiter.acquire();

  const instance: AxiosInstance = axios.create({
    baseURL: "https://oauth.reddit.com",
    timeout: 15_000,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": config.userAgent,
    },
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    log.debug({ path, params, attempt }, "Reddit API GET");
    try {
      const resp = await instance.get<T>(path, { params });
      log.debug({ path, attempt, durationMs: Date.now() - t0, status: resp.status }, "Reddit API GET success");
      return resp.data;
    } catch (err) {
      lastError = err;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          const retryAfter = Number(err.response?.headers["retry-after"] ?? 60);
          log.warn({ path, attempt, retryAfter }, "Reddit API 429 rate-limited; waiting");
          await sleep(retryAfter * 1000);
          await limiter.acquire();
          continue;
        }
        if (err.response && err.response.status < 500) {
          log.error({ path, attempt, status, durationMs: Date.now() - t0 }, "Reddit API non-retryable error");
          break;
        }
      }
      log.warn({ path, attempt, durationMs: Date.now() - t0, err: err instanceof Error ? err.message : String(err) }, "Reddit API GET failed; retrying");
      if (attempt < 2) await sleep(1000 * 2 ** attempt);
    }
  }
  throw new ScraperError("reddit", `GET ${path} failed`, lastError);
}
