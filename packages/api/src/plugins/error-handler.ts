import { randomUUID } from "node:crypto";
import { Elysia } from "elysia";
import { pino } from "pino";

const isProd = process.env.NODE_ENV === "production";

// Standalone logger: onError runs outside the per-request `derive` scope that
// elysia-logger decorates, so it can't rely on the request-scoped `log`.
const errorLogger = pino(
  isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true },
        },
      },
);

// Global safety net: every ~40 handlers already catch their own service
// errors and shape a response, but uncaught throws (DB errors bubbling past a
// missing try/catch, Elysia's own VALIDATION/NOT_FOUND/PARSE codes, etc.)
// must never reach the client as raw driver/stack text. Sanitize here; log
// the full error server-side with a correlation id so it can be traced.
export const errorHandlerPlugin = new Elysia({ name: "error-handler" }).onError(
  { as: "global" },
  ({ code, error, set, request }) => {
    const errorId = randomUUID();
    const path = (() => {
      try {
        return new URL(request.url).pathname;
      } catch {
        return undefined;
      }
    })();

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: {
          message: error instanceof Error ? error.message : "Validation failed",
          code: "VALIDATION",
          errorId,
        },
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: { message: "Not found", code: "NOT_FOUND", errorId },
      };
    }

    if (code === "PARSE") {
      set.status = 400;
      return {
        error: { message: "Malformed request body", code: "PARSE_ERROR", errorId },
      };
    }

    // INTERNAL_SERVER_ERROR, UNKNOWN, or any uncaught exception from a
    // service/handler — never leak the message (Postgres errors, Razorpay
    // errors, stack traces) to the client.
    errorLogger.error(
      {
        errorId,
        path,
        method: request.method,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "unhandled request error",
    );
    set.status = 500;
    return {
      error: { message: "Internal server error", code: "INTERNAL_ERROR", errorId },
    };
  },
);
