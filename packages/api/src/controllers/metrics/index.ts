import { Elysia } from "elysia";
import { getMetricsHandler } from "./handlers/get-metrics";
import { getMetricsPrometheusHandler } from "./handlers/get-metrics-prometheus";

export const metricsController = new Elysia({ prefix: "/metrics", tags: ["Metrics"] })
  .use(getMetricsHandler)
  .use(getMetricsPrometheusHandler);
