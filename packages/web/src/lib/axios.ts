import axios from "axios";
import type { AxiosRequestConfig } from "axios";
import { CONFIG } from "@/global-config";

const axiosInstance = axios.create({
  baseURL: CONFIG.serverUrl,
  withCredentials: true,
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(
      (error.response && error.response.data) || {
        message: "Network error",
        error: "NETWORK_ERROR",
      },
    ),
);

export default axiosInstance;

export const fetcher = async (
  args: string | [string, AxiosRequestConfig],
) => {
  const [url, config] = Array.isArray(args) ? args : [args];
  const res = await axiosInstance.get(url, { ...config });
  return res.data;
};

export const endpoints = {
  auth: {
    session: "/v1/auth/get-session",
    signIn: "/v1/auth/sign-in/email",
    signUp: "/v1/auth/sign-up/email",
    signOut: "/v1/auth/sign-out",
  },
  me: "/v1/me",
  dashboard: "/v1/dashboard",
  competitors: {
    list: "/v1/competitors",
    detail: (id: string) => `/v1/competitors/${id}`,
    events: (id: string) => `/v1/competitors/${id}/events`,
  },
  radar: {
    events: "/v1/radar/events",
    event: (id: string) => `/v1/radar/events/${id}`,
  },
  reports: {
    list: "/v1/reports",
    detail: (id: string) => `/v1/reports/${id}`,
    progress: (id: string) => `/v1/reports/${id}/progress`,
    complaints: (id: string) => `/v1/reports/${id}/complaints`,
    featureGaps: (id: string) => `/v1/reports/${id}/feature-gaps`,
    pricing: (id: string) => `/v1/reports/${id}/pricing`,
    switching: (id: string) => `/v1/reports/${id}/switching`,
    quotes: (id: string) => `/v1/reports/${id}/quotes`,
    voice: (id: string) => `/v1/reports/${id}/voice`,
    positioning: (id: string) => `/v1/reports/${id}/positioning`,
    actions: (id: string) => `/v1/reports/${id}/actions`,
    leads: (id: string) => `/v1/reports/${id}/leads`,
    opportunities: (id: string) => `/v1/reports/${id}/opportunities`,
    platforms: (id: string) => `/v1/reports/${id}/platforms`,
    subreddits: (id: string) => `/v1/reports/${id}/subreddits`,
    sentimentSeries: (id: string) => `/v1/reports/${id}/sentiment-series`,
    threads: (id: string) => `/v1/reports/${id}/threads`,
    thread: (id: string, threadId: string) =>
      `/v1/reports/${id}/threads/${threadId}`,
  },
};
