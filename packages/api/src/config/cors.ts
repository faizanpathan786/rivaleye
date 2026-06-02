import { cors } from "@elysiajs/cors";

const defaultOrigins = process.env.NODE_ENV === "production"
  ? []
  : ["http://localhost:3001", "http://localhost:4004", "http://localhost:4005", "http://localhost:4006"];
const envOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [...defaultOrigins, ...envOrigins];

export const corsPlugin = cors({
  origin: (request) =>
    allowedOrigins.includes(request.headers.get("Origin") ?? ""),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  credentials: true,
});
