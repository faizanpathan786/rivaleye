import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { reports } from "./reports";

export const pipeline_event_kind_enum = pgEnum("pipeline_event_kind", [
  "started",
  "completed",
  "failed",
  "retrying",
]);

export const pipeline_events = pgTable(
  "pipeline_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    report_id: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    platform: text("platform"),
    stage: text("stage").notNull(),
    event: pipeline_event_kind_enum("event").notNull(),
    attempt: integer("attempt").notNull().default(1),
    duration_ms: integer("duration_ms"),
    error: text("error"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("pipeline_events_report_id_idx").on(t.report_id, t.created_at)],
);

export type PipelineEvent = typeof pipeline_events.$inferSelect;
export type NewPipelineEvent = typeof pipeline_events.$inferInsert;
