import { Elysia } from "elysia";
import { loggerPlugin } from "@/config/logger";
import { getMetricsSnapshot } from "@/services/metrics.service";
import { requireMetricsAuth } from "../metrics-auth";

// Unauthenticated by default (aggregate counts only, no secrets/PII). If
// METRICS_TOKEN is set, requires `Authorization: Bearer <token>` instead of
// the normal user session — this is an ops/monitoring endpoint scraped by
// infra tooling, not a user-facing resource, so it intentionally sits outside
// authPlugin (same precedent as the Razorpay webhook and /health).
export const getMetricsHandler = new Elysia()
  .use(loggerPlugin)
  .get(
    "/",
    async ({ headers, status, log }) => {
      const unauthorized = requireMetricsAuth(headers.authorization);
      if (unauthorized) return status(401, unauthorized);

      try {
        const snapshot = await getMetricsSnapshot();
        return snapshot;
      } catch (e) {
        log.error(e);
        return status(500, {
          message: "Failed to compute metrics",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
    {
      detail: { tags: ["Metrics"], summary: "Aggregate queue/worker/LLM/report metrics" },
    },
  );
