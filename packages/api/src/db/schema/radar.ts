import {
  index,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { competitors } from "./competitors";

export const radar_severity_enum = pgEnum("radar_severity", [
  "low",
  "med",
  "high",
  "urgent",
]);

export const radar_event_type_enum = pgEnum("radar_event_type", [
  "feature-leak",
  "demo-video",
  "launch",
  "pricing-change",
  "exec-post",
  "viral-complaint",
  "review-spike",
  "feature-launch",
  "hire",
]);

export const radar_events = pgTable(
  "radar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitor_id: uuid("competitor_id")
      .notNull()
      .references(() => competitors.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    type: radar_event_type_enum("type").notNull(),
    severity: radar_severity_enum("severity").notNull(),
    title: text("title").notNull(),
    snippet: text("snippet"),
    url: text("url"),
    who: text("who"),
    role: text("role"),
    confidence: real("confidence").notNull().default(0),
    impact: text("impact"),
    detected_at: timestamp("detected_at").notNull().defaultNow(),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("radar_events_competitor_id_idx").on(t.competitor_id)],
);

export type RadarEvent = typeof radar_events.$inferSelect;
export type NewRadarEvent = typeof radar_events.$inferInsert;
