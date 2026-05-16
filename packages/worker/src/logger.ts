import { db } from "./db";
import { report_logs } from "../../api/src/db/schema/logs.js";

export type LogLevel = "info" | "warn" | "error";

export async function log(
  reportId: string,
  level: LogLevel,
  stage: string | null,
  platform: string | null,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const line = [
    `[${level.toUpperCase()}]`,
    stage ? `stage=${stage}` : null,
    platform ? `platform=${platform}` : null,
    `reportId=${reportId}`,
    message,
    meta ? JSON.stringify(meta) : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  try {
    await db.insert(report_logs).values({
      report_id: reportId,
      level,
      stage: stage ?? undefined,
      platform: platform ?? undefined,
      message,
      meta: meta ?? undefined,
    });
  } catch (err) {
    console.error("[logger] failed to persist log entry:", err);
  }
}
