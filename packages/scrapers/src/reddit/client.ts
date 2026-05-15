import axios, { type AxiosInstance } from "axios";
import { type RedditAuthConfig, getAccessToken } from "./auth";
import { RateLimiter } from "./rate-limiter";
import { ScraperError } from "../types";

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
    try {
      const resp = await instance.get<T>(path, { params });
      return resp.data;
    } catch (err) {
      lastError = err;
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          const retryAfter = Number(err.response.headers["retry-after"] ?? 60);
          await sleep(retryAfter * 1000);
          await limiter.acquire();
          continue;
        }
        if (err.response && err.response.status < 500) break;
      }
      if (attempt < 2) await sleep(1000 * 2 ** attempt);
    }
  }
  throw new ScraperError("reddit", `GET ${path} failed`, lastError);
}
