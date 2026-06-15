import { cors } from "@elysiajs/cors";

const defaultOrigins = process.env.NODE_ENV === "production"
  ? []
  : ["http://localhost:3001", "http://localhost:4004", "http://localhost:4005", "http://localhost:4006"];
const envOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [...defaultOrigins, ...envOrigins];

// In production the allow-list comes entirely from CORS_ORIGINS. If it's unset,
// every cross-origin browser request is rejected — the web app silently can't
// reach the API. Warn loudly at boot rather than fail mysteriously at runtime.
if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.warn(
    "[cors] WARNING: NODE_ENV=production but CORS_ORIGINS is empty — all cross-origin requests will be blocked. Set CORS_ORIGINS to your web origin(s).",
  );
}

export const corsPlugin = cors({
  origin: (request) =>
    allowedOrigins.includes(request.headers.get("Origin") ?? ""),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  credentials: true,
});
