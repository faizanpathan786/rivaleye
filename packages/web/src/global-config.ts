export const CONFIG = {
  serverUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
  auth: {
    redirectPath: "/dashboard",
    signInPath: "/signin",
  },
} as const;
