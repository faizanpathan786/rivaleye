import {
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

export const report_platform_stage_enum = pgEnum("report_platform_stage", [
  "scrape",
  "stage_a",
  "stage_b",
  "done",
  "failed",
]);
import { reports } from "./reports";

export const report_platform_job_status_enum = pgEnum("report_platform_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
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
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("report_platform_jobs_report_platform_uniq").on(t.report_id, t.platform),
    index("report_platform_jobs_report_id_idx").on(t.report_id),
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

export type ReportPlatformJob = typeof report_platform_jobs.$inferSelect;
export type NewReportPlatformJob = typeof report_platform_jobs.$inferInsert;
export type ReportPlatformBrief = typeof report_platform_briefs.$inferSelect;
export type NewReportPlatformBrief = typeof report_platform_briefs.$inferInsert;
