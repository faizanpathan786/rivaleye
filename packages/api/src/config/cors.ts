import { cors } from "@elysiajs/cors";

const defaultOrigins = ["http://localhost:5173", "http://localhost:5174"];
const envOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [...defaultOrigins, ...envOrigins];

export const corsPlugin = cors({
  origin: (request) =>
    allowedOrigins.includes(request.headers.get("Origin") ?? ""),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
});
