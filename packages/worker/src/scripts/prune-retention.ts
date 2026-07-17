/**
 * Retention pruning job. Bounds unbounded-growth tables by deleting rows past
 * an env-configurable age threshold. Intended to run on a schedule (cron / pm2
 * cron), NOT continuously — invoke once per run:
 *
 *   bun --env-file=../../.env src/scripts/prune-retention.ts
 *
 * Idempotent and safe to re-run: each invocation only deletes rows that are
 * already past their threshold, in bounded batches to avoid long table locks.
 *
 * DO NOT run this against a database you care about without first confirming
 * the thresholds below — it deletes rows permanently, no soft-delete.
 */

import { and, lt, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import pino from "pino";
import { db } from "../db";
import { report_logs } from "../../../api/src/db/schema/logs.js";
import { pipeline_events } from "../../../api/src/db/schema/pipeline-events.js";
import { report_pdf_jobs } from "../../../api/src/db/schema/pipeline.js";
import { llm_usage } from "../../../api/src/db/schema/ops.js";

const log = pino({ name: "prune-retention" });

const RETENTION_LOGS_DAYS = Number(process.env.RETENTION_LOGS_DAYS ?? 30);
const RETENTION_EVENTS_DAYS = Number(process.env.RETENTION_EVENTS_DAYS ?? 30);
const RETENTION_PDF_DAYS = Number(process.env.RETENTION_PDF_DAYS ?? 7);
const RETENTION_LLM_USAGE_DAYS = Number(process.env.RETENTION_LLM_USAGE_DAYS ?? 90);

const BATCH_SIZE = 5000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function pruneInBatches(params: {
  label: string;
  table: PgTable;
  idColumn: AnyPgColumn;
  extraWhere: SQL;
}): Promise<number> {
  const { label, table, idColumn, extraWhere } = params;
  let totalDeleted = 0;

  while (true) {
    const victims = await db
      .select({ id: idColumn })
      .from(table)
      .where(extraWhere)
      .limit(BATCH_SIZE);

    if (victims.length === 0) break;

    const ids = victims.map((v) => v.id as string | number);
    await db.delete(table).where(inArray(idColumn, ids));
    totalDeleted += ids.length;

    log.info({ table: label, batchDeleted: ids.length, totalDeleted }, "pruned batch");

    if (victims.length < BATCH_SIZE) break;
  }

  return totalDeleted;
}

async function main() {
  log.info(
    {
      RETENTION_LOGS_DAYS,
      RETENTION_EVENTS_DAYS,
      RETENTION_PDF_DAYS,
      RETENTION_LLM_USAGE_DAYS,
    },
    "starting retention prune",
  );

  const logsDeleted = await pruneInBatches({
    label: "report_logs",
    table: report_logs,
    idColumn: report_logs.id,
    extraWhere: lt(report_logs.created_at, daysAgo(RETENTION_LOGS_DAYS)),
  });

  const eventsDeleted = await pruneInBatches({
    label: "pipeline_events",
    table: pipeline_events,
    idColumn: pipeline_events.id,
    extraWhere: lt(pipeline_events.created_at, daysAgo(RETENTION_EVENTS_DAYS)),
  });

  const pdfJobsDeleted = await pruneInBatches({
    label: "report_pdf_jobs",
    table: report_pdf_jobs,
    idColumn: report_pdf_jobs.id,
    extraWhere: and(
      lt(report_pdf_jobs.created_at, daysAgo(RETENTION_PDF_DAYS)),
      sql`${report_pdf_jobs.status} IN ('completed', 'failed')`,
    )!,
  });

  const llmUsageDeleted = await pruneInBatches({
    label: "llm_usage",
    table: llm_usage,
    idColumn: llm_usage.id,
    extraWhere: lt(llm_usage.created_at, daysAgo(RETENTION_LLM_USAGE_DAYS)),
  });

  log.info(
    {
      report_logs: logsDeleted,
      pipeline_events: eventsDeleted,
      report_pdf_jobs: pdfJobsDeleted,
      llm_usage: llmUsageDeleted,
    },
    "retention prune complete",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    log.error({ err }, "retention prune failed");
    process.exit(1);
  });
