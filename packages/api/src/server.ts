import { Elysia } from "elysia";
import { corsPlugin } from "./config/cors";
import { helmetPlugin } from "./config/helmet";
import { loggerPlugin } from "./config/logger";
import { swaggerPlugin } from "./config/swagger";
import { and, eq, lte, min, sql } from "drizzle-orm";
import { controllers } from "./controllers";
import { auth } from "./libs/auth";
import { db } from "./db/client";
import { report_platform_jobs, synthesis_jobs } from "./db/schema/pipeline";

const port = Number(process.env.PORT ?? 4000);

// A queued job older than this with no worker having picked it up means the
// worker process is dead, not just backlogged.
const QUEUE_STALLED_THRESHOLD_SECONDS = 15 * 60;

async function getOldestQueuedSeconds(): Promise<number | null> {
  const [platformRows, synthesisRows] = await Promise.all([
    db
      .select({ oldest: min(report_platform_jobs.created_at) })
      .from(report_platform_jobs)
      .where(
        and(
          eq(report_platform_jobs.status, "queued"),
          lte(report_platform_jobs.run_after, sql`now()`),
        ),
      ),
    db
      .select({ oldest: min(synthesis_jobs.created_at) })
      .from(synthesis_jobs)
      .where(
        and(
          eq(synthesis_jobs.status, "queued"),
          lte(synthesis_jobs.run_after, sql`now()`),
        ),
      ),
  ]);

  const oldestDates = [platformRows[0]?.oldest, synthesisRows[0]?.oldest].filter(
    (d): d is NonNullable<typeof d> => d !== null && d !== undefined,
  );

  if (oldestDates.length === 0) return null;

  const oldestMs = Math.min(...oldestDates.map((d) => new Date(d).getTime()));
  return Math.floor((Date.now() - oldestMs) / 1000);
}

export const app = new Elysia()
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
    try {
      oldest_queued_seconds = await getOldestQueuedSeconds();
      queue =
        oldest_queued_seconds !== null && oldest_queued_seconds > QUEUE_STALLED_THRESHOLD_SECONDS
          ? "stalled"
          : "ok";
    } catch {
      queue = "unknown";
      oldest_queued_seconds = null;
    }

    return { ok: true, db: "up", queue, oldest_queued_seconds };
  })
  .use(controllers)
  .listen(port);

console.log(`RivalEye API listening on ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
