import axios from "axios";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;
let inflight: Promise<string> | null = null;

export interface RedditAuthConfig {
  clientId: string;
  clientSecret: string;
  userAgent: string;
}

export async function getAccessToken(config: RedditAuthConfig): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt - 60_000 > now) {
    return cache.accessToken;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const resp = await axios.post<{ access_token: string; expires_in: number }>(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        auth: { username: config.clientId, password: config.clientSecret },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": config.userAgent,
        },
      },
    );
    cache = {
      accessToken: resp.data.access_token,
      expiresAt: Date.now() + resp.data.expires_in * 1000,
    };
    return cache.accessToken;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}
