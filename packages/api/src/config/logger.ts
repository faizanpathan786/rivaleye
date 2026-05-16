import { logger } from "@bogeychan/elysia-logger";

export const loggerPlugin = logger({
  autoLogging: true,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      colorizeObjects: true,
      singleLine: true,
      translateTime: "UTC:yyyy-mm-dd HH:MM:ss.l o",
    },
  },
});
