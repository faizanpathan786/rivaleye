import { logger } from "@bogeychan/elysia-logger";

const isProd = process.env.NODE_ENV === "production";

// In production emit structured JSON (one object per line) so log aggregators
// can parse it. pino-pretty (human-colored) is dev-only.
export const loggerPlugin = logger({
  autoLogging: true,
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            colorizeObjects: true,
            singleLine: true,
            translateTime: "UTC:yyyy-mm-dd HH:MM:ss.l o",
          },
        },
      }),
});
