import type { Logger } from "pino";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { worker_heartbeats } from "../../../api/src/db/schema/ops.js";
import { inFlightCount } from "./shutdown";

const HEARTBEAT_INTERVAL_MS = Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? 10_000);

/**
 * Upsert this worker's heartbeat every ~10s so /health and /metrics can tell a
 * live-but-idle worker from a dead one by heartbeat age (rather than inferring
 * liveness from job activity, which false-positives under a quiet queue). One
 * row per worker_id; role is 'scrape' or 'synth'.
 */
export async function runHeartbeatLoop(workerId: string, role: string, log: Logger): Promise<void> {
  const beat = async (): Promise<void> => {
    await db
      .insert(worker_heartbeats)
      .values({ worker_id: workerId, role, last_seen_at: sql`now()`, in_flight: inFlightCount(), updated_at: sql`now()` })
      .onConflictDoUpdate({
        target: worker_heartbeats.worker_id,
        set: { role, last_seen_at: sql`now()`, in_flight: inFlightCount(), updated_at: sql`now()` },
      });
  };

  while (true) {
    try {
      await beat();
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : String(err) }, "heartbeat upsert failed");
    }
    await new Promise((r) => setTimeout(r, HEARTBEAT_INTERVAL_MS));
  }
}
