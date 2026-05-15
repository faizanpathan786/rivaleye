import pino from "pino";

export const logger =
  process.env["NODE_ENV"] !== "production"
    ? pino({ level: "info", transport: { target: "pino-pretty", options: { colorize: true } } })
    : pino({ level: "warn" });
