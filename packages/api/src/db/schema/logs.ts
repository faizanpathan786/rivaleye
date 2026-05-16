import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const report_log_level_enum = pgEnum("log_level", ["info", "warn", "error"]);

export const report_logs = pgTable(
  "report_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    level: report_log_level_enum("level").notNull(),
    stage: text("stage"),
    platform: text("platform"),
    message: text("message").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("report_logs_report_id_created_at_idx").on(t.report_id, t.created_at)],
);

export type ReportLog = typeof report_logs.$inferSelect;
export type NewReportLog = typeof report_logs.$inferInsert;
