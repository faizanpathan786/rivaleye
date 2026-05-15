import axios from "axios";
import type { RedditTokenResponse } from "./types.js";

interface TokenState {
  accessToken: string;
  expiresAt: number; // unix ms
}

export class RedditAuth {
  private tokenState: TokenState | null = null;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly userAgent: string,
  ) {}

  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.tokenState && Date.now() < this.tokenState.expiresAt - 60_000) {
      return this.tokenState.accessToken;
    }

    // Deduplicate concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.fetchNewToken().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async fetchNewToken(): Promise<string> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    const response = await axios.post<RedditTokenResponse>(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.userAgent,
        },
      },
    );

    const { access_token, expires_in } = response.data;

    this.tokenState = {
      accessToken: access_token,
      expiresAt: Date.now() + expires_in * 1000,
    };

    return access_token;
  }
}
