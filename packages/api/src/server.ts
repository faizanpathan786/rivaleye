import { Elysia } from "elysia";
import { corsPlugin } from "./config/cors";
import { helmetPlugin } from "./config/helmet";
import { loggerPlugin } from "./config/logger";
import { swaggerPlugin } from "./config/swagger";
import { sql } from "drizzle-orm";
import { controllers } from "./controllers";
import { errorHandlerPlugin } from "./plugins/error-handler";
import { auth } from "./libs/auth";
import { db } from "./db/client";
import {
  getQueueMetrics,
  getWorkerMetrics,
  isQueueOrphaned,
  type JobTableMetrics,
  type QueueMetrics,
} from "./services/metrics.service";
import { startAlertLoop } from "./services/alerting.service";

const port = Number(process.env.PORT ?? 4000);

// A queued job older than this with no alive worker of the responsible role
// means the worker process is dead, not just backlogged.
const QUEUE_STALLED_THRESHOLD_SECONDS = 15 * 60;

export const app = new Elysia()
  .use(errorHandlerPlugin)
  .use(corsPlugin)
  .mount("/v1/auth", auth.handler)
  .use(swaggerPlugin)
  .use(helmetPlugin)
  // Readiness probe: confirm the process can actually reach Postgres, not just
  // that the HTTP server is up. Returns 503 when the DB is unreachable.
  .get("/health", async ({ status }) => {
    try {
      await db.execute(sql`select 1`);
    } catch {
      return status(503, { ok: false, db: "down" });
    }

    let queue: "ok" | "stalled" | "unknown" = "unknown";
    let oldest_queued_seconds: number | null = null;
    let stalled_queues: string[] = [];
    let workers: {
      total: number;
      alive_total: number;
      alive_by_role: Record<string, number>;
    } | null = null;

    try {
      const [queueMetrics, workerMetrics] = await Promise.all([
        getQueueMetrics(),
        getWorkerMetrics(),
      ]);

      const entries = Object.entries(queueMetrics) as [
        keyof QueueMetrics,
        JobTableMetrics,
      ][];

      const oldestValues = entries
        .map(([, metrics]) => metrics.oldest_queued_seconds)
        .filter((v): v is number => v !== null);
      oldest_queued_seconds = oldestValues.length > 0 ? Math.min(...oldestValues) : null;

      // Real dead-worker signal: a queue is only "stalled" when its backlog is
      // old AND zero workers of the role that would process it are alive —
      // replaces the old locked_at/completed_at activity inference, which
      // couldn't tell "dead worker" apart from "worker alive but backlogged".
      stalled_queues = entries
        .filter(([key, metrics]) =>
          isQueueOrphaned(key, metrics, workerMetrics, QUEUE_STALLED_THRESHOLD_SECONDS),
        )
        .map(([key]) => key);

      queue = stalled_queues.length > 0 ? "stalled" : "ok";

      workers = {
        total: workerMetrics.rows.length,
        alive_total: workerMetrics.rows.filter((r) => r.alive).length,
        alive_by_role: workerMetrics.alive_by_role,
      };
    } catch {
      queue = "unknown";
      oldest_queued_seconds = null;
      workers = null;
    }

    if (queue === "stalled") {
      return status(503, { ok: false, db: "up", queue, oldest_queued_seconds, stalled_queues, workers });
    }

    return { ok: true, db: "up", queue, oldest_queued_seconds, workers };
  })
  .use(controllers)
  .listen({ port, hostname: "0.0.0.0" });

console.log(`RivalEye API listening on ${app.server?.hostname}:${app.server?.port}`);

// Off by default so dev/test runs never send alerts.
if (process.env.ENABLE_ALERTS === "true") {
  startAlertLoop();
}

export type App = typeof app;
