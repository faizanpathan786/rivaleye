import pino from "pino";
import { db } from "../db";
import { pipeline_events } from "../../../api/src/db/schema/pipeline-events.js";

const log = pino({ name: "pipeline-events" });

export type EmitInput = {
  reportId: string;
  platform?: string | null;
  stage: string;
  event: "started" | "completed" | "failed" | "retrying";
  attempt?: number;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
};

export async function emit(input: EmitInput): Promise<void> {
  const row = {
    report_id: input.reportId,
    platform: input.platform ?? null,
    stage: input.stage,
    event: input.event,
    attempt: input.attempt ?? 1,
    duration_ms: input.durationMs ?? null,
    error: input.error ?? null,
    metadata: input.metadata ?? null,
  };
  await db.insert(pipeline_events).values(row);
  log.info(row, "pipeline_event");
}
