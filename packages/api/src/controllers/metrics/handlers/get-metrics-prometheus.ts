import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { formatPrometheus, getMetricsSnapshot } from "@/services/metrics.service";
import { requireMetricsAuth } from "../metrics-auth";

export const getMetricsPrometheusHandler = new Elysia()
  .use(loggerPlugin)
  .get(
    "/prometheus",
    async ({ headers, status, log, set }) => {
      const unauthorized = requireMetricsAuth(headers.authorization);
      if (unauthorized) return status(401, unauthorized);

      try {
        const snapshot = await getMetricsSnapshot();
        set.headers["content-type"] = "text/plain; version=0.0.4";
        return formatPrometheus(snapshot);
      } catch (e) {
        log.error(e);
        return status(500, e instanceof Error ? e.message : String(e));
      }
    },
    {
      detail: { tags: ["Metrics"], summary: "Prometheus exposition format of key gauges" },
    },
  );
