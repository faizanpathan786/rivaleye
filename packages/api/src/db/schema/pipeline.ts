import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const report_platform_stage_enum = pgEnum("report_platform_stage", [
  "queued",
  "scrape",
  "stage_a",
  "stage_b",
  "done",
  "failed",
  "fetching",
  "storing_mentions",
  "extracting",
  "summarizing",
  "completed",
]);
import { reports } from "./reports";
import { users } from "./users";

export const report_platform_job_status_enum = pgEnum("report_platform_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const report_platform_jobs = pgTable(
  "report_platform_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    status: report_platform_job_status_enum("status").notNull().default("queued"),
    error: text("error"),
    stage: report_platform_stage_enum("stage").notNull().default("scrape"),
    attempt_count: integer("attempt_count").notNull().default(0),
    last_error: text("last_error"),
    last_event_at: timestamp("last_event_at"),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
    run_after: timestamp("run_after").notNull().defaultNow(),
    locked_at: timestamp("locked_at"),
    locked_by: text("locked_by"),
    max_attempts: integer("max_attempts").notNull().default(3),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_platform_jobs_report_platform_uniq").on(t.report_id, t.platform),
    index("report_platform_jobs_report_id_idx").on(t.report_id),
    index("report_platform_jobs_status_run_after_idx").on(t.status, t.run_after, t.created_at).where(sql`status = 'queued'`),
    index("report_platform_jobs_report_id_status_idx").on(t.report_id, t.status),
    index("report_platform_jobs_locked_at_idx").on(t.locked_at).where(sql`status = 'running'`),
  ],
);

export const synthesis_job_status_enum = pgEnum("synthesis_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const synthesis_jobs = pgTable(
  "synthesis_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    status: synthesis_job_status_enum("status").notNull().default("queued"),
    attempt_count: integer("attempt_count").notNull().default(0),
    max_attempts: integer("max_attempts").notNull().default(2),
    run_after: timestamp("run_after").notNull().defaultNow(),
    locked_at: timestamp("locked_at"),
    locked_by: text("locked_by"),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
    last_error: text("last_error"),
    rerun_requested: boolean("rerun_requested").notNull().default(false),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("synthesis_jobs_report_id_uniq").on(t.report_id),
    index("synthesis_jobs_status_run_after_idx").on(t.status, t.run_after, t.created_at),
    index("synthesis_jobs_report_id_idx").on(t.report_id),
    index("synthesis_jobs_locked_at_idx").on(t.locked_at).where(sql`status = 'running'`),
  ],
);

export const report_platform_briefs = pgTable(
  "report_platform_briefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    extract: jsonb("extract").$type<Record<string, unknown>>().notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    model_used: text("model_used").notNull(),
    prompt_tokens: integer("prompt_tokens").notNull().default(0),
    completion_tokens: integer("completion_tokens").notNull().default(0),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_platform_briefs_report_platform_uniq").on(t.report_id, t.platform),
    index("report_platform_briefs_report_id_idx").on(t.report_id),
  ],
);

// ── Async PDF export jobs ────────────────────────────────────────────────
// Enqueued by the API, processed by the worker (headless-Chrome render). The
// worker reuses the requester's session cookie (stored transiently) to auth the
// export view's data fetches, then stores the PDF as base64 and clears the
// cookie. UX: enqueue → poll status → download when ready.
export const report_pdf_job_status_enum = pgEnum("report_pdf_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const report_pdf_jobs = pgTable(
  "report_pdf_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    owner_id: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lens: text("lens"), // null = full report, otherwise a single lens id
    status: report_pdf_job_status_enum("status").notNull().default("queued"),
    session_cookie: text("session_cookie"), // transient; cleared once rendered
    pdf_base64: text("pdf_base64"), // populated on completion
    error: text("error"),
    attempt_count: integer("attempt_count").notNull().default(0),
    max_attempts: integer("max_attempts").notNull().default(2),
    run_after: timestamp("run_after").notNull().defaultNow(),
    locked_at: timestamp("locked_at"),
    locked_by: text("locked_by"),
    started_at: timestamp("started_at"),
    completed_at: timestamp("completed_at"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("report_pdf_jobs_status_run_after_idx").on(t.status, t.run_after, t.created_at).where(sql`status = 'queued'`),
    index("report_pdf_jobs_owner_id_idx").on(t.owner_id),
    index("report_pdf_jobs_report_id_idx").on(t.report_id),
    index("report_pdf_jobs_locked_at_idx").on(t.locked_at).where(sql`status = 'running'`),
  ],
);

export type ReportPdfJob = typeof report_pdf_jobs.$inferSelect;
export type NewReportPdfJob = typeof report_pdf_jobs.$inferInsert;

export type ReportPlatformJob = typeof report_platform_jobs.$inferSelect;
export type NewReportPlatformJob = typeof report_platform_jobs.$inferInsert;
export type SynthesisJob = typeof synthesis_jobs.$inferSelect;
export type NewSynthesisJob = typeof synthesis_jobs.$inferInsert;
export type ReportPlatformBrief = typeof report_platform_briefs.$inferSelect;
export type NewReportPlatformBrief = typeof report_platform_briefs.$inferInsert;

export const pipeline_checkpoint_stage_enum = pgEnum("pipeline_checkpoint_stage", [
  "C",
  "D",
  "E",
]);

export type PipelineCheckpointStage = typeof pipeline_checkpoint_stage_enum.enumValues[number];

export const report_pipeline_checkpoints = pgTable(
  "report_pipeline_checkpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    stage: pipeline_checkpoint_stage_enum("stage").notNull(),
    output: jsonb("output").$type<Record<string, unknown>>().notNull(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_pipeline_checkpoints_report_stage_uniq").on(t.report_id, t.stage),
    index("report_pipeline_checkpoints_report_id_idx").on(t.report_id),
  ],
);

export type ReportPipelineCheckpoint = typeof report_pipeline_checkpoints.$inferSelect;
export type NewReportPipelineCheckpoint = typeof report_pipeline_checkpoints.$inferInsert;

// Infer TypeScript types from enums for type safety across packages
export type SourceJobStatus = typeof report_platform_job_status_enum.enumValues[number];
export type SynthesisJobStatus = typeof synthesis_job_status_enum.enumValues[number];
export type ReportPlatformStage = typeof report_platform_stage_enum.enumValues[number];
