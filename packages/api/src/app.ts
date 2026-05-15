import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyRateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { competitorRoutes } from "./routes/competitors.js";
import { mentionRoutes } from "./routes/mentions.js";
import { clusterRoutes } from "./routes/clusters.js";
import { leadRoutes } from "./routes/leads.js";
import { statsRoutes } from "./routes/stats.js";
import { jobRoutes } from "./routes/jobs.js";
import { reportRoutes } from "./routes/reports.js";
import { callLLM } from "@rivaleye/shared";

export async function buildApp() {
  const app = Fastify({
    logger: config.isDev
      ? { level: "info", transport: { target: "pino-pretty", options: { colorize: true } } }
      : { level: "warn" },
  });

  // ─── Plugins ─────────────────────────────────────────────────────────────

  await app.register(fastifyCors, {
    origin: config.isDev ? "http://localhost:3000" : (process.env["WEB_URL"] ?? "http://localhost:3000"),
    credentials: true,
  });

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: "access_token", signed: false },
  });

  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      success: false,
      error: "Too many requests",
      code: "RATE_LIMITED",
    }),
  });

  // ─── Global Error Handler ─────────────────────────────────────────────────

  app.setErrorHandler((error: { validation?: unknown; statusCode?: number; message: string; code?: string }, _request, reply) => {
    app.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: error.validation,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      success: false,
      error: statusCode === 500 ? "Internal server error" : error.message,
      code: error.code ?? "INTERNAL_ERROR",
    });
  });

  // ─── Health Check ─────────────────────────────────────────────────────────

  app.get("/health", async () => {
    try {
      const llmResponse = await callLLM("Say 'LLM is working' and nothing else.");
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        llm: {
          status: "working",
          provider: process.env["LLM_PROVIDER"] || "anthropic",
          response: llmResponse.content.trim(),
        },
      };
    } catch (error) {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        llm: {
          status: "error",
          provider: process.env["LLM_PROVIDER"] || "anthropic",
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  });

  // ─── OpenAI Health Check ──────────────────────────────────────────────────

  app.get("/openai-health", async () => {
    const apiKey = process.env["OPENAI_API_KEY"];
    const model = process.env["OPENAI_MODEL"] || "gpt-4o-mini";

    if (!apiKey) {
      return {
        status: "error",
        message: "OPENAI_API_KEY not set",
        provider: "openai",
        model,
      };
    }

    try {
      const start = Date.now();
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "test" }],
          max_tokens: 10,
        }),
      });
      const ms = Date.now() - start;

      if (!response.ok) {
        const error = await response.json();
        return {
          status: "error",
          message: "API request failed",
          provider: "openai",
          model,
          statusCode: response.status,
          error,
          responseTimeMs: ms,
        };
      }

      const data = (await response.json()) as any;
      return {
        status: "ok",
        message: "OpenAI API is working",
        provider: "openai",
        model,
        responseTimeMs: ms,
        tokensUsed: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        provider: "openai",
        model,
      };
    }
  });

  // ─── Routes ───────────────────────────────────────────────────────────────

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(workspaceRoutes, { prefix: "/api/workspaces" });
  await app.register(competitorRoutes, { prefix: "/api/competitors" });
  await app.register(mentionRoutes, { prefix: "/api/competitors" });
  await app.register(clusterRoutes, { prefix: "/api/competitors" });
  await app.register(leadRoutes, { prefix: "/api/competitors" });
  await app.register(statsRoutes, { prefix: "/api/competitors" });
  await app.register(jobRoutes, { prefix: "/api/competitors" });
  await app.register(reportRoutes, { prefix: "/api/competitors" });

  return app;
}
